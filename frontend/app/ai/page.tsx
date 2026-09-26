'use client';

import * as React from 'react';
import { AgentStatusChip } from './AgentStatusChip';
import { AgentChat } from './AgentChat';

function isAiAgentEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const flags = (window as unknown as { __STELLAR_ROUTE_FLAGS__?: Record<string, boolean> })
      .__STELLAR_ROUTE_FLAGS__;
    if (flags?.ai_agent !== undefined) {
      return Boolean(flags.ai_agent);
    }
  }
  return process.env.NEXT_PUBLIC_AI_AGENT === 'true' || process.env.NEXT_PUBLIC_AI_AGENT === '1';
}

export default function AiPage() {
  const [enabled, setEnabled] = React.useState<boolean>(false);
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    setEnabled(isAiAgentEnabled());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl" data-testid="ai-page-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl" data-testid="ai-page-disabled">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-card-foreground shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">AI Agent Unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The AI assistant is currently disabled on this deployment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl" data-testid="ai-page-shell">
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Agent</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Non-custodial trading assistant.
            </p>
          </div>
          <AgentStatusChip />
        </div>

        <AgentChat />
      </div>
    </div>
  );
}
