import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  emitAgentTelemetry,
  AGENT_TELEMETRY_EVENT,
  type AgentTelemetryPayload,
} from './telemetry';
import { IntentPreviewCard } from './IntentPreviewCard';

describe('Agent Telemetry (#1456)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('payload keys are strictly and only the event name and kind', () => {
    const payload = emitAgentTelemetry('agent_intent_parsed', 'convert');
    expect(payload).toBeDefined();

    const keys = Object.keys(payload!);
    expect(keys.sort()).toEqual(['eventName', 'kind'].sort());
    expect(payload!.eventName).toBe('agent_intent_parsed');
    expect(payload!.kind).toBe('convert');

    // Confirm that sensitive fields are never in payload keys
    expect(keys).not.toContain('amount');
    expect(keys).not.toContain('memo');
    expect(keys).not.toContain('destination');
    expect(keys).not.toContain('recipient');
  });

  it('emits agent_confirm and agent_cancel with intent kind only', () => {
    const events: AgentTelemetryPayload[] = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<AgentTelemetryPayload>).detail);
    };
    window.addEventListener(AGENT_TELEMETRY_EVENT, listener);

    try {
      emitAgentTelemetry('agent_confirm', 'send');
      emitAgentTelemetry('agent_cancel', 'bridge');

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        eventName: 'agent_confirm',
        kind: 'send',
      });
      expect(events[1]).toEqual({
        eventName: 'agent_cancel',
        kind: 'bridge',
      });

      expect(Object.keys(events[0]).sort()).toEqual(['eventName', 'kind'].sort());
      expect(Object.keys(events[1]).sort()).toEqual(['eventName', 'kind'].sort());
    } finally {
      window.removeEventListener(AGENT_TELEMETRY_EVENT, listener);
    }
  });

  it('confirm button in IntentPreviewCard fires once with the kind', () => {
    const listener = vi.fn();
    window.addEventListener(AGENT_TELEMETRY_EVENT, listener as EventListener);

    try {
      render(
        <IntentPreviewCard
          intent={{
            kind: 'convert',
            amount: '10',
            fromAsset: 'XLM',
            toAsset: 'USDC',
          }}
        />,
      );

      const confirmBtn = screen.getByTestId('confirm-btn');

      // Click confirm multiple times
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);

      // Confirm must fire exactly once
      expect(listener).toHaveBeenCalledTimes(1);

      const eventPayload = (listener.mock.calls[0][0] as CustomEvent).detail;
      expect(eventPayload).toEqual({
        eventName: 'agent_confirm',
        kind: 'convert',
      });
      expect(Object.keys(eventPayload).sort()).toEqual(['eventName', 'kind'].sort());
    } finally {
      window.removeEventListener(AGENT_TELEMETRY_EVENT, listener as EventListener);
    }
  });

  it('cancel button in IntentPreviewCard fires agent_cancel with kind', () => {
    const listener = vi.fn();
    window.addEventListener(AGENT_TELEMETRY_EVENT, listener as EventListener);

    try {
      render(
        <IntentPreviewCard
          intent={{
            kind: 'send',
            amount: '5',
            fromAsset: 'USDC',
            recipient: 'GBABC',
          }}
        />,
      );

      const cancelBtn = screen.getByTestId('cancel-btn');
      fireEvent.click(cancelBtn);

      expect(listener).toHaveBeenCalledTimes(1);
      const eventPayload = (listener.mock.calls[0][0] as CustomEvent).detail;
      expect(eventPayload).toEqual({
        eventName: 'agent_cancel',
        kind: 'send',
      });
      expect(Object.keys(eventPayload).sort()).toEqual(['eventName', 'kind'].sort());
    } finally {
      window.removeEventListener(AGENT_TELEMETRY_EVENT, listener as EventListener);
    }
  });

  it('respects NEXT_PUBLIC_TELEMETRY_ENABLED=false', () => {
    vi.stubEnv('NEXT_PUBLIC_TELEMETRY_ENABLED', 'false');
    const listener = vi.fn();
    window.addEventListener(AGENT_TELEMETRY_EVENT, listener as EventListener);

    try {
      const result = emitAgentTelemetry('agent_confirm', 'convert');
      expect(result).toBeUndefined();
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(AGENT_TELEMETRY_EVENT, listener as EventListener);
    }
  });
});
