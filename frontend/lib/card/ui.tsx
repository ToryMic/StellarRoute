import type { ReactNode } from 'react';

import type { CardRecord } from './state';

export interface CardSummaryProps {
  card: CardRecord;
  children?: ReactNode;
}

export function CardSummary({ card, children }: CardSummaryProps) {
  const last4Label = card.status === 'canceled' ? 'Hidden' : card.last4 ? `•••• ${card.last4}` : 'Unavailable';

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>
        <strong>Status:</strong> {card.status === 'canceled' ? 'Canceled' : 'Active'}
      </div>
      <div>
        <strong>Last4:</strong> {last4Label}
      </div>
      <div>
        <strong>Available balance:</strong> {card.availableBalance.toFixed(2)}
      </div>
      {children}
    </div>
  );
}

export function CanceledCardNotice({ card }: { card: CardRecord }) {
  if (card.status !== 'canceled') {
    return null;
  }

  return (
    <div role="status" aria-live="polite">
      Card canceled. Last4 is hidden and new authorizations are rejected.
    </div>
  );
}
