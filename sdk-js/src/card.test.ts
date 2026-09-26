import { describe, expect, it, vi, afterEach } from 'vitest';
import { StellarRouteClient } from './client.js';
import type { CardAuthorization } from './types.js';

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('cardHealth', () => {
  it('returns enabled health on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ok({ data: { enabled: true } }),
    );
    const result = await new StellarRouteClient().cardHealth();
    expect(result.enabled).toBe(true);
  });

  it('404 health is disabled (does not throw)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      apiError('not_found', 'card disabled', 404),
    );
    const result = await new StellarRouteClient({ retries: 0 }).cardHealth();
    expect(result).toEqual({ enabled: false });
  });

  it('calls the correct endpoint', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ enabled: true }));
    await new StellarRouteClient({
      baseUrl: 'https://api.example.com',
    }).cardHealth();
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.example.com/api/v1/card/health',
    );
  });
});

describe('validateCardApplication', () => {
  it('posts the draft and returns validation', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ok({ data: { valid: true, applicant_ref: 'ref-1' } }),
    );
    const result = await new StellarRouteClient().validateCardApplication({
      applicant_ref: 'ref-1',
      display_name: 'Ada',
    });
    expect(result.valid).toBe(true);
    expect(result.applicant_ref).toBe('ref-1');
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body as string).toContain('ref-1');
  });
});

describe('listCardAuthorizations', () => {
  const fixture: CardAuthorization[] = [
    {
      id: 'auth-1',
      status: 'declined',
      decline_code: 'insufficient_funds',
      amount: '12.50',
      currency: 'USD',
      created_at: '2026-09-25T00:00:00Z',
    },
    { id: 'auth-2', status: 'approved', amount: '5.00', currency: 'USD' },
  ];

  it('returns the fixture array (envelope shape)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ok({ data: { authorizations: fixture, total: 2 } }),
    );
    const result = await new StellarRouteClient().listCardAuthorizations();
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('auth-1');
    expect(result[0]?.decline_code).toBe('insufficient_funds');
  });

  it('returns the fixture array (bare array shape)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ok(fixture));
    const result = await new StellarRouteClient().listCardAuthorizations();
    expect(result).toEqual(fixture);
  });

  it('calls the correct endpoint', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(ok({ authorizations: [], total: 0 }));
    await new StellarRouteClient().listCardAuthorizations();
    expect(spy.mock.calls[0]?.[0] as string).toContain(
      '/api/v1/card/authorizations',
    );
  });
});
