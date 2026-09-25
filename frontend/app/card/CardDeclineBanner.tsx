"use client";

export interface CardDeclineAuthorization {
  id: string;
  status: string;
  decline_code?: string | null;
  amount?: string | null;
  currency?: string | null;
}

const DECLINE_PLAIN_LANGUAGE: Record<string, string> = {
  insufficient_funds: "There weren’t enough funds to approve this payment.",
  lost_stolen: "This card was reported lost or stolen, so the payment was declined.",
  expired_card: "This card has expired, so the payment was declined.",
  invalid_amount: "The payment amount looked invalid, so it was declined.",
  suspected_fraud: "This payment looked unusual, so it was declined for safety.",
  generic_decline: "The payment was declined by the card partner.",
};

export function declineToPlainLanguage(declineCode?: string | null): string {
  if (!declineCode) return DECLINE_PLAIN_LANGUAGE.generic_decline;
  return DECLINE_PLAIN_LANGUAGE[declineCode] ?? DECLINE_PLAIN_LANGUAGE.generic_decline;
}

export function CardDeclineBanner({
  authorization,
  onDismiss,
}: {
  authorization: CardDeclineAuthorization;
  onDismiss: () => void;
}) {
  const plain = declineToPlainLanguage(authorization.decline_code);
  const amountSuffix =
    authorization.amount != null
      ? ` (${authorization.amount}${authorization.currency ? ` ${authorization.currency}` : ""})`
      : "";

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="card-decline-banner"
      className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-900 dark:text-red-100">
            Latest card payment was declined{amountSuffix}
          </p>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200">{plain}</p>
          {authorization.decline_code ? (
            <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
              Code: {authorization.decline_code}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss decline notice"
          data-testid="card-decline-dismiss"
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-100 dark:text-red-100 dark:hover:bg-red-900/40"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
