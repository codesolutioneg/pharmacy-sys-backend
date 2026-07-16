import { Request, Response } from 'express';
import { patientsService } from '../services/patients.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const patientsController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await patientsService.list(page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await patientsService.getById(Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await patientsService.create(req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await patientsService.update(Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await patientsService.remove(Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
