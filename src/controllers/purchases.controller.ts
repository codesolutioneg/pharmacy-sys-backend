import { Request, Response } from 'express';
import { purchasesService } from '../services/purchases.service';
import { purchaseReturnsService } from '../services/purchase-returns.service';
import { sendCreated, sendSuccess } from '../utils/response';

export const purchasesController = {
  async createDraft(req: Request, res: Response) {
    const draft = await purchasesService.createDraft(req.user!.shopId, req.user!.userId);
    return sendCreated(res, purchasesService.buildDraftView(draft));
  },

  async addLine(req: Request, res: Response) {
    const draft = await purchasesService.addLine(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, purchasesService.buildDraftView(draft));
  },

  async removeLine(req: Request, res: Response) {
    const draft = await purchasesService.removeLine(
      req.user!.shopId,
      Number(req.params.id),
      req.params.lineId,
    );
    return sendSuccess(res, purchasesService.buildDraftView(draft));
  },

  async updateDraft(req: Request, res: Response) {
    const draft = await purchasesService.updateDraftMeta(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, purchasesService.buildDraftView(draft));
  },

  async getDraft(req: Request, res: Response) {
    const data = await purchasesService.getDraftView(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async commit(req: Request, res: Response) {
    const data = await purchasesService.commit(req.user!.shopId, req.body.draftId);
    return sendCreated(res, data);
  },

  async list(req: Request, res: Response) {
    const { page, limit, supplierId } = req.query as unknown as {
      page: number;
      limit: number;
      supplierId?: number;
    };
    const data = await purchasesService.list(req.user!.shopId, { page, limit, supplierId });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await purchasesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async createReturn(req: Request, res: Response) {
    const data = await purchaseReturnsService.createReturn(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendCreated(res, data);
  },
};
