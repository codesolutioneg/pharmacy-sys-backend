import { ActiveStatus, Prisma, ProductKind, TaxMode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { toFixedString, toMoneyString } from '../utils/money';
import { slugify } from '../utils/slugify';

type MedicineInput = {
  name: string;
  nameAr?: string | null;
  genericName: string;
  qrCode: string;
  description: string;
  status: ActiveStatus;
  supplierId: number;
  vendorId?: number | null;
  price?: number;
  buyPrice?: number;
  quantity?: number;
  instock?: number;
  strength?: string | null;
  leafId?: number | null;
  typeId?: number | null;
  purchaseUnitId?: number | null;
  sellUnitId?: number | null;
  unitConversion?: number;
  shelf?: string | null;
  categoryIds?: number[];
  barcodes?: string[];
  kind?: ProductKind;
  vat?: number;
  discount?: number;
  taxMode?: TaxMode | null;
  image?: string | null;
  igta?: string | null;
  hnsCode?: string | null;
  reorderLevel?: number;
  minStock?: number;
  maxStock?: number;
};

async function assertRelationsBelongToShop(
  shopId: number,
  data: Partial<MedicineInput>,
): Promise<void> {
  if (data.supplierId !== undefined) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, shopId },
    });
    if (!supplier) {
      throw new AppError(400, 'INVALID_SUPPLIER', 'Supplier not found for this shop');
    }
  }
  if (data.vendorId !== undefined && data.vendorId !== null) {
    const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, shopId } });
    if (!vendor) {
      throw new AppError(400, 'INVALID_VENDOR', 'Vendor not found for this shop');
    }
  }
  if (data.leafId !== undefined && data.leafId !== null) {
    const leaf = await prisma.leaf.findFirst({ where: { id: data.leafId, shopId } });
    if (!leaf) {
      throw new AppError(400, 'INVALID_LEAF', 'Leaf not found for this shop');
    }
  }
  if (data.typeId !== undefined && data.typeId !== null) {
    const type = await prisma.medicineType.findFirst({ where: { id: data.typeId, shopId } });
    if (!type) {
      throw new AppError(400, 'INVALID_MEDICINE_TYPE', 'Medicine type not found for this shop');
    }
  }
  if (data.purchaseUnitId !== undefined && data.purchaseUnitId !== null) {
    const unit = await prisma.unit.findFirst({ where: { id: data.purchaseUnitId, shopId } });
    if (!unit) {
      throw new AppError(400, 'INVALID_PURCHASE_UNIT', 'Purchase unit not found for this shop');
    }
  }
  if (data.sellUnitId !== undefined && data.sellUnitId !== null) {
    const unit = await prisma.unit.findFirst({ where: { id: data.sellUnitId, shopId } });
    if (!unit) {
      throw new AppError(400, 'INVALID_SELL_UNIT', 'Sell unit not found for this shop');
    }
  }
}

export const medicinesService = {
  async list(
    shopId: number,
    params: { page: number; limit: number; search?: string; categoryId?: number; supplierId?: number },
  ) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.MedicineWhereInput = {
      shopId,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { genericName: { contains: params.search, mode: 'insensitive' } },
              { qrCode: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: params.limit,
      }),
      prisma.medicine.count({ where }),
    ]);
    const items = params.categoryId
      ? rows.filter((m) => (m.categoryIds as number[]).includes(params.categoryId as number))
      : rows;
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getById(shopId: number, id: number) {
    const medicine = await prisma.medicine.findFirst({ where: { id, shopId } });
    if (!medicine) {
      throw new AppError(404, 'MEDICINE_NOT_FOUND', 'Medicine not found');
    }
    return medicine;
  },

  async assertQrCodeUnique(shopId: number, qrCode: string, excludeId?: number): Promise<void> {
    const clash = await prisma.medicine.findFirst({
      where: { shopId, qrCode, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (clash) {
      throw new AppError(409, 'QR_CODE_EXISTS', 'QR code already in use for this shop');
    }
  },

  async create(shopId: number, data: MedicineInput) {
    await this.assertQrCodeUnique(shopId, data.qrCode);
    await assertRelationsBelongToShop(shopId, data);

    const slug = `${slugify(data.name) || 'medicine'}-${Date.now()}`;

    return prisma.medicine.create({
      data: {
        shopId,
        qrCode: data.qrCode,
        name: data.name,
        nameAr: data.nameAr ?? null,
        slug,
        genericName: data.genericName,
        price: toMoneyString(data.price ?? 0),
        buyPrice: toMoneyString(data.buyPrice ?? 0),
        quantity: data.quantity ?? 0,
        instock: data.instock ?? 0,
        strength: data.strength ?? null,
        leafId: data.leafId ?? null,
        typeId: data.typeId ?? null,
        purchaseUnitId: data.purchaseUnitId ?? null,
        sellUnitId: data.sellUnitId ?? null,
        unitConversion: toFixedString(data.unitConversion ?? 1, 6),
        shelf: data.shelf ?? null,
        categoryIds: data.categoryIds ?? [],
        barcodes: data.barcodes ?? [],
        supplierId: data.supplierId,
        vendorId: data.vendorId ?? null,
        kind: data.kind ?? 'inventory',
        vat: toMoneyString(data.vat ?? 0),
        discount: toMoneyString(data.discount ?? 0),
        taxMode: data.taxMode ?? null,
        description: data.description,
        status: data.status,
        image: data.image ?? null,
        igta: data.igta ?? null,
        hnsCode: data.hnsCode ?? null,
        reorderLevel: data.reorderLevel ?? 0,
        minStock: data.minStock ?? 0,
        maxStock: data.maxStock ?? 0,
      },
    });
  },

  async update(shopId: number, id: number, data: Partial<MedicineInput>) {
    const medicine = await this.getById(shopId, id);
    if (data.qrCode !== undefined && data.qrCode !== medicine.qrCode) {
      await this.assertQrCodeUnique(shopId, data.qrCode, id);
    }
    await assertRelationsBelongToShop(shopId, data);

    const slug = data.name && data.name !== medicine.name
      ? `${slugify(data.name) || 'medicine'}-${Date.now()}`
      : undefined;

    return prisma.medicine.update({
      where: { id },
      data: {
        qrCode: data.qrCode,
        name: data.name,
        nameAr: data.nameAr,
        slug,
        genericName: data.genericName,
        price: data.price !== undefined ? toMoneyString(data.price) : undefined,
        buyPrice: data.buyPrice !== undefined ? toMoneyString(data.buyPrice) : undefined,
        quantity: data.quantity,
        instock: data.instock,
        strength: data.strength,
        leafId: data.leafId,
        typeId: data.typeId,
        purchaseUnitId: data.purchaseUnitId,
        sellUnitId: data.sellUnitId,
        unitConversion:
          data.unitConversion !== undefined ? toFixedString(data.unitConversion, 6) : undefined,
        shelf: data.shelf,
        categoryIds: data.categoryIds,
        barcodes: data.barcodes,
        supplierId: data.supplierId,
        vendorId: data.vendorId,
        kind: data.kind,
        vat: data.vat !== undefined ? toMoneyString(data.vat) : undefined,
        discount: data.discount !== undefined ? toMoneyString(data.discount) : undefined,
        taxMode: data.taxMode,
        description: data.description,
        status: data.status,
        image: data.image,
        igta: data.igta,
        hnsCode: data.hnsCode,
        reorderLevel: data.reorderLevel,
        minStock: data.minStock,
        maxStock: data.maxStock,
      },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.medicine.delete({ where: { id } });
    return { message: 'Medicine deleted' };
  },

  async suggestBarcode(shopId: number, prefix?: string) {
    const existing = await prisma.medicine.findMany({
      where: { shopId },
      select: { barcodes: true },
    });
    const used = new Set(
      existing.flatMap((m) => (Array.isArray(m.barcodes) ? (m.barcodes as string[]) : [])),
    );

    const base = (prefix ?? '2').replace(/\D/g, '').slice(0, 3) || '2';
    let barcode = '';
    do {
      const randomDigits = Array.from({ length: 12 - base.length }, () =>
        Math.floor(Math.random() * 10),
      ).join('');
      const digits = `${base}${randomDigits}`;
      barcode = `${digits}${computeEan13CheckDigit(digits)}`;
    } while (used.has(barcode));

    return { barcode };
  },
};

function computeEan13CheckDigit(digits12: string): number {
  const sum = digits12
    .split('')
    .map(Number)
    .reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}
