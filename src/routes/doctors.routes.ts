import { Router } from 'express';
import { doctorsController } from '../controllers/doctors.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import { createDoctorSchema, updateDoctorSchema } from '../validators/doctors.validator';

export const doctorsRouter = Router();

doctorsRouter.use(authJwt);

doctorsRouter.get(
  '/',
  authorize('doctor.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(doctorsController.list),
);

doctorsRouter.post(
  '/',
  authorize('doctor.store'),
  validate(createDoctorSchema),
  asyncHandler(doctorsController.create),
);

doctorsRouter.get(
  '/:id',
  authorize('doctor.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(doctorsController.get),
);

doctorsRouter.patch(
  '/:id',
  authorize('doctor.update'),
  validate(idParamSchema, 'params'),
  validate(updateDoctorSchema),
  asyncHandler(doctorsController.update),
);

doctorsRouter.delete(
  '/:id',
  authorize('doctor.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(doctorsController.remove),
);
