import { Injectable } from '@nestjs/common';

import type { LedgerPost, LedgerRepositoryPort, LedgerTransaction } from './ledger.repository';

@Injectable()
export class LedgerService {
  constructor(private readonly repository: LedgerRepositoryPort) {}

  post(input: LedgerPost): Promise<LedgerTransaction> {
    return this.repository.post(input);
  }

  available(userId: string): Promise<bigint> {
    return this.repository.available(userId);
  }

  audit() {
    return this.repository.audit();
  }
}
