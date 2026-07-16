import { Router } from 'express';
import { purchasesController } from '../controllers/purchases.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import {
  commitPurchaseSchema,
  draftIdParamSchema,
  draftLineIdParamSchema,
  draftLineSchema,
  purchaseListQuerySchema,
  purchaseReturnSchema,
  updateDraftSchema,
} from '../validators/purchases.validator';

export const purchasesRouter = Router();

purchasesRouter.use(authJwt);

purchasesRouter.post(
  '/drafts',
  authorize('purchase.create'),
  asyncHandler(purchasesController.createDraft),
);

purchasesRouter.get(
  '/drafts/:id',
  authorize('purchase.show'),
  validate(draftIdParamSchema, 'params'),
  asyncHandler(purchasesController.getDraft),
);

purchasesRouter.patch(
  '/drafts/:id',
  authorize('purchase.create'),
  validate(draftIdParamSchema, 'params'),
  validate(updateDraftSchema),
  asyncHandler(purchasesController.updateDraft),
);

purchasesRouter.post(
  '/drafts/:id/lines',
  authorize('purchase.create'),
  validate(draftIdParamSchema, 'params'),
  validate(draftLineSchema),
  asyncHandler(purchasesController.addLine),
);

purchasesRouter.delete(
  '/drafts/:id/lines/:lineId',
  authorize('purchase.create'),
  validate(draftLineIdParamSchema, 'params'),
  asyncHandler(purchasesController.removeLine),
);

purchasesRouter.post(
  '/',
  authorize('purchase.store'),
  validate(commitPurchaseSchema),
  asyncHandler(purchasesController.commit),
);

purchasesRouter.get(
  '/',
  authorize('purchase.index'),
  validate(purchaseListQuerySchema, 'query'),
  asyncHandler(purchasesController.list),
);

purchasesRouter.get(
  '/:id',
  authorize('purchase.show'),
  validate(idParamSchema, 'params'),
  asyncHandler(purchasesController.get),
);

purchasesRouter.post(
  '/:id/returns',
  authorize('purchase.update'),
  validate(idParamSchema, 'params'),
  validate(purchaseReturnSchema),
  asyncHandler(purchasesController.createReturn),
);
