import { User } from '@prisma/client';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  generateRawToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  ttlToDate,
  verifyRefreshToken,
} from '../utils/tokens';
import { logger } from '../utils/logger';
import {
  passwordResetRepository,
  permissionsRepository,
  refreshTokensRepository,
  usersRepository,
} from '../repositories/auth.repository';

function publicUser(user: User & { role?: { id: number; name: string; displayName: string } | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    shopId: user.shopId,
    roleId: user.roleId,
    image: user.image,
    lastLogin: user.lastLogin,
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          displayName: user.role.displayName,
        }
      : null,
  };
}

async function issueTokens(user: User) {
  const accessToken = signAccessToken({
    userId: user.id,
    shopId: user.shopId,
    roleId: user.roleId,
    email: user.email,
  });

  const jti = generateRawToken();
  const refreshToken = signRefreshToken({ userId: user.id, jti });
  const tokenHash = hashToken(refreshToken);
  await refreshTokensRepository.create({
    userId: user.id,
    tokenHash,
    expiresAt: ttlToDate(config.jwt.refreshTtl),
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async login(email: string, password: string) {
    const user = await usersRepository.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await usersRepository.updateLastLogin(user.id);
    const tokens = await issueTokens(user);
    const permissionRows = await permissionsRepository.listNamesForRole(user.roleId);
    const permissions = permissionRows.map((r) => r.permission.name);

    return {
      ...tokens,
      user: { ...publicUser(user), permissions },
    };
  },

  async refresh(refreshToken: string) {
    let payload: { userId: number; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await refreshTokensRepository.findValidByHash(tokenHash);
    if (!stored || stored.userId !== payload.userId) {
      throw new AppError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
    }

    await refreshTokensRepository.revoke(stored.id);
    const user = stored.user;
    const tokens = await issueTokens(user);
    return {
      ...tokens,
      user: publicUser(user),
    };
  },

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await refreshTokensRepository.revokeByHash(hashToken(refreshToken));
    }
  },

  async me(userId: number) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found');
    }
    const permissionRows = await permissionsRepository.listNamesForRole(user.roleId);
    return {
      ...publicUser(user),
      permissions: permissionRows.map((r) => r.permission.name),
      shop: user.shop
        ? {
            id: user.shop.id,
            name: user.shop.name,
            currency: user.shop.currency,
            locale: user.shop.locale,
            timeZone: user.shop.timeZone,
          }
        : null,
    };
  },

  async forgotPassword(email: string) {
    const user = await usersRepository.findByEmail(email);
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent' };
    }

    const raw = generateRawToken();
    await passwordResetRepository.create({
      email: user.email,
      tokenHash: hashToken(raw),
      expiresAt: ttlToDate('1h'),
    });

    // Mailer stub — log token in non-production for local testing
    if (!config.isProd) {
      logger.info({ email: user.email, resetToken: raw }, 'Password reset token issued');
    }

    return { message: 'If that email exists, a reset link has been sent' };
  },

  async resetPassword(email: string, token: string, password: string) {
    const record = await passwordResetRepository.findValid(email, hashToken(token));
    if (!record) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token');
    }

    const user = await usersRepository.findByEmail(email);
    if (!user) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token');
    }

    await usersRepository.updatePassword(user.id, await hashPassword(password));
    await passwordResetRepository.markUsed(record.id);
    return { message: 'Password updated successfully' };
  },

  async updateProfile(userId: number, data: { name?: string; image?: string | null }) {
    const user = await usersRepository.updateProfile(userId, data);
    return publicUser(user);
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found');
    }
    if (!(await verifyPassword(currentPassword, user.password))) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    }
    await usersRepository.updatePassword(userId, await hashPassword(newPassword));
    return { message: 'Password changed successfully' };
  },
};
