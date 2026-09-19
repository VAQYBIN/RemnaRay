import { Controller, Get, Param } from '@nestjs/common';

import { LedgerService } from './ledger.service';

@Controller('api/internal/v1/ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('users/:userId/available')
  async available(@Param('userId') userId: string) {
    return { amountMinor: (await this.ledger.available(userId)).toString() };
  }
}
