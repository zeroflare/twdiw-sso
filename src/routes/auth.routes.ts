import { Hono } from 'hono';
import { AuthController } from '../controllers/auth.controller';

const authRouter = new Hono();

authRouter.get('/login/qrcode', AuthController.loginQrcode);
authRouter.get('/login/result', AuthController.loginResult);
authRouter.post('/register/qrcode', AuthController.registerQrcode);
authRouter.get('/register/result', AuthController.registerResult);
authRouter.post('/register/send', AuthController.sendEmail);
authRouter.get('/logout', AuthController.logout);
authRouter.get('/me', AuthController.me);

export { authRouter };
