import type { Story } from '@ladle/react';
import '@/app/globals.css';

// ---------------------------------------------------------------------------
// Mock card primitives - additive-only stories, no production component import
// No 16-digit numbers appear; use masked last-4 only.
// ---------------------------------------------------------------------------

function CardFace({
  status = 'active',
  last4 = '4821',
  holder = 'Alex Doe',
  expiry = '12/28',
}: {
  status?: 'active' | 'frozen';
  last4?: string;
  holder?: string;
  expiry?: string;
}) {
  const isFrozen = status === 'frozen';
  return (
    <div
      data-testid="card-face"
      className={`relative w-[340px] h-[210px] rounded-2xl border p-5 flex flex-col justify-between overflow-hidden ${
        isFrozen
          ? 'bg-muted border-border text-muted-foreground'
          : 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-primary/20'
      }`}
    >
      <div className="flex justify-between items-start">
        <span className="font-mono text-xs tracking-[0.18em] uppercase opacity-80">
          StellarRoute
        </span>
        <span
          data-testid="card-status-badge"
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            isFrozen ? 'bg-amber-500/20 text-amber-700' : 'bg-white/20 text-white'
          }`}
        >
          {isFrozen ? 'Frozen' : 'Active'}
        </span>
      </div>
      <div className="space-y-3">
        <div className="font-mono text-lg tracking-widest" aria-label="card number masked">
          •••• •••• •••• {last4}
        </div>
        <div className="flex justify-between text-xs">
          <span className="uppercase tracking-wider opacity-80">{holder}</span>
          <span className="font-mono">{expiry}</span>
        </div>
      </div>
      {isFrozen && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
          <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold shadow">
            Frozen - tap to unfreeze
          </span>
        </div>
      )}
    </div>
  );
}

function CardConfirm({
  amount = '100.00',
  fiat = '92.50 NGN',
  fee = '1.00 NGN',
  onCancel,
  onConfirm,
}: {
  amount?: string;
  fiat?: string;
  fee?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <div data-testid="card-confirm-screen" className="w-[380px] rounded-2xl border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Confirm card spend</h2>
      <div className="rounded-xl bg-muted p-4 space-y-2 font-mono text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span data-testid="card-fx-preview">${amount} USD</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">You receive</span>
          <span>{fiat}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fee</span>
          <span>{fee}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          data-testid="card-cancel"
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl border border-border bg-background font-medium"
        >
          Cancel
        </button>
        <button
          data-testid="card-confirm"
          onClick={onConfirm}
          className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          Confirm
        </button>
      </div>
      <p className="text-xs text-muted-foreground text-center">FX preview indicative, not final</p>
    </div>
  );
}

function CardActivity({
  rows,
}: {
  rows: Array<{ id: string; amount: string; merchant: string; status: string }>;
}) {
  if (rows.length === 0) {
    return (
      <div data-testid="card-activity-empty" className="w-[380px] rounded-2xl border bg-card p-8 text-center space-y-2">
        <p className="font-semibold">No activity yet</p>
        <p className="text-sm text-muted-foreground">Your card transactions will appear here</p>
      </div>
    );
  }
  return (
    <div data-testid="card-activity" className="w-[380px] rounded-2xl border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Recent activity</h3>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} data-testid={`card-activity-row-${r.id}`} className="flex justify-between py-3 text-sm">
            <div className="space-y-1">
              <div className="font-medium">{r.merchant}</div>
              <div className="text-xs text-muted-foreground">{r.status}</div>
            </div>
            <div className="font-mono font-semibold">{r.amount}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default {
  title: 'Card / Card',
};

// Active face - card is usable
export const ActiveFace: Story = () => (
  <div className="min-h-[320px] bg-background p-8 flex items-center justify-center">
    <CardFace status="active" last4="4821" />
  </div>
);
ActiveFace.storyName = 'Card Face - Active';

// Frozen face - card is frozen, overlay visible
export const FrozenFace: Story = () => (
  <div className="min-h-[320px] bg-background p-8 flex items-center justify-center">
    <CardFace status="frozen" last4="4821" />
  </div>
);
FrozenFace.storyName = 'Card Face - Frozen';

// Confirm screen - FX preview with fiat amount visible
export const ConfirmScreen: Story = () => (
  <div className="min-h-[420px] bg-background p-8 flex items-center justify-center">
    <CardConfirm amount="100.00" fiat="92.50 NGN" fee="1.00 NGN" onCancel={() => {}} onConfirm={() => {}} />
  </div>
);
ConfirmScreen.storyName = 'Confirm Screen';

// Activity empty - no transactions
export const ActivityEmpty: Story = () => (
  <div className="min-h-[320px] bg-background p-8 flex items-center justify-center">
    <CardActivity rows={[]} />
  </div>
);
ActivityEmpty.storyName = 'Activity - Empty';

// Activity two rows - two mocked transactions, no real PANs
export const ActivityTwoRows: Story = () => (
  <div className="min-h-[320px] bg-background p-8 flex items-center justify-center">
    <CardActivity
      rows={[
        { id: '1', amount: '$12.50', merchant: 'Coffee Shop', status: 'Settled - 2 Apr' },
        { id: '2', amount: '$89.00', merchant: 'Market Lane', status: 'Pending - 1 Apr' },
      ]}
    />
  </div>
);
ActivityTwoRows.storyName = 'Activity - Two Rows';