type RefundableRecord = {
  payment?: {
    jobId?: string;
    expiresAt?: number;
  };
};

export function canRefundBnbEscrow(record: RefundableRecord, nowSeconds = Math.floor(Date.now() / 1000)) {
  return !bnbRefundUnavailableReason(record, nowSeconds);
}

export function bnbRefundUnavailableReason(record: RefundableRecord, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!record.payment?.jobId) return "Payment must be confirmed before refund is available.";
  const expiresAt = record.payment.expiresAt;
  if (!expiresAt) return "";
  if (nowSeconds <= expiresAt) return `Refund unlocks after ${formatRefundUnlockTime(expiresAt)}.`;
  return "";
}

function formatRefundUnlockTime(expiresAt: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date((expiresAt + 1) * 1000));
}
