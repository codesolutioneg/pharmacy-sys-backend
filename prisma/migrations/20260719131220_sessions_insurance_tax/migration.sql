-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('open', 'closed');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "insurance_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_company_id" INTEGER,
ADD COLUMN     "insurance_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "session_id" INTEGER,
ADD COLUMN     "tax_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "is_insurance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pos_carts" ADD COLUMN     "insurance_company_id" INTEGER,
ADD COLUMN     "insurance_percent" DECIMAL(5,2),
ADD COLUMN     "patient_method_id" INTEGER;

-- CreateTable
CREATE TABLE "insurance_companies" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "default_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "due" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'open',
    "opening_float" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "counted_cash" DECIMAL(20,2),
    "expected_cash" DECIMAL(20,2),
    "difference" DECIMAL(20,2),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_companies_shop_id_idx" ON "insurance_companies"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_companies_shop_id_name_key" ON "insurance_companies"("shop_id", "name");

-- CreateIndex
CREATE INDEX "pos_sessions_shop_id_user_id_idx" ON "pos_sessions"("shop_id", "user_id");

-- CreateIndex
CREATE INDEX "pos_sessions_shop_id_status_idx" ON "pos_sessions"("shop_id", "status");

-- CreateIndex
CREATE INDEX "invoices_session_id_idx" ON "invoices"("session_id");

-- CreateIndex
CREATE INDEX "invoices_insurance_company_id_idx" ON "invoices"("insurance_company_id");

-- AddForeignKey
ALTER TABLE "insurance_companies" ADD CONSTRAINT "insurance_companies_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_insurance_company_id_fkey" FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_insurance_company_id_fkey" FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One open session per user per shop (DB-level duplicate prevention)
CREATE UNIQUE INDEX "pos_sessions_one_open_per_user"
ON "pos_sessions" ("shop_id", "user_id")
WHERE "status" = 'open';
