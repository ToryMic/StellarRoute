export interface InsufficientUsdcCardCopy {
  kind: 'insufficient_usdc';
  headline: string;
  shortfall: string;
  nextStep: string;
}

export type InsufficientUsdcInput =
  | number
  | string
  | {
      insufficient?: boolean;
      shortfall?: number | string;
      shortfallUsdc?: number | string;
      amount?: number | string;
      usdcShortfall?: number | string;
    };

const formatUsdcAmount = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

function normalizeShortfall(value: InsufficientUsdcInput | null | undefined): number {
  if (!value && value !== 0) {
    return 0;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  if (typeof value === 'object') {
    const candidates = [
      value.shortfallUsdc,
      value.shortfall,
      value.usdcShortfall,
      value.amount,
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }
  }

  return 0;
}

export function getInsufficientUsdcCopy(
  value: InsufficientUsdcInput | null | undefined,
): InsufficientUsdcCardCopy | null {
  const candidate = value && typeof value === 'object' && 'insufficient' in value ? value : null;

  if (candidate && candidate.insufficient === false) {
    return null;
  }

  const shortfall = normalizeShortfall(value);

  if (shortfall <= 0) {
    return null;
  }

  return {
    kind: 'insufficient_usdc',
    headline: 'Insufficient USDC balance',
    shortfall: `You need ${formatUsdcAmount(shortfall)} more USDC to complete this swap.`,
    nextStep: 'Lower the amount and try again.',
  };
}

export const buildInsufficientUsdcCardCopy = getInsufficientUsdcCopy;
export const getInsufficientUsdCopy = getInsufficientUsdcCopy;
export const getInsufficientUsdcCardCopy = getInsufficientUsdcCopy;
export const insufficientUsdcCopy = getInsufficientUsdcCopy;

export function formatUsdcShortfall(value: number | string): string {
  return formatUsdcAmount(normalizeShortfall(value));
}
