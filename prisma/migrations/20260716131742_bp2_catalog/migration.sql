-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('inventory', 'ecommerce', 'global');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('inventory', 'ecommerce');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('pos', 'sale');

-- CreateEnum
CREATE TYPE "LedgerInvoiceType" AS ENUM ('sale', 'purchase', 'expense', 'manual', 'sale_return', 'purchase_return');

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "due" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "gender" TEXT DEFAULT 'Male',
    "age" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "due" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "due" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "payable" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CategoryKind" NOT NULL DEFAULT 'inventory',
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "sorting" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "banner" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_types" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "qr_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "slug" TEXT,
    "generic_name" TEXT,
    "price" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "buy_price" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "instock" INTEGER NOT NULL DEFAULT 0,
    "strength" TEXT,
    "leaf_id" INTEGER,
    "type_id" INTEGER,
    "purchase_unit_id" INTEGER,
    "sell_unit_id" INTEGER,
    "unit_conversion" DECIMAL(20,6) NOT NULL DEFAULT 1,
    "shelf" TEXT,
    "category_ids" JSONB NOT NULL DEFAULT '[]',
    "barcodes" JSONB NOT NULL DEFAULT '[]',
    "supplier_id" INTEGER,
    "vendor_id" INTEGER,
    "type" "ProductKind" NOT NULL DEFAULT 'inventory',
    "vat" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "tax_mode" "TaxMode",
    "description" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "image" TEXT,
    "igta" TEXT,
    "hns_code" TEXT,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "max_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT,
    "medicine_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "purchase_qty" INTEGER NOT NULL,
    "expire" DATE,
    "manufactured_at" DATE,
    "leaf_id" INTEGER,
    "inv_id" TEXT,
    "price" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "buy_price" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "discount_value_type" "DiscountType",
    "sub_total" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "purchase_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "method_id" INTEGER,
    "inv_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(20,2) NOT NULL,
    "paid_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "due_price" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "change_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "medicines" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_pays" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "method_id" INTEGER NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_pays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "medicines" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "method_id" INTEGER NOT NULL,
    "inv_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "address" TEXT,
    "date" DATE NOT NULL,
    "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(20,2) NOT NULL,
    "paid_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "due_price" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "returned_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "type" "InvoiceType" NOT NULL DEFAULT 'pos',
    "status" INTEGER NOT NULL DEFAULT 0,
    "medicines" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_pays" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "method_id" INTEGER NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "medicines" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_carts" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "method_id" INTEGER,
    "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_expenses" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "account_id" INTEGER,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "serial" INTEGER NOT NULL DEFAULT 1,
    "is_deletable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "account_type_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "serial" INTEGER NOT NULL DEFAULT 1,
    "is_deletable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" SERIAL NOT NULL,
    "tran_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "debit_account_id" INTEGER NOT NULL,
    "credit_account_id" INTEGER NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "invoice_type" "LedgerInvoiceType",
    "invoice_id" TEXT,
    "particular" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "address" TEXT,
    "hospital" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "age" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "center" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "prescription_no" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "doctor_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "visit_no" INTEGER NOT NULL,
    "visit_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "tests" JSONB NOT NULL,
    "medicines" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "advice" TEXT NOT NULL,
    "prescribed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "receiver_id" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" SERIAL NOT NULL,
    "shop_id" INTEGER,
    "name" TEXT NOT NULL,
    "iso" TEXT NOT NULL,
    "icon" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'active',
    "terms" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_shop_id_idx" ON "customers"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_shop_id_email_key" ON "customers"("shop_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_shop_id_phone_key" ON "customers"("shop_id", "phone");

-- CreateIndex
CREATE INDEX "suppliers_shop_id_idx" ON "suppliers"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_shop_id_phone_key" ON "suppliers"("shop_id", "phone");

-- CreateIndex
CREATE INDEX "vendors_shop_id_idx" ON "vendors"("shop_id");

-- CreateIndex
CREATE INDEX "payment_methods_shop_id_idx" ON "payment_methods"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_shop_id_name_key" ON "payment_methods"("shop_id", "name");

-- CreateIndex
CREATE INDEX "product_categories_shop_id_idx" ON "product_categories"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_shop_id_slug_key" ON "product_categories"("shop_id", "slug");

-- CreateIndex
CREATE INDEX "medicine_types_shop_id_idx" ON "medicine_types"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_types_shop_id_name_key" ON "medicine_types"("shop_id", "name");

-- CreateIndex
CREATE INDEX "units_shop_id_idx" ON "units"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_shop_id_name_key" ON "units"("shop_id", "name");

-- CreateIndex
CREATE INDEX "leaves_shop_id_idx" ON "leaves"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_shop_id_name_key" ON "leaves"("shop_id", "name");

-- CreateIndex
CREATE INDEX "products_shop_id_idx" ON "products"("shop_id");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_shop_id_qr_code_key" ON "products"("shop_id", "qr_code");

-- CreateIndex
CREATE INDEX "batches_shop_id_idx" ON "batches"("shop_id");

-- CreateIndex
CREATE INDEX "batches_medicine_id_idx" ON "batches"("medicine_id");

-- CreateIndex
CREATE INDEX "batches_expire_idx" ON "batches"("expire");

-- CreateIndex
CREATE INDEX "batches_purchase_id_idx" ON "batches"("purchase_id");

-- CreateIndex
CREATE INDEX "purchases_shop_id_idx" ON "purchases"("shop_id");

-- CreateIndex
CREATE INDEX "purchases_supplier_id_idx" ON "purchases"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_shop_id_inv_id_key" ON "purchases"("shop_id", "inv_id");

-- CreateIndex
CREATE INDEX "purchase_pays_shop_id_idx" ON "purchase_pays"("shop_id");

-- CreateIndex
CREATE INDEX "purchase_pays_purchase_id_idx" ON "purchase_pays"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_returns_shop_id_idx" ON "purchase_returns"("shop_id");

-- CreateIndex
CREATE INDEX "purchase_returns_purchase_id_idx" ON "purchase_returns"("purchase_id");

-- CreateIndex
CREATE INDEX "invoices_shop_id_idx" ON "invoices"("shop_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_shop_id_inv_id_key" ON "invoices"("shop_id", "inv_id");

-- CreateIndex
CREATE INDEX "invoice_pays_shop_id_idx" ON "invoice_pays"("shop_id");

-- CreateIndex
CREATE INDEX "invoice_pays_invoice_id_idx" ON "invoice_pays"("invoice_id");

-- CreateIndex
CREATE INDEX "sale_returns_shop_id_idx" ON "sale_returns"("shop_id");

-- CreateIndex
CREATE INDEX "sale_returns_invoice_id_idx" ON "sale_returns"("invoice_id");

-- CreateIndex
CREATE INDEX "pos_carts_shop_id_user_id_idx" ON "pos_carts"("shop_id", "user_id");

-- CreateIndex
CREATE INDEX "expense_categories_shop_id_idx" ON "expense_categories"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_shop_id_name_key" ON "expense_categories"("shop_id", "name");

-- CreateIndex
CREATE INDEX "pharmacy_expenses_shop_id_idx" ON "pharmacy_expenses"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_types_name_key" ON "account_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_tran_id_key" ON "ledger_transactions"("tran_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_date_idx" ON "ledger_transactions"("date");

-- CreateIndex
CREATE INDEX "doctors_shop_id_idx" ON "doctors"("shop_id");

-- CreateIndex
CREATE INDEX "patients_shop_id_idx" ON "patients"("shop_id");

-- CreateIndex
CREATE INDEX "lab_tests_shop_id_idx" ON "lab_tests"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_shop_id_name_key" ON "lab_tests"("shop_id", "name");

-- CreateIndex
CREATE INDEX "prescriptions_shop_id_idx" ON "prescriptions"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_shop_id_prescription_no_key" ON "prescriptions"("shop_id", "prescription_no");

-- CreateIndex
CREATE INDEX "notifications_shop_id_receiver_id_idx" ON "notifications"("shop_id", "receiver_id");

-- CreateIndex
CREATE UNIQUE INDEX "languages_iso_key" ON "languages"("iso");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_types" ADD CONSTRAINT "medicine_types_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_leaf_id_fkey" FOREIGN KEY ("leaf_id") REFERENCES "leaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "medicine_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sell_unit_id_fkey" FOREIGN KEY ("sell_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_leaf_id_fkey" FOREIGN KEY ("leaf_id") REFERENCES "leaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_pays" ADD CONSTRAINT "purchase_pays_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_pays" ADD CONSTRAINT "purchase_pays_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_pays" ADD CONSTRAINT "purchase_pays_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_pays" ADD CONSTRAINT "purchase_pays_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_pays" ADD CONSTRAINT "invoice_pays_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_pays" ADD CONSTRAINT "invoice_pays_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_pays" ADD CONSTRAINT "invoice_pays_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_pays" ADD CONSTRAINT "invoice_pays_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_carts" ADD CONSTRAINT "pos_carts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_expenses" ADD CONSTRAINT "pharmacy_expenses_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_expenses" ADD CONSTRAINT "pharmacy_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_expenses" ADD CONSTRAINT "pharmacy_expenses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "account_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
