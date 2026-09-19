export type SubscriptionErrorCode =
  | 'TRIAL_ALREADY_USED'
  | 'TRIAL_DISABLED'
  | 'TRIAL_NOT_ELIGIBLE'
  | 'PLAN_UNAVAILABLE'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'PLAN_CHANGE_NOT_ALLOWED';

export class SubscriptionError extends Error {
  constructor(readonly code: SubscriptionErrorCode) {
    super(code);
  }
}
