export class PaymentError extends Error {
  constructor(
    public readonly code:
      | 'PLAN_UNAVAILABLE'
      | 'PROVIDER_UNAVAILABLE'
      | 'INVOICE_NOT_FOUND'
      | 'INVOICE_NOT_PENDING'
      | 'IDEMPOTENCY_REQUIRED'
      | 'RATE_LIMITED'
      | 'UNDERPAID'
      | 'WEBHOOK_INVALID_SIGNATURE'
      | 'WEBHOOK_NOT_SUPPORTED'
      | 'PAYMENT_PROVIDER_NOT_FOUND',
    message: string = code,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}
