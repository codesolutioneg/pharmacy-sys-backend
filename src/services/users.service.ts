import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { hashPassword } from '../utils/password';

function toPublic(user: {
  id: number;
  name: string;
  email: string;
  shopId: number;
  roleId: number;
  image: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role?: { id: number; name: string; displayName: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    shopId: user.shopId,
    roleId: user.roleId,
    image: user.image,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          displayName: user.role.displayName,
        }
      : null,
  };
}

export const usersService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { shopId },
        include: { role: true },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: { shopId } }),
    ]);
    return {
      items: items.map(toPublic),
      meta: { page, limit, total },
    };
  },

  async getById(shopId: number, id: number) {
    const user = await prisma.user.findFirst({
      where: { id, shopId },
      include: { role: true },
    });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return toPublic(user);
  },

  async create(
    shopId: number,
    data: { name: string; email: string; password: string; roleId: number },
  ) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) {
      throw new AppError(400, 'INVALID_ROLE', 'Role does not exist');
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'Email already in use');
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: await hashPassword(data.password),
        roleId: data.roleId,
        shopId,
      },
      include: { role: true },
    });
    return toPublic(user);
  },

  async update(
    shopId: number,
    id: number,
    data: {
      name?: string;
      email?: string;
      password?: string;
      roleId?: number;
    },
  ) {
    const user = await prisma.user.findFirst({ where: { id, shopId } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (data.roleId !== undefined) {
      const role = await prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) {
        throw new AppError(400, 'INVALID_ROLE', 'Role does not exist');
      }
    }

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw new AppError(409, 'EMAIL_EXISTS', 'Email already in use');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        roleId: data.roleId,
        ...(data.password
          ? { password: await hashPassword(data.password) }
          : {}),
      },
      include: { role: true },
    });
    return toPublic(updated);
  },

  async remove(shopId: number, id: number, actorId: number) {
    if (id === actorId) {
      throw new AppError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account');
    }
    const user = await prisma.user.findFirst({ where: { id, shopId } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    await prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  },
};
