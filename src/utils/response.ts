import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): Response {
  return res.status(statusCode).json({ success: true, data });
}

export function sendMessage(
  res: Response,
  message: string,
  statusCode = 200,
): Response {
  return res.status(statusCode).json({ success: true, message });
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}
