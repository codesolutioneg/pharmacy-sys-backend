import { Request, Response } from 'express';
import { rolesService } from '../services/roles.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const rolesController = {
  async list(_req: Request, res: Response) {
    return sendSuccess(res, await rolesService.list());
  },

  async get(req: Request, res: Response) {
    return sendSuccess(res, await rolesService.getById(Number(req.params.id)));
  },

  async create(req: Request, res: Response) {
    const data = await rolesService.create(
      req.body.displayName,
      req.body.permissionNames ?? [],
    );
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await rolesService.update(Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await rolesService.remove(Number(req.params.id));
    return sendMessage(res, data.message);
  },

  async permissions(_req: Request, res: Response) {
    return sendSuccess(res, await rolesService.listPermissionsCatalog());
  },
};
