import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

/**
 * The finance (moliya) module — the director panel's `/director/finance`
 * section: the income ledger (completed payments), the expense book (CRUD),
 * and the debt view (orders on credit + staff-recorded partial payments).
 * Reuses `Payment` / `Order` rather than adding a parallel ledger; `Expense`
 * is the only new table.
 */
@Module({
  imports: [AuditModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
