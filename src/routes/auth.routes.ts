import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { authJwt } from '../middlewares/authJwt';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator';
import { z } from 'zod';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many auth attempts, please try again later',
    code: 'RATE_LIMITED',
  },
});

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(authController.login),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(authController.refresh),
);

authRouter.post(
  '/logout',
  validate(z.object({ refreshToken: z.string().optional() }).optional().default({})),
  asyncHandler(authController.logout),
);

authRouter.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

authRouter.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

authRouter.get('/me', authJwt, asyncHandler(authController.me));

authRouter.patch(
  '/profile',
  authJwt,
  validate(updateProfileSchema),
  asyncHandler(authController.updateProfile),
);

authRouter.patch(
  '/password',
  authJwt,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);
