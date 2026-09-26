import { test, expect } from '@playwright/test';

/**
 * CARD-39 Playwright flag-off for /card, /swap, and /offramp
 *
 * Additive-only: new spec only, no production code changes.
 * With CARD_ENABLED unset (default false), production navigation stays
 * Swap, Offramp, Orderbook, History. /card must be disabled (404).
 * /swap and /offramp must still render primary headings.
 * This spec MUST NOT enable the flag.
 */
test.describe('CARD-39 flag-off /card, /swap, and /offramp', () => {
  test('with CARD_ENABLED unset: no Card link, /card disabled, swap and offramp still render', async ({
    page,
  }) => {
    // Do NOT set window.__STELLAR_ROUTE_FLAGS__ or any CARD flag
    await page.goto('/swap');

    // Nav has no Card link
    await expect(
      page.locator('header').getByRole('link', { name: 'Card', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('nav[aria-label="Main navigation"]'),
    ).not.toContainText('Card');

    // /swap still renders primary heading (Trade deck)
    await expect(
      page.getByRole('heading', { name: /Route & swap/i }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('swap-card')).toBeVisible({ timeout: 15000 });

    // /offramp still renders primary heading
    await page.goto('/offramp');
    await expect(
      page.getByRole('heading', { name: /Stablecoin to local fiat/i }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('offramp-dashboard')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator('header').getByRole('link', { name: 'Card', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('nav[aria-label="Main navigation"]'),
    ).not.toContainText('Card');

    // /card is disabled => 404 or disabled state. New routes return 404 when flag unset.
    const response = await page.goto('/card');
    if (response) {
      // Allow 404 (preferred) or 200 with disabled content; never 500
      expect([404, 200]).toContain(response.status());
      if (response.status() === 404) {
        // confirmed 404
      }
    }
    const cardShell = page.getByTestId('card-shell');
    const cardPage = page.getByTestId('card-page');
    const hasShell = await cardShell.count();
    const hasPage = await cardPage.count();
    if (hasShell > 0) {
      await expect(
        cardShell.getByText(/disabled|not found|404|coming soon/i).first(),
      ).toBeVisible({ timeout: 5000 });
    } else if (hasPage > 0) {
      await expect(
        cardPage.getByText(/disabled|not found|404/i).first(),
      ).toBeVisible({ timeout: 5000 });
    } else {
      await expect(
        page.getByText(/404|This page could not be found|Not Found|disabled/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
    await expect(
      page.locator('header').getByRole('link', { name: 'Card', exact: true }),
    ).toHaveCount(0);
  });

  test('spec does not enable the card flag', async ({ page }) => {
    await page.goto('/swap');
    const flagSet = await page.evaluate(() => {
      const w = window as unknown as {
        __STELLAR_ROUTE_FLAGS__?: Record<string, unknown>;
      };
      return (
        (w.__STELLAR_ROUTE_FLAGS__ as Record<string, unknown> | undefined)?.card ??
        (w.__STELLAR_ROUTE_FLAGS__ as Record<string, unknown> | undefined)?.card_enabled ??
        (w.__STELLAR_ROUTE_FLAGS__ as Record<string, unknown> | undefined)?.CARD_ENABLED ??
        null
      );
    });
    expect(flagSet).toBeNull();
  });
});