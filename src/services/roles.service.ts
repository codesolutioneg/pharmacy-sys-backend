import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { slugifyRoleName } from '../utils/slugify';

export const rolesService = {
  async list() {
    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { id: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      userCount: r._count.users,
      permissionNames: r.permissions.map((p) => p.permission.name),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async getById(id: number) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      userCount: role._count.users,
      permissionNames: role.permissions.map((p) => p.permission.name),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  },

  async create(displayName: string, permissionNames: string[]) {
    const name = slugifyRoleName(displayName);
    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      throw new AppError(409, 'ROLE_EXISTS', 'Role name already exists');
    }

    const permissions = await prisma.permission.findMany({
      where: { name: { in: permissionNames } },
    });
    if (permissions.length !== permissionNames.length) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'One or more permissions are invalid');
    }

    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: { name, displayName },
      });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: created.id,
            permissionId: p.id,
          })),
        });
      }
      return created;
    });

    return this.getById(role.id);
  },

  async update(
    id: number,
    data: { displayName?: string; permissionNames?: string[] },
  ) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }

    let name = role.name;
    if (data.displayName !== undefined) {
      name = slugifyRoleName(data.displayName);
      if (name !== role.name) {
        const clash = await prisma.role.findUnique({ where: { name } });
        if (clash) {
          throw new AppError(409, 'ROLE_EXISTS', 'Role name already exists');
        }
      }
    }

    let permissionIds: number[] | undefined;
    if (data.permissionNames !== undefined) {
      const permissions = await prisma.permission.findMany({
        where: { name: { in: data.permissionNames } },
      });
      if (permissions.length !== data.permissionNames.length) {
        throw new AppError(
          400,
          'INVALID_PERMISSIONS',
          'One or more permissions are invalid',
        );
      }
      permissionIds = permissions.map((p) => p.id);
    }

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name,
          displayName: data.displayName ?? role.displayName,
        },
      });
      if (permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }
    });

    return this.getById(id);
  },

  async remove(id: number) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    }
    if (role._count.users > 0) {
      throw new AppError(
        409,
        'ROLE_IN_USE',
        'Cannot delete a role that still has assigned users',
      );
    }
    await prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  },

  async listPermissionsCatalog() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    const grouped: Record<
      string,
      Array<{ id: number; name: string; label: string }>
    > = {};
    for (const p of permissions) {
      if (!grouped[p.module]) {
        grouped[p.module] = [];
      }
      grouped[p.module].push({ id: p.id, name: p.name, label: p.label });
    }
    return grouped;
  },
};
