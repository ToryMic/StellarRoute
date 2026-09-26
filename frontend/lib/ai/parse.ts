export type IntentType = 'swap' | 'send' | 'receive' | 'bridge' | 'cash_out' | 'pay';

export interface Intent {
  type: IntentType;
  amount: string;
  asset: string;
  recipient?: string;
  destination?: string;
  source?: string;
  currency?: string;
  recurrence?: string;
}

export type Clarification = {
  kind: 'clarification';
  message: string;
};

export type ParseResult = Intent | Clarification;

function getMatch(text: string, regex: RegExp): RegExpMatchArray | null {
  return text.match(regex);
}

export function parseIntent(text: string): ParseResult {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'receive') {
    return { type: 'receive', amount: '', asset: '' };
  }

  if (lower.startsWith('swap')) {
    const m = getMatch(trimmed, /swap\s+(\d+)\s+(\S+)\s+to\s+(\S+)/i);
    if (m) {
      return { type: 'swap', amount: m[1], asset: m[2], destination: m[3] };
    }
    const missingAmount = getMatch(trimmed, /swap\s+(\S+)\s+to\s+(\S+)/i);
    if (missingAmount) {
      return { kind: 'clarification', message: 'I need an amount to proceed.' };
    }
    return { kind: 'clarification', message: 'Specify what to swap and what to receive.' };
  }

  if (lower.startsWith('send')) {
    const m = getMatch(trimmed, /send\s+(\d+)\s+(\S+)\s+to\s+(G\w+)/i);
    if (m) {
      return { type: 'send', amount: m[1], asset: m[2], recipient: m[3] };
    }
    return { kind: 'clarification', message: 'Specify who to send to.' };
  }

  if (lower.startsWith('bridge')) {
    const toM = getMatch(trimmed, /bridge\s+(\d+)\s+(\S+)\s+to\s+(\S+)/i);
    const fromM = getMatch(trimmed, /bridge\s+(\d+)\s+(\S+)\s+from\s+(\S+)/i);
    if (toM) {
      return { type: 'bridge', amount: toM[1], asset: toM[2], destination: toM[3] };
    }
    if (fromM) {
      return { type: 'bridge', amount: fromM[1], asset: fromM[2], source: fromM[3] };
    }
    return { kind: 'clarification', message: 'Specify what to bridge and where.' };
  }

  if (lower.startsWith('cash out')) {
    const m = getMatch(trimmed, /cash\s+out\s+(\d+)\s+(\S+)\s+to\s+(\S+)/i);
    if (m) {
      return { type: 'cash_out', amount: m[1], asset: m[2], currency: m[3] };
    }
    return { kind: 'clarification', message: 'Specify what to cash out and to which currency.' };
  }

  if (lower.startsWith('pay')) {
    const m = getMatch(trimmed, /pay\s+(\d+)\s+(\S+)\s+(monthly|weekly|yearly)\s+to\s+(G\w+)/i);
    if (m) {
      return { type: 'pay', amount: m[1], asset: m[2], recurrence: m[3], recipient: m[4] };
    }
    return { kind: 'clarification', message: 'Specify who to pay and how often.' };
  }

  return { kind: 'clarification', message: "I'm not sure what you'd like to do." };
}
