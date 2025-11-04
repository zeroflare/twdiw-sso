import { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";

export class AuthController {
  static async loginQrcode(c: Context) {
    const { env } = c;
    const apiUrl = env.TWDIW_VP_URL;
    const ref = env.TWDIW_VP_ID;
    const transactionId = c.req.query("transactionId");
    const url = `${apiUrl}/api/oidvp/qrcode?ref=${ref}&transactionId=${transactionId}`;
    const res = await fetch(url, {
      headers: {
        "Access-Token": env.TWDIW_VP_TOKEN,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const qrcodeImage = data.qrcodeImage;
      const authUri = data.authUri;

      return c.json({ qrcodeImage, authUri });
    } else {
      return c.json(
        {
          error: true,
          message: "取得 QR Code 失敗",
        },
        500
      );
    }
  }

  static async loginResult(c: Context) {
    try {
      const { env, req } = c;
      const apiUrl = env.TWDIW_VP_URL;
      const transactionId = req.query("transactionId");

      const url = `${apiUrl}/api/oidvp/result`;
      console.log(url);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": env.TWDIW_VP_TOKEN,
        },
        body: JSON.stringify({ transactionId }),
      });

      const text = await res.text();
      console.log(text);

      if (res.ok) {
        const data = JSON.parse(text);

        const email = data.data[0].claims.find(
          (c: any) => c.ename === "email"
        )?.value;
        const name = data.data[0].claims.find(
          (c: any) => c.ename === "name"
        )?.value;

        const payload = {
          email,
          name,
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          iat: Math.floor(Date.now() / 1000),
        };

        const keyJson = JSON.parse(atob(env.PRIVATE_KEY));
        const jwt = await sign(payload, keyJson, "RS256");

        setCookie(c, "jwt", jwt, {
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          path: "/",
          maxAge: 60 * 60,
        });

        const code = crypto.randomUUID();
        await env.CODE_KV.put(code, JSON.stringify(payload), {
          expirationTtl: 60,
        });
        return c.json({ code });
      } else {
        return c.json(
          {
            message: "等待驗證",
          },
          400
        );
      }
    } catch (error) {
      console.error(error);
      return c.json(
        {
          message: "發生錯誤",
        },
        500
      );
    }
  }

  static async registerQrcode(c: Context) {
    const { env, req } = c;
    const kv = env.CODE_KV as KVNamespace;

    const body = await req.json();
    const { name, email, otp } = body;

    // --- 基本欄位檢查 ---
    if (!name || !email || !otp) {
      return c.json({ error: "缺少必要欄位 (name, email, otp)" }, 400);
    }

    // --- 檢查 OTP ---
    const storedOtp = await kv.get(`otp:${email}`);
    if (!storedOtp) {
      return c.json({ error: "驗證碼已失效或未發送" }, 400);
    }

    if (storedOtp !== otp) {
      return c.json({ error: "驗證碼錯誤" }, 400);
    }

    // OTP 驗證成功後，刪除舊的 OTP，避免重複使用
    await kv.delete(`otp:${email}`);

    // --- 呼叫 TWDIW 服務 ---
    const apiUrl = env.TWDIW_VC_URL;
    const url = `${apiUrl}/api/qrcode/data`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Access-Token": env.TWDIW_VC_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vcUid: env.TWDIW_VC_ID,
          fields: [
            { ename: "name", content: name },
            { ename: "email", content: email },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("TWDIW 錯誤：", text);
        return c.json({ error: "取得 QR Code 失敗" }, 500);
      }

      const data = await res.json();
      const { transactionId, qrCode, deepLink } = data as any;

      return c.json({ transactionId, qrCode, deepLink });
    } catch (err) {
      console.error("呼叫 TWDIW 錯誤:", err);
      return c.json({ error: "伺服器錯誤，請稍後再試" }, 500);
    }
  }

  static async registerResult(c: Context) {
    const { env, req } = c;
    const apiUrl = env.TWDIW_VC_URL;
    const transactionId = req.query("transactionId");
    const url = `${apiUrl}/api/credential/nonce/${transactionId}`;
    const res = await fetch(url, {
      headers: {
        "Access-Token": env.TWDIW_VC_TOKEN,
      },
    });
    const data = (await res.json()) as any;

    if (res.ok) {
      return c.json(data);
    } else {
      return c.json(
        {
          error: "等待登入",
        },
        400
      );
    }
  }

  static async logout(c: Context) {
    deleteCookie(c, "jwt");
    return c.json({ success: true });
  }

  static async me(c: Context) {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Not logged in" }, 401);
    }
    return c.json(user);
  }

  static async sendEmail(c: Context) {
    try {
      const { email } = await c.req.json();
      if (!email) {
        return c.json({ error: "缺少 email 欄位" }, 400);
      }

      const kv = c.env.CODE_KV as KVNamespace;

      // 檢查是否在冷卻期內
      const cooldownKey = `cooldown:${email}`;
      const lastSent = await kv.get(cooldownKey);
      if (lastSent) {
        return c.json({ error: "請稍後再試，每分鐘僅能寄送一次驗證碼" }, 429);
      }

      // 產生六位數 OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // 儲存 OTP (10 分鐘有效)
      await kv.put(`otp:${email}`, otp, { expirationTtl: 600 });

      // 寄信
      const apiKey = c.env.MAILGUN_API_KEY;
      const domain = c.env.MAILGUN_DOMAIN;
      const mailgunUrl = `https://api.mailgun.net/v3/${domain}/messages`;

      const body = new URLSearchParams();
      body.append("from", `數位憑證皮夾 OIDC <noreply@${domain}>`);
      body.append("to", email);
      body.append("subject", "您的電子信箱驗證碼");
      body.append(
        "text",
        `您好！\n\n您的驗證碼是：${otp}\n請於 10 分鐘內輸入完成註冊。`
      );
      body.append(
        "html",
        `<p>您好！</p><p>您的驗證碼是：<strong>${otp}</strong></p><p>請於 10 分鐘內輸入完成註冊。</p>`
      );

      const response = await fetch(mailgunUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`api:${apiKey}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Mailgun error:", text);
        return c.json({ error: "寄信失敗，請稍後再試" }, 500);
      }

      // 寫入冷卻鍵 (60 秒內不能再寄)
      await kv.put(cooldownKey, "1", { expirationTtl: 60 });

      return c.json({ message: "驗證碼已寄出" });
    } catch (err: any) {
      console.error("寄信錯誤:", err);
      return c.json({ error: "伺服器錯誤" }, 500);
    }
  }
}
