-- CreateEnum
CREATE TYPE "FulfillmentChannel" AS ENUM ('counter', 'delivery');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'assigned', 'out_for_delivery', 'settled', 'cancelled');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "assigned_cashier_id" INTEGER,
ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "delivery_note" TEXT,
ADD COLUMN     "delivery_status" "DeliveryStatus",
ADD COLUMN     "fulfillment_channel" "FulfillmentChannel" NOT NULL DEFAULT 'counter',
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "settled_by_id" INTEGER;

-- AlterTable
ALTER TABLE "pos_carts" ADD COLUMN     "assigned_cashier_id" INTEGER,
ADD COLUMN     "delivery_address" TEXT,
ADD COLUMN     "delivery_name" TEXT,
ADD COLUMN     "delivery_note" TEXT,
ADD COLUMN     "delivery_phone" TEXT,
ADD COLUMN     "is_delivery" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "invoices_shop_id_fulfillment_channel_delivery_status_idx" ON "invoices"("shop_id", "fulfillment_channel", "delivery_status");

-- CreateIndex
CREATE INDEX "invoices_shop_id_assigned_cashier_id_idx" ON "invoices"("shop_id", "assigned_cashier_id");

-- CreateIndex
CREATE INDEX "invoices_created_by_id_idx" ON "invoices"("created_by_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_assigned_cashier_id_fkey" FOREIGN KEY ("assigned_cashier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
