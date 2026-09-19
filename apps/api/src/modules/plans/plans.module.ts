import { Module } from '@nestjs/common';

import { Infrastructure } from '../../infra/infra.module';
import { PlansAdminController, PublicPlansController } from './plans.controller';
import { PlansRepository } from './plans.repository';
import { PlansService } from './plans.service';

@Module({
  controllers: [PlansAdminController, PublicPlansController],
  providers: [
    {
      provide: PlansRepository,
      inject: [Infrastructure],
      useFactory: (infra: Infrastructure) => new PlansRepository(infra.db, infra.redis),
    },
    {
      provide: PlansService,
      inject: [PlansRepository],
      useFactory: (repository: PlansRepository) => new PlansService(repository),
    },
  ],
  exports: [PlansService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PlansModule {}
