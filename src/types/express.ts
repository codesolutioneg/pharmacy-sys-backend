export type AuthUserPayload = {
  userId: number;
  shopId: number;
  roleId: number;
  email: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- standard Express Request augmentation
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export {};
