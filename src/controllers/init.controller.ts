import { Context } from "hono";

export class InitController {
  static async initDb(c: Context) {
    const env = c.env;
    
    // Check if the clients table exists, if not create it
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          client_id TEXT NOT NULL UNIQUE,
          client_secret TEXT NOT NULL,
          redirect_uris TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ).run();
      
      return c.json({ success: true, message: "Database initialized successfully" });
    } catch (error) {
      console.error("Error initializing database:", error);
      return c.json({ success: false, error: "Failed to initialize database" }, 500);
    }
  }
}
