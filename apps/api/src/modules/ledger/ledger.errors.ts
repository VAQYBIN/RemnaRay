export type LedgerErrorCode = 'INSUFFICIENT_FUNDS' | 'ACCOUNT_NOT_FOUND' | 'INVALID_LEDGER_ENTRY';

export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}
