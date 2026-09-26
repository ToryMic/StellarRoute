import { authorizeCard, cancelCard, listCards, type CardRecord } from './state';

export class CardConflictError extends Error {
  status: number;
  code: string;

  constructor(message = 'This card cannot accept new authorizations because it has been canceled.') {
    super(message);
    this.name = 'CardConflictError';
    this.status = 409;
    this.code = 'card_canceled';
  }
}

export function listCardApi(cards: CardRecord[]) {
  return listCards(cards).map((card) => {
    if (card.status === 'canceled') {
      const { last4: _removed, ...safeCard } = card;
      return safeCard;
    }

    return card;
  });
}

export function cancelCardApi(card: CardRecord): CardRecord {
  return cancelCard(card);
}

export function authorizeCardApi(card: CardRecord): CardRecord {
  try {
    return authorizeCard(card);
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) {
      throw new CardConflictError(error.message);
    }

    throw error;
  }
}
