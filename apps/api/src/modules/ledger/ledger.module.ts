import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { LedgerController } from './ledger.controller';
import { LedgerRepository } from './ledger.repository';
import { LedgerService } from './ledger.service';

@Module({
  controllers: [LedgerController],
  providers: [
    {
      provide: LedgerRepository,
      inject: [Infrastructure],
      useFactory: (infra: Infrastructure) => new LedgerRepository(infra.db),
    },
    {
      provide: LedgerService,
      inject: [LedgerRepository],
      useFactory: (repository: LedgerRepository) => new LedgerService(repository),
    },
  ],
  exports: [LedgerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LedgerModule {}
