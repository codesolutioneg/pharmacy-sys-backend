import { prisma } from '../lib/prisma';

export const usersRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true, shop: true },
    });
  },

  findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true, shop: true },
    });
  },

  updateLastLogin(id: number) {
    return prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  },

  updateProfile(id: number, data: { name?: string; image?: string | null }) {
    return prisma.user.update({
      where: { id },
      data,
      include: { role: true, shop: true },
    });
  },

  updatePassword(id: number, password: string) {
    return prisma.user.update({
      where: { id },
      data: { password },
    });
  },
};

export const refreshTokensRepository = {
  create(data: { userId: number; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },

  findValidByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { role: true, shop: true } } },
    });
  },

  revoke(id: number) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  revokeByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

export const passwordResetRepository = {
  create(data: { email: string; tokenHash: string; expiresAt: Date }) {
    return prisma.passwordResetToken.create({ data });
  },

  findValid(email: string, tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        email,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  markUsed(id: number) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },
};

export const permissionsRepository = {
  listNamesForRole(roleId: number) {
    return prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
  },
};
