import { Router } from 'express';
import { medicineTypesController } from '../controllers/medicine-types.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import {
  createMedicineTypeSchema,
  updateMedicineTypeSchema,
} from '../validators/medicine-types.validator';

export const medicineTypesRouter = Router();

medicineTypesRouter.use(authJwt);

medicineTypesRouter.get(
  '/',
  authorize('medicine.list'),
  validate(paginationSchema, 'query'),
  asyncHandler(medicineTypesController.list),
);

medicineTypesRouter.post(
  '/',
  authorize('medicine.store'),
  validate(createMedicineTypeSchema),
  asyncHandler(medicineTypesController.create),
);

medicineTypesRouter.get(
  '/:id',
  authorize('medicine.list'),
  validate(idParamSchema, 'params'),
  asyncHandler(medicineTypesController.get),
);

medicineTypesRouter.patch(
  '/:id',
  authorize('medicine.update'),
  validate(idParamSchema, 'params'),
  validate(updateMedicineTypeSchema),
  asyncHandler(medicineTypesController.update),
);

medicineTypesRouter.delete(
  '/:id',
  authorize('medicine.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(medicineTypesController.remove),
);
