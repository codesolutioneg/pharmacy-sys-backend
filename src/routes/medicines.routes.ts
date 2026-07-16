import { Router } from 'express';
import { medicinesController } from '../controllers/medicines.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import {
  createMedicineSchema,
  medicineListQuerySchema,
  suggestBarcodeSchema,
  updateMedicineSchema,
} from '../validators/medicines.validator';

export const medicinesRouter = Router();

medicinesRouter.use(authJwt);

medicinesRouter.get(
  '/',
  authorize('medicine.list'),
  validate(medicineListQuerySchema, 'query'),
  asyncHandler(medicinesController.list),
);

medicinesRouter.post(
  '/',
  authorize('medicine.store'),
  validate(createMedicineSchema),
  asyncHandler(medicinesController.create),
);

medicinesRouter.post(
  '/barcode',
  authorize('medicine.store'),
  validate(suggestBarcodeSchema),
  asyncHandler(medicinesController.suggestBarcode),
);

medicinesRouter.get(
  '/:id',
  authorize('medicine.show'),
  validate(idParamSchema, 'params'),
  asyncHandler(medicinesController.get),
);

medicinesRouter.patch(
  '/:id',
  authorize('medicine.update'),
  validate(idParamSchema, 'params'),
  validate(updateMedicineSchema),
  asyncHandler(medicinesController.update),
);

medicinesRouter.delete(
  '/:id',
  authorize('medicine.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(medicinesController.remove),
);
