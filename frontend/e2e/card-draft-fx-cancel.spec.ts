import { test, expect, type Page } from '@playwright/test';

/**
 * CARD-40 Playwright draft, FX preview, and cancel
 *
 * Additive-only: new spec only, no production code changes.
 * Flag ON, mocked APIs. Fill USD draft, see fiat preview, open confirm,
 * press Cancel. Assert no Horizon URL was called.
 *
 * With flags unset (production default false), /card is 404 and this flow
 * is not exposed - no user-visible difference on /swap, /offramp, /cross-chain-swap.
 */

function enableCardFlag(page: Page) {
  // Support multiple flag naming conventions for forward compatibility
  return page.addInitScript(() => {
    (window as unknown as { __STELLAR_ROUTE_FLAGS__?: Record<string, unknown> }).__STELLAR_ROUTE_FLAGS__ = {
      card: true,
      card_enabled: true,
      CARD_ENABLED: true,
      card_flag: true,
    };
  });
}

async function mockCardApis(page: Page) {
  await page.route('**/api/v1/card/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/draft')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ draftId: 'draft-123', status: 'draft', amount: '100.00', currency: 'USD' }),
      });
      return;
    }
    if (url.includes('/fx-preview') || url.includes('/quote') || url.includes('/preview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fiatAmount: '92.50',
          fiatCurrency: 'NGN',
          rate: '925.00',
          fee: '1.00',
          total: '93.50',
          indicative: true,
          preview: 'fiat preview',
        }),
      });
      return;
    }
    if (url.includes('/confirm')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ confirmed: true }),
      });
      return;
    }
    // default card API mock
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Mock horizon host explicitly to track calls, but fulfill safely
  await page.route('**/horizon*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hash: 'horizon_mock_not_called_expected' }),
    });
  });
}

test.describe('CARD-40 draft, FX preview, and cancel', () => {
  test('fill USD draft, see fiat preview, open confirm, press Cancel - no horizon host requested', async ({
    page,
  }) => {
    await enableCardFlag(page);
    await mockCardApis(page);

    const horizonRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.toLowerCase().includes('horizon')) {
        horizonRequests.push(url);
      }
    });

    await page.goto('/card');
    // Card shell should be visible when flag is on
    await expect(page.getByTestId('card-shell').or(page.getByTestId('card-page')).first()).toBeVisible({
      timeout: 15000,
    });

    // Fill USD draft - try multiple selector strategies for forward compatibility
    const amountInput = page
      .getByTestId('card-amount-input')
      .or(page.getByPlaceholder('0.00').first())
      .or(page.getByLabel(/amount/i).first())
      .or(page.locator('input[inputmode="decimal"]').first());
    await expect(amountInput.first()).toBeVisible({ timeout: 10000 });
    await amountInput.first().fill('100');
    // Trigger change if needed
    await page.keyboard.press('Tab');

    // Currency selector - choose USD if present
    const usdSelector = page.getByTestId('card-currency-select').or(page.getByRole('combobox').first());
    if (await usdSelector.isVisible().catch(() => false)) {
      await usdSelector.click().catch(() => {});
      const usdOption = page.getByRole('option', { name: /USD/i }).or(page.getByText('USD', { exact: true }));
      if (await usdOption.first().isVisible().catch(() => false)) {
        await usdOption.first().click();
      }
    }

    // Draft input - name or address field if present
    const draftBtn = page.getByTestId('card-draft-continue').or(page.getByRole('button', { name: /continue|next|create draft/i }));
    if (await draftBtn.isVisible().catch(() => false)) {
      await draftBtn.click();
    }

    // Fiat preview should be visible after filling amount
    // Look for NGN, fiat preview, or preview data-testid
    const fiatPreview = page
      .getByTestId('card-fx-preview')
      .or(page.getByTestId('card-fiat-preview'))
      .or(page.getByText(/92\.50|NGN|fiat preview|receive NGN|indicative/i).first());
    await expect(fiatPreview.first()).toBeVisible({ timeout: 10000 });

    // Ensure fiat amount visible (e.g., 92.50 NGN or similar formatted fiat)
    await expect(page.getByText(/92\.50|NGN|₦|fiat/i).first()).toBeVisible({ timeout: 5000 });

    // Open confirm - click Preview / Confirm button
    const confirmBtn = page
      .getByTestId('card-preview-confirm')
      .or(page.getByTestId('card-confirm-open'))
      .or(page.getByRole('button', { name: /preview|confirm|review/i }));
    if (await confirmBtn.first().isVisible().catch(() => false)) {
      await confirmBtn.first().click();
    }

    // Confirm screen should be visible
    const confirmScreen = page
      .getByTestId('card-confirm-screen')
      .or(page.getByRole('dialog'))
      .or(page.getByText(/confirm|review your card/i).first());
    await expect(confirmScreen.first()).toBeVisible({ timeout: 10000 });

    // Press Cancel - should return to card shell, not submit to horizon
    const cancelBtn = page
      .getByTestId('card-cancel')
      .or(page.getByRole('button', { name: /cancel/i }))
      .or(page.getByRole('button', { name: /back/i }));
    await expect(cancelBtn.first()).toBeVisible({ timeout: 5000 });
    await cancelBtn.first().click();

    // Cancel returns to card shell (still on /card, shell visible, confirm dialog closed)
    await expect(page).toHaveURL(/\/card/);
    await expect(page.getByTestId('card-shell').or(page.getByTestId('card-page')).first()).toBeVisible({
      timeout: 10000,
    });
    // Confirm dialog should be closed
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Assert no Horizon URL was called
    expect(horizonRequests).toEqual([]);
    // Extra assertion via request tracking: ensure no request host is horizon
    const hasHorizonHost = horizonRequests.some((u) => u.includes('horizon'));
    expect(hasHorizonHost).toBe(false);
  });
});