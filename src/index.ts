import { Hono } from "hono";
import { authRouter } from "./routes/auth.routes";
import { oidcRouter } from "./routes/oidc.routes";  // Add this import
import { initRouter } from "./routes/init.routes";
import { clientsRouter } from "./routes/clients.routes";

import { Context } from "hono";
import { verify } from "hono/jwt";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Add this before your routes
app.use("*", async (c: Context, next) => {
  try {
    const token = getCookie(c, "jwt");
    if (token) {
      const keyJson = JSON.parse(atob(c.env.PUBLIC_KEY));
      const payload = await verify(token, keyJson, "RS256");
      c.set("user", {
        email: payload.email,
        name: payload.name,
      });
    }
  } catch (error) {
    console.error(error);
  }
  return next();
});



// API Routes
const api = new Hono();
api.route("/auth", authRouter);
api.route("/clients", clientsRouter);
api.route("/oidc", oidcRouter);
api.route("/init", initRouter);
// Mount API under /api
app.route("/api", api);



export default app;
