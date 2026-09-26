import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentStatusChip } from './AgentStatusChip';

describe('AgentStatusChip (#1455)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders available when GET /api/v1/agent/health returns 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ enabled: true, execution: 'preview_only' }),
    } as Response);

    render(<AgentStatusChip />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('available');
    });

    const chip = screen.getByTestId('agent-status-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('available');
  });

  it('renders off when GET /api/v1/agent/health returns 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: async () => ({ error: 'Not Found' }),
    } as Response);

    render(<AgentStatusChip />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('off');
    });

    const chip = screen.getByTestId('agent-status-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('off');
  });

  it('renders off when network request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network offline'));

    render(<AgentStatusChip />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-status-label')).toHaveTextContent('off');
    });
  });

  it('renders initial state without network call when provided', () => {
    render(<AgentStatusChip initialState="available" />);
    expect(screen.getByTestId('agent-status-label')).toHaveTextContent('available');
    expect(fetch).not.toHaveBeenCalled();
  });
});
