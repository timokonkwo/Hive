// Never expose RPC URLs, signed payloads, or raw provider errors to the browser.
export function publicClaimError(error) {
  const message = error?.message ?? '';
  const rules = [
    [/Registration not found/, 'REGISTRATION_NOT_FOUND', 'Your claim needs to be resumed.', 'resume'],
    [/window closed|request expired|not open|deadline|expired/i, 'CLAIM_WINDOW', 'This claim window has ended.', 'check_status'],
    [/paused|not ready|unavailable|fetch|timeout|network/i, 'SERVICE_UNAVAILABLE', 'Connection interrupted. Your claim is saved.', 'check_status'],
    [/holding|balance|spendable|allowance|insufficient/i, 'BALANCE_CHANGED', 'Your available HIVE has changed. Check your balance.', 'check_balance'],
    [/different registration|terms differ|reservation/i, 'CLAIM_EXISTS', 'A claim already exists for this wallet. Continue that claim.', 'check_status'],
    [/signature|authorization/i, 'AUTHORIZATION_REQUIRED', 'Wallet authorization could not be verified.', 'reconnect'],
  ];
  for (const [pattern, code, text, recovery] of rules) if (pattern.test(message)) return { code, error:text, recovery };
  return { code:'CLAIM_UNVERIFIED', error:'Your claim could not be verified. Check its status before continuing.', recovery:'check_status' };
}
