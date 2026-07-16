-- DropForeignKey
ALTER TABLE "purchase_pays" DROP CONSTRAINT "purchase_pays_method_id_fkey";

-- AlterTable
ALTER TABLE "purchase_pays" ALTER COLUMN "method_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "purchase_drafts" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "supplier_id" INTEGER,
    "method_id" INTEGER,
    "paid_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "invoice_discount_value" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "invoice_discount_type" "DiscountType" NOT NULL DEFAULT 'fixed',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_drafts_shop_id_idx" ON "purchase_drafts"("shop_id");

-- CreateIndex
CREATE INDEX "purchase_drafts_user_id_idx" ON "purchase_drafts"("user_id");

-- AddForeignKey
ALTER TABLE "purchase_pays" ADD CONSTRAINT "purchase_pays_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_drafts" ADD CONSTRAINT "purchase_drafts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
