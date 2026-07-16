import { Router } from 'express';
import { patientsController } from '../controllers/patients.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import { createPatientSchema, updatePatientSchema } from '../validators/patients.validator';

export const patientsRouter = Router();

patientsRouter.use(authJwt);

patientsRouter.get(
  '/',
  authorize('patient.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(patientsController.list),
);

patientsRouter.post(
  '/',
  authorize('patient.store'),
  validate(createPatientSchema),
  asyncHandler(patientsController.create),
);

patientsRouter.get(
  '/:id',
  authorize('patient.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(patientsController.get),
);

patientsRouter.patch(
  '/:id',
  authorize('patient.update'),
  validate(idParamSchema, 'params'),
  validate(updatePatientSchema),
  asyncHandler(patientsController.update),
);

patientsRouter.delete(
  '/:id',
  authorize('patient.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(patientsController.remove),
);
