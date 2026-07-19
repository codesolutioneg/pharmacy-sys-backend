import { Router } from 'express';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { permissionsRouter, rolesRouter } from './roles.routes';
import { settingsRouter, shopRouter } from './settings.routes';
import { paymentMethodsRouter } from './payment-methods.routes';
import { customersRouter } from './customers.routes';
import { suppliersRouter } from './suppliers.routes';
import { vendorsRouter } from './vendors.routes';
import { productCategoriesRouter } from './product-categories.routes';
import { medicineTypesRouter } from './medicine-types.routes';
import { unitsRouter } from './units.routes';
import { leavesRouter } from './leaves.routes';
import { medicinesRouter } from './medicines.routes';
import { purchasesRouter } from './purchases.routes';
import { purchaseReturnsRouter } from './purchase-returns.routes';
import { batchesRouter, stockRouter } from './stock.routes';
import { posCartRouter } from './pos-cart.routes';
import { posSessionRouter } from './pos-session.routes';
import { invoicesRouter } from './invoices.routes';
import { doctorsRouter } from './doctors.routes';
import { patientsRouter } from './patients.routes';
import { labTestsRouter } from './lab-tests.routes';
import { prescriptionsRouter } from './prescriptions.routes';
import { expenseCategoriesRouter, expensesRouter } from './expenses.routes';
import {
  accountTypesRouter,
  accountsRouter,
  accountingReportsRouter,
  ledgerTransactionsRouter,
} from './accounting.routes';
import { languagesRouter } from './languages.routes';
import { notificationsRouter } from './notifications.routes';
import { reportsRouter } from './reports.routes';
import { dashboardRouter } from './dashboard.routes';
import { insuranceCompaniesRouter } from './insurance-companies.routes';
import { deliveryRouter } from './delivery.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/permissions', permissionsRouter);
v1Router.use('/settings', settingsRouter);
v1Router.use('/shop', shopRouter);
v1Router.use('/payment-methods', paymentMethodsRouter);
v1Router.use('/customers', customersRouter);
v1Router.use('/suppliers', suppliersRouter);
v1Router.use('/vendors', vendorsRouter);
v1Router.use('/product-categories', productCategoriesRouter);
v1Router.use('/medicine-types', medicineTypesRouter);
v1Router.use('/units', unitsRouter);
v1Router.use('/leaves', leavesRouter);
v1Router.use('/medicines', medicinesRouter);
v1Router.use('/purchases', purchasesRouter);
v1Router.use('/purchase-returns', purchaseReturnsRouter);
v1Router.use('/batches', batchesRouter);
v1Router.use('/stock', stockRouter);
v1Router.use('/pos', posSessionRouter);
v1Router.use('/pos', posCartRouter);
v1Router.use('/invoices', invoicesRouter);
v1Router.use('/doctors', doctorsRouter);
v1Router.use('/patients', patientsRouter);
v1Router.use('/lab-tests', labTestsRouter);
v1Router.use('/prescriptions', prescriptionsRouter);
v1Router.use('/expense-categories', expenseCategoriesRouter);
v1Router.use('/expenses', expensesRouter);
v1Router.use('/account-types', accountTypesRouter);
v1Router.use('/accounts', accountsRouter);
v1Router.use('/ledger-transactions', ledgerTransactionsRouter);
v1Router.use('/reports/accounting', accountingReportsRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/languages', languagesRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/insurance-companies', insuranceCompaniesRouter);
v1Router.use('/delivery/orders', deliveryRouter);
