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
    const { env, req } = c;
    const apiUrl = env.TWDIW_VP_URL;
    const transactionId = req.query("transactionId");

    const url = `${apiUrl}/api/oidvp/result`;
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
        500
      );
    }
  }

  static async registerQrcode(c: Context) {
    const { env, req } = c;
    const body = await req.json();
    const apiUrl = env.TWDIW_VC_URL;
    const url = `${apiUrl}/api/qrcode/data`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Access-Token": env.TWDIW_VC_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vcUid: env.TWDIW_VC_ID,
        fields: [
          { ename: "name", content: body.name },
          { ename: "email", content: body.email },
        ],
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const transactionId = data.transactionId;
      const qrCode = data.qrCode;
      const deepLink = data.deepLink;

      return c.json({ transactionId, qrCode, deepLink });
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
          error: true,
          message: "等待登入",
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
}
