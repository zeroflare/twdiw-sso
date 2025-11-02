import { Context } from "hono";
import { sign } from "hono/jwt";

export class OIDCController {
  static async token(c: Context) {
    const { env, req } = c;

    const formData = await req.formData();
    console.log(formData);
    const code = formData.get("code");

    const raw = await c.env.CODE_KV.get(code as string);
    if (!raw) {
      return c.json({ error: "CODE 已過期或不存在" }, 401);
    }

    // 取出 name 和 email
    const data = JSON.parse(raw);
    const name = data.name;
    const email = data.email;

    const keyJson = JSON.parse(atob(env.PRIVATE_KEY as string));

    const payload = {
      email,
      name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      iat: Math.floor(Date.now() / 1000),
    };

    const jwt = await sign(payload, keyJson, "RS256");
    console.log(jwt);
    return c.json({ id_token: jwt });
  }

  static async jwks(c: Context) {
    try {
      const { env } = c;
      const oidcKeyBase64 = env.PUBLIC_KEY as string;

      if (!oidcKeyBase64) {
        throw new Error("OIDC_KEY not configured in environment");
      }

      // Decode base64 to string
      const keyStr = atob(oidcKeyBase64);
      const keyJson = JSON.parse(keyStr);
      return c.json({ keys: [keyJson] });
    } catch (error) {
      console.error("Error generating JWKS:", error);
      return c.json({ error: "Failed to generate JWKS" }, 500);
    }
  }
}
