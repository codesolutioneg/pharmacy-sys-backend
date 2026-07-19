import { Request, Response } from 'express';
import { insuranceCompaniesService } from '../services/insurance-companies.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const insuranceCompaniesController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await insuranceCompaniesService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await insuranceCompaniesService.getById(
      req.user!.shopId,
      Number(req.params.id),
    );
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await insuranceCompaniesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await insuranceCompaniesService.update(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await insuranceCompaniesService.remove(
      req.user!.shopId,
      Number(req.params.id),
    );
    return sendMessage(res, data.message);
  },

  async payDue(req: Request, res: Response) {
    const data = await insuranceCompaniesService.payDue(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async statement(req: Request, res: Response) {
    const data = await insuranceCompaniesService.statement(
      req.user!.shopId,
      Number(req.params.id),
    );
    return sendSuccess(res, data);
  },
};
