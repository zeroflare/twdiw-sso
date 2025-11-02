import { Hono } from 'hono';
import { InitController } from '../controllers/init.controller';

const initRouter = new Hono();

initRouter.get('/db', InitController.initDb);

export { initRouter };
