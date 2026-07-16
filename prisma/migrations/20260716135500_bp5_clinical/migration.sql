-- DropForeignKey
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "lab_tests" DROP CONSTRAINT "lab_tests_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "patients" DROP CONSTRAINT "patients_shop_id_fkey";

-- DropIndex
DROP INDEX "doctors_shop_id_idx";

-- DropIndex
DROP INDEX "lab_tests_shop_id_idx";

-- DropIndex
DROP INDEX "lab_tests_shop_id_name_key";

-- DropIndex
DROP INDEX "patients_shop_id_idx";

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "shop_id";

-- AlterTable
ALTER TABLE "lab_tests" DROP COLUMN "shop_id";

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "shop_id";

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_name_key" ON "lab_tests"("name");

