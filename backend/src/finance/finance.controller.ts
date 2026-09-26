import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';
import {
  FinanceSummaryQueryDto,
  QueryDebtsDto,
  QueryExpensesDto,
  QueryPaymentsDto,
} from './dto/finance-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { RecordDebtPaymentDto } from './dto/record-debt-payment.dto';

/**
 * The director's finance cockpit (`/panel/finance`). Money is a director-only
 * concern — every route requires `finance:*`, which only DIRECTOR holds.
 */
@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance:read')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  summary(@Query() query: FinanceSummaryQueryDto) {
    return this.finance.summary(query);
  }

  @Get('payments')
  payments(@Query() query: QueryPaymentsDto) {
    return this.finance.payments(query);
  }

  @Get('expenses')
  listExpenses(@Query() query: QueryExpensesDto) {
    return this.finance.listExpenses(query);
  }

  @Post('expenses')
  createExpense(
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.finance.createExpense(dto, actorId, ip);
  }

  @Patch('expenses/:id')
  updateExpense(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.finance.updateExpense(id, dto, actorId, ip);
  }

  @Delete('expenses/:id')
  deleteExpense(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
  ) {
    return this.finance.deleteExpense(id, actorId, ip);
  }

  @Get('debts')
  debts(@Query() query: QueryDebtsDto) {
    return this.finance.debts(query);
  }

  @Post('debts/:orderId/payments')
  recordDebtPayment(
    @Param('orderId') orderId: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: RecordDebtPaymentDto,
  ) {
    return this.finance.recordDebtPayment(orderId, dto, actorId, ip);
  }
}
