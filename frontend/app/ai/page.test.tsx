import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiPage from './page';
import { AGENT_TELEMETRY_EVENT, type AgentTelemetryPayload } from './telemetry';

describe('AiPage (#1455, #1456)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ enabled: true, execution: 'preview_only' }),
    } as Response));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete (window as unknown as { __STELLAR_ROUTE_FLAGS__?: Record<string, boolean> })
      .__STELLAR_ROUTE_FLAGS__;
  });

  it('renders disabled state when flag is unset or false', async () => {
    delete process.env.NEXT_PUBLIC_AI_AGENT;

    render(<AiPage />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-page-disabled')).toBeInTheDocument();
    });

    expect(screen.getByText('AI Agent Unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-status-chip')).not.toBeInTheDocument();
  });

  it('renders status chip and chat shell when flag is enabled', async () => {
    process.env.NEXT_PUBLIC_AI_AGENT = 'true';

    render(<AiPage />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-page-shell')).toBeInTheDocument();
    });

    expect(screen.getByTestId('agent-status-chip')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('available');
    });

    expect(screen.getByTestId('agent-chat-input')).toBeInTheDocument();
  });

  it('renders off on status chip when agent health returns 404', async () => {
    process.env.NEXT_PUBLIC_AI_AGENT = 'true';
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: async () => ({ error: 'Not Found' }),
    } as Response);

    render(<AiPage />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-status-chip')).toBeInTheDocument();
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('off');
    });
  });

  it('submitting prompt parses intent, emits agent_intent_parsed, and shows preview card', async () => {
    process.env.NEXT_PUBLIC_AI_AGENT = 'true';
    const events: AgentTelemetryPayload[] = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<AgentTelemetryPayload>).detail);
    };
    window.addEventListener(AGENT_TELEMETRY_EVENT, listener);

    try {
      render(<AiPage />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-chat-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('agent-chat-input');
      const submit = screen.getByTestId('agent-chat-submit');

      fireEvent.change(input, { target: { value: 'swap 10 XLM to USDC' } });
      fireEvent.click(submit);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        eventName: 'agent_intent_parsed',
        kind: 'convert',
      });
      expect(Object.keys(events[0]).sort()).toEqual(['eventName', 'kind'].sort());

      expect(screen.getByTestId('intent-preview-card')).toBeInTheDocument();
      expect(screen.getByTestId('intent-description')).toHaveTextContent(
        'Convert 10 XLM to USDC',
      );

      // Confirm button emits agent_confirm once with the kind
      const confirmBtn = screen.getByTestId('confirm-btn');
      fireEvent.click(confirmBtn);
      fireEvent.click(confirmBtn);

      expect(events).toHaveLength(2);
      expect(events[1]).toEqual({
        eventName: 'agent_confirm',
        kind: 'convert',
      });
      expect(Object.keys(events[1]).sort()).toEqual(['eventName', 'kind'].sort());
    } finally {
      window.removeEventListener(AGENT_TELEMETRY_EVENT, listener);
    }
  });

  it('canceling card clears it and emits agent_cancel with kind', async () => {
    process.env.NEXT_PUBLIC_AI_AGENT = 'true';
    const events: AgentTelemetryPayload[] = [];
    const listener = (e: Event) => {
      events.push((e as CustomEvent<AgentTelemetryPayload>).detail);
    };
    window.addEventListener(AGENT_TELEMETRY_EVENT, listener);

    try {
      render(<AiPage />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-chat-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('agent-chat-input');
      const submit = screen.getByTestId('agent-chat-submit');

      fireEvent.change(input, { target: { value: 'send 5 USDC to GABC123' } });
      fireEvent.click(submit);

      expect(screen.getByTestId('intent-preview-card')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('cancel-btn');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('intent-preview-card')).not.toBeInTheDocument();

      expect(events).toHaveLength(2);
      expect(events[0].eventName).toBe('agent_intent_parsed');
      expect(events[1]).toEqual({
        eventName: 'agent_cancel',
        kind: 'send',
      });
    } finally {
      window.removeEventListener(AGENT_TELEMETRY_EVENT, listener);
    }
  });
});
