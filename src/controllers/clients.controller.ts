import { Context } from "hono";
interface CloudflareBindings {
  DB: D1Database;
  // Add other bindings here if needed
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

export const getClients = async (
  c: Context<{ Bindings: CloudflareBindings }>
) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM clients").all();

    return c.json(results || []);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return c.json({ error: "Failed to fetch clients" }, 500);
  }
};

export const getClientById = async (
  c: Context<{ Bindings: CloudflareBindings }>
) => {
  const id = c.req.param("id");

  try {
    const client = await c.env.DB.prepare("SELECT * FROM clients WHERE id = ?")
      .bind(id)
      .first();

    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    return c.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return c.json({ error: "Failed to fetch client" }, 500);
  }
};

export const updateClient = async (
  c: Context<{ Bindings: CloudflareBindings }>
) => {
  const id = c.req.param("id");
  const { name, redirect_uris } =
    await c.req.json();

  try {
    await c.env.DB.prepare(
      `UPDATE clients 
       SET name = ?, redirect_uris = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(name, redirect_uris, id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating client:", error);
    return c.json({ error: "Failed to update client" }, 500);
  }
};

export const deleteClient = async (
  c: Context<{ Bindings: CloudflareBindings }>
) => {
  const id = c.req.param("id");

  try {
    await c.env.DB.prepare("DELETE FROM clients WHERE id = ?").bind(id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return c.json({ error: "Failed to delete client" }, 500);
  }
};
