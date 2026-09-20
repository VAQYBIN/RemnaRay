import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AdminRole } from '@remnaray/domain/rbac';

import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guards';
import { Permissions, Roles } from '../admin/admin.rbac';
import { Audit } from '../admin/audit.interceptor';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminUsersService } from './admin-users.service';
import { DashboardService } from './dashboard.service';

function acting(request: AuthenticatedRequest): { id: string; role: AdminRole } {
  return { id: request.admin?.id ?? '', role: (request.admin?.role ?? 'operator') as AdminRole };
}

@Controller('api/admin/v1/dashboard')
@UseGuards(AuthGuard)
@Permissions('dashboard.read')
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@Query() query: unknown) {
    return this.dashboard.overview(query);
  }

  @Get('series')
  series(@Query() query: unknown) {
    return this.dashboard.series(query);
  }

  @Get('attention')
  attention() {
    return this.dashboard.attention();
  }
}

@Controller('api/admin/v1/users')
@UseGuards(AuthGuard)
@Permissions('users.read')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.users.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Get(':id/transactions')
  transactions(@Param('id') id: string) {
    return this.users.transactions(id);
  }

  @Get(':id/invoices')
  invoices(@Param('id') id: string) {
    return this.users.invoices(id);
  }

  @Get(':id/audit')
  audit(@Param('id') id: string) {
    return this.users.audit(id);
  }

  @Get(':id/referrals')
  referrals(@Param('id') id: string) {
    return this.users.referrals(id);
  }

  @Post(':id/extend')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.extend', 'user', 'id')
  extend(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.users.extend(id, body, acting(request));
  }

  @Post(':id/set-plan')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.set-plan', 'user', 'id')
  setPlan(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.users.setPlan(id, body, acting(request));
  }

  @Post(':id/balance')
  @HttpCode(200)
  @Permissions('users.balance.credit')
  @Audit('users.balance', 'user', 'id')
  balance(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.users.adjustBalance(id, body, acting(request));
  }

  @Post(':id/ban')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.ban', 'user', 'id')
  ban(@Param('id') id: string, @Body() body: unknown) {
    return this.users.ban(id, body);
  }

  @Post(':id/unban')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.unban', 'user', 'id')
  unban(@Param('id') id: string, @Body() body: unknown) {
    return this.users.unban(id, body);
  }

  @Post(':id/revoke-link')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.revoke-link', 'user', 'id')
  revokeLink(@Param('id') id: string) {
    return this.users.revokeLink(id);
  }

  @Post(':id/reset-traffic')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.reset-traffic', 'user', 'id')
  resetTraffic(@Param('id') id: string) {
    return this.users.resetTraffic(id);
  }

  @Post(':id/message')
  @HttpCode(200)
  @Permissions('users.mutate')
  @Audit('users.message', 'user', 'id')
  message(@Param('id') id: string, @Body() body: unknown) {
    return this.users.message(id, body);
  }

  @Patch(':id/notes')
  @Permissions('users.mutate')
  @Audit('users.notes', 'user', 'id')
  notes(@Param('id') id: string, @Body() body: unknown) {
    return this.users.setNotes(id, body);
  }

  @Post(':id/anonymize')
  @HttpCode(200)
  @Roles('admin')
  @Permissions('users.anonymize')
  @Audit('users.anonymize', 'user', 'id')
  anonymize(@Param('id') id: string, @Body() body: unknown) {
    return this.users.anonymize(id, body);
  }
}

@Controller('api/admin/v1')
@UseGuards(AuthGuard)
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get('invoices')
  @Permissions('payments.read')
  invoices(@Query() query: unknown) {
    return this.payments.invoices(query);
  }

  @Get('invoices/:id')
  @Permissions('payments.read')
  invoice(@Param('id') id: string) {
    return this.payments.invoice(id);
  }

  @Post('invoices/:id/recheck')
  @HttpCode(200)
  @Permissions('payments.recheck')
  @Audit('payments.recheck', 'invoice', 'id')
  recheck(@Param('id') id: string) {
    return this.payments.recheck(id);
  }

  @Get('transactions')
  @Permissions('payments.read')
  transactions(@Query() query: unknown) {
    return this.payments.transactions(query);
  }

  @Post('transactions/:id/refund')
  @HttpCode(200)
  @Permissions('payments.refund')
  @Audit('payments.refund', 'transaction', 'id')
  refund(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.payments.refund(id, body, acting(request));
  }

  @Get('subscriptions')
  @Permissions('subscriptions.read')
  subscriptions(@Query() query: unknown) {
    return this.payments.subscriptions(query);
  }

  @Post('subscriptions/bulk-extend')
  @HttpCode(200)
  @Roles('admin')
  @Permissions('subscriptions.bulk')
  @Audit('subscriptions.bulk-extend', 'subscription')
  bulkExtend(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.payments.bulkExtend(body, acting(request));
  }
}
