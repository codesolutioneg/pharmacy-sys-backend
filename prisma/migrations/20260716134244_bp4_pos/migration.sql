/*
  Warnings:

  - You are about to drop the column `discount` on the `pos_carts` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `pos_carts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pos_carts" DROP COLUMN "discount",
DROP COLUMN "tax",
ADD COLUMN     "invoice_discount_type" "DiscountType" NOT NULL DEFAULT 'fixed',
ADD COLUMN     "invoice_discount_value" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_amount_override" DECIMAL(20,2),
ADD COLUMN     "tax_rate_override" DECIMAL(5,2);
