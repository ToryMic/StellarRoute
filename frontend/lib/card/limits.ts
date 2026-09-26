export interface CardLimitApplication {
  programMax: number;
  userCap?: number | null;
  holds?: number;
}

export interface CardLimitUpdate {
  application: CardLimitApplication;
  nextUserCap: number | null | undefined;
}

export function normalizeCardLimit(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 0;
  }

  return Number(value);
}

export function getEffectiveUserCap(application: Pick<CardLimitApplication, 'programMax' | 'userCap'>): number {
  const programMax = normalizeCardLimit(application.programMax);
  const userCap = normalizeCardLimit(application.userCap);

  return Math.min(userCap, programMax);
}

export function isUserCapWithinProgramMax(
  application: Pick<CardLimitApplication, 'programMax' | 'userCap'>,
): boolean {
  const programMax = normalizeCardLimit(application.programMax);
  const userCap = normalizeCardLimit(application.userCap);

  return userCap <= programMax;
}

export function applyUserCap(
  application: CardLimitApplication,
  nextUserCap: number | null | undefined,
): CardLimitApplication {
  const programMax = normalizeCardLimit(application.programMax);
  const nextCap = normalizeCardLimit(nextUserCap);

  if (nextUserCap !== undefined && nextUserCap !== null && nextCap > programMax) {
    throw new Error('User cap cannot exceed the program max.');
  }

  return {
    ...application,
    userCap: nextUserCap === undefined || nextUserCap === null ? application.userCap : nextCap,
    holds: application.holds ?? 0,
  };
}

export function getCardLimitStatus(application: CardLimitApplication): {
  effectiveCap: number;
  userCap: number;
  programMax: number;
  isWithinProgramMax: boolean;
} {
  const programMax = normalizeCardLimit(application.programMax);
  const userCap = normalizeCardLimit(application.userCap);
  const effectiveCap = getEffectiveUserCap(application);

  return {
    effectiveCap,
    userCap,
    programMax,
    isWithinProgramMax: userCap <= programMax,
  };
}

export function lowerUserCapWithoutChangingHolds(
  application: CardLimitApplication,
  nextUserCap: number | null | undefined,
): CardLimitApplication {
  const updated = applyUserCap(application, nextUserCap);

  return {
    ...updated,
    holds: application.holds ?? 0,
  };
}
