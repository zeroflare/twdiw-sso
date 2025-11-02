import { Hono } from 'hono';
import { OIDCController } from '../controllers/oidc.controller';

const router = new Hono();


router.post('/token', OIDCController.token);
router.get('/jwks', OIDCController.jwks);

export { router as oidcRouter };
