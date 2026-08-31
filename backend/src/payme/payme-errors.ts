/**
 * Error codes confirmed against developer.help.paycom.uz's Merchant API
 * error-reference page this session. The -31050..-31099 "account error"
 * family covers several distinct conditions (order not found, order
 * already has a pending transaction, ...) but the public docs give only
 * the family's meaning, not each sub-code — every use below picks -31050
 * as that family's general representative rather than guessing a specific
 * sub-code; revisit once Payme's sandbox reports back a real expected value.
 */
export const PAYME_ERROR = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  ACCOUNT_ERROR: -31050,
  SYSTEM_ERROR: -32400,
} as const;
