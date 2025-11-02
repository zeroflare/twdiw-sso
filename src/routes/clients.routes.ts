import { Hono } from 'hono';
import { 
  createClient, 
  getClients, 
  getClientById, 
  updateClient, 
  deleteClient 
} from '../controllers/clients.controller';

const clientsRouter = new Hono<{ Bindings: CloudflareBindings }>();

// Create a new client
clientsRouter.post('/', createClient);

// Get all clients
clientsRouter.get('/', getClients);

// Get a single client by ID
clientsRouter.get('/:id', getClientById);

// Update a client
clientsRouter.put('/:id', updateClient);

// Delete a client
clientsRouter.delete('/:id', deleteClient);

export { clientsRouter };
