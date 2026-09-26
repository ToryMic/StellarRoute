'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { emitAgentTelemetry, type AgentIntentKind } from './telemetry';
import { CheckCircle2, X } from 'lucide-react';

export interface ParsedAgentIntent {
  kind: AgentIntentKind;
  summary?: string;
  fromAsset?: string;
  toAsset?: string;
  amount?: string;
  recipient?: string;
  sourceChain?: string;
  destinationChain?: string;
  fiatCurrency?: string;
  interval?: string;
}

export interface IntentPreviewCardProps {
  intent: ParsedAgentIntent;
  onConfirm?: (intent: ParsedAgentIntent) => void;
  onCancel?: (intent: ParsedAgentIntent) => void;
  className?: string;
}

function formatIntentSummary(intent: ParsedAgentIntent): string {
  if (intent.summary) return intent.summary;
  switch (intent.kind) {
    case 'convert':
      return `Convert ${intent.amount ?? ''} ${intent.fromAsset ?? ''} to ${intent.toAsset ?? ''}`.trim();
    case 'send':
      return `Send ${intent.amount ?? ''} ${intent.fromAsset ?? ''} to ${intent.recipient ?? ''}`.trim();
    case 'receive':
      return `Receive ${intent.amount ? intent.amount + ' ' : ''}${intent.fromAsset ?? 'assets'}`.trim();
    case 'bridge':
      return `Bridge ${intent.amount ?? ''} ${intent.fromAsset ?? ''} to ${intent.destinationChain ?? ''}`.trim();
    case 'offramp':
      return `Cash out ${intent.amount ?? ''} ${intent.fromAsset ?? ''} to ${intent.fiatCurrency ?? ''}`.trim();
    case 'subscribe':
      return `Subscribe ${intent.amount ?? ''} ${intent.fromAsset ?? ''} (${intent.interval ?? 'recurring'})`.trim();
    case 'balance':
      return `Check balance for ${intent.fromAsset ?? 'wallet'}`.trim();
    default:
      return `${intent.kind} request`;
  }
}

export function IntentPreviewCard({
  intent,
  onConfirm,
  onCancel,
  className,
}: IntentPreviewCardProps) {
  const [confirmed, setConfirmed] = React.useState(false);

  const handleConfirm = React.useCallback(() => {
    if (confirmed) return;
    setConfirmed(true);
    emitAgentTelemetry('agent_confirm', intent.kind);
    onConfirm?.(intent);
  }, [confirmed, intent, onConfirm]);

  const handleCancel = React.useCallback(() => {
    emitAgentTelemetry('agent_cancel', intent.kind);
    onCancel?.(intent);
  }, [intent, onCancel]);

  return (
    <div
      data-testid="intent-preview-card"
      className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
          {intent.kind} preview
        </span>
        {confirmed && (
          <span
            data-testid="confirmed-status"
            className="text-xs font-medium text-emerald-500"
          >
            Confirmed
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-card-foreground" data-testid="intent-description">
        {formatIntentSummary(intent)}
      </p>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="default"
          size="sm"
          onClick={handleConfirm}
          disabled={confirmed}
          data-testid="confirm-btn"
          className="gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirm
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          data-testid="cancel-btn"
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
