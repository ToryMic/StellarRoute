export type CardStatus = 'active' | 'canceled';

export interface CardRecord {
  id: string;
  status: CardStatus;
  last4?: string;
  availableBalance: number;
  ledgerBalance: number;
}

export function isCanceledCard(card: Pick<CardRecord, 'status'>): boolean {
  return card.status === 'canceled';
}

export function cancelCard(card: CardRecord): CardRecord {
  return {
    ...card,
    status: 'canceled',
    last4: undefined,
    availableBalance: card.availableBalance,
    ledgerBalance: card.ledgerBalance,
  };
}

export function listCards(cards: CardRecord[]): CardRecord[] {
  return cards.map((card) => {
    if (card.status !== 'canceled') {
      return card;
    }

    return {
      ...card,
      last4: undefined,
    };
  });
}

export function canAuthorizeCard(card: Pick<CardRecord, 'status'>): boolean {
  return card.status !== 'canceled';
}

export function authorizeCard(card: CardRecord): CardRecord {
  if (!canAuthorizeCard(card)) {
    const error = new Error('New authorizations are not allowed for a canceled card.');
    Object.assign(error, {
      name: 'CardAuthorizationConflictError',
      status: 409,
      code: 'card_canceled',
    });
    throw error;
  }

  return card;
}

export function getAvailableBalanceAfterCancel(card: CardRecord): number {
  return card.availableBalance;
}
