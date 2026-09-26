'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type AgentHealthState = 'available' | 'off' | 'checking';

export interface AgentStatusChipProps {
  className?: string;
  initialState?: AgentHealthState;
}

function getAgentHealthUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) {
    return '/api/v1/agent/health';
  }
  const clean = envUrl.replace(/\/+$/, '');
  if (clean.endsWith('/api/v1')) {
    return `${clean}/agent/health`;
  }
  return `${clean}/api/v1/agent/health`;
}

export function AgentStatusChip({ className, initialState }: AgentStatusChipProps) {
  const [status, setStatus] = React.useState<AgentHealthState>(initialState ?? 'checking');

  React.useEffect(() => {
    if (initialState) return;

    let isMounted = true;
    async function checkHealth() {
      try {
        const url = getAgentHealthUrl();
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!isMounted) return;

        if (res.status === 200) {
          const data = await res.json().catch(() => ({}));
          if (data && data.enabled === false) {
            setStatus('off');
          } else {
            setStatus('available');
          }
        } else {
          // 404 or any other non-200 response reflects fail-closed status: off
          setStatus('off');
        }
      } catch {
        if (isMounted) {
          setStatus('off');
        }
      }
    }

    checkHealth();
    return () => {
      isMounted = false;
    };
  }, [initialState]);

  const isAvailable = status === 'available';

  return (
    <div
      data-testid="agent-status-chip"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        isAvailable
          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
          : 'bg-muted text-muted-foreground border-border',
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60',
        )}
      />
      <span data-testid="agent-status-label">{status === 'checking' ? 'checking' : status}</span>
    </div>
  );
}
