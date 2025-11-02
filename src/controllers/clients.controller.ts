import { Context } from "hono";

interface CloudflareBindings {
  DB: D1Database;
}

export const createClient = async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user_email = user.email;
  const client_id = crypto.randomUUID();
  const client_secret = crypto.randomUUID();
  const { name, redirect_uris } = await c.req.json();

  try {
    await c.env.DB.prepare(
      `INSERT INTO clients (user_email, client_id, client_secret, name, redirect_uris) 
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(user_email, client_id, client_secret, name, redirect_uris)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error creating client:", error);
    return c.json({ error: "Failed to create client" }, 500);
  }
};

export const getClients = async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user_email = user.email;

  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM clients WHERE user_email = ?"
    )
      .bind(user_email)
      .all();

    return c.json(results || []);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
};

export const getClientById = async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user_email = user.email;
  const id = c.req.param("id");

  try {
    const client = await c.env.DB.prepare(
      "SELECT * FROM clients WHERE id = ? AND user_email = ?"
    )
      .bind(id, user_email)
      .first();

    if (!client) {
      return c.json({ error: "Client not found or not owned by you" }, 404);
    }

    return c.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return c.json({ error: "Failed to fetch client" }, 500);
  }
};

export const updateClient = async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user_email = user.email;
  const id = c.req.param("id");
  const { name, redirect_uris } = await c.req.json();

  try {
    // 先確認這筆 client 是否屬於該使用者
    const client = await c.env.DB.prepare(
      "SELECT * FROM clients WHERE id = ? AND user_email = ?"
    )
      .bind(id, user_email)
      .first();

    if (!client) {
      return c.json({ error: "Client not found or not owned by you" }, 403);
    }

    await c.env.DB.prepare(
      `UPDATE clients 
       SET name = ?, redirect_uris = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_email = ?`
    )
      .bind(name, redirect_uris, id, user_email)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating client:", error);
    return c.json({ error: "Failed to update client" }, 500);
  }
};

export const deleteClient = async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user_email = user.email;
  const id = c.req.param("id");

  try {
    // 同樣先確認所有權
    const client = await c.env.DB.prepare(
      "SELECT * FROM clients WHERE id = ? AND user_email = ?"
    )
      .bind(id, user_email)
      .first();

    if (!client) {
      return c.json({ error: "Client not found or not owned by you" }, 403);
    }

    await c.env.DB.prepare(
      "DELETE FROM clients WHERE id = ? AND user_email = ?"
    )
      .bind(id, user_email)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return c.json({ error: "Failed to delete client" }, 500);
  }
};
