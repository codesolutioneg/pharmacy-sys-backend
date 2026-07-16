import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authJwt } from '../middlewares/authJwt';
import { asyncHandler } from '../utils/asyncHandler';

/** Auth-only — no dedicated permission (dashboard.md: "safe aggregate summary"). */
export const dashboardRouter = Router();

dashboardRouter.use(authJwt);

dashboardRouter.get('/summary', asyncHandler(dashboardController.summary));
