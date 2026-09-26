import type { ReactNode } from 'react';

import type { CardLimitApplication } from './limits';

export interface CardLimitSettingsProps {
  application: CardLimitApplication;
  onChange?: (nextUserCap: number) => number | null;
  children?: ReactNode;
}

export function CardLimitSettings({ application, onChange, children }: CardLimitSettingsProps) {
  const programMax = Number(application.programMax ?? 0);
  const currentCap = Number(application.userCap ?? programMax);
  const effectiveCap = Math.min(currentCap, programMax);
  const isOverMax = currentCap > programMax;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>
        <strong>Program max:</strong> {programMax}
      </div>
      <div>
        <strong>Weekly user cap:</strong> {effectiveCap}
      </div>
      <div>
        <strong>Maximum allowed:</strong> {programMax}
      </div>
      {isOverMax ? (
        <div role="alert">User cap cannot exceed the program max.</div>
      ) : null}
      {children}
      {typeof onChange === 'function' ? (
        <button
          type="button"
          disabled={isOverMax}
          onClick={() => onChange(Math.min(currentCap, programMax))}
        >
          Save limit
        </button>
      ) : null}
    </div>
  );
}

export function CardLimitSummary({ application }: { application: CardLimitApplication }) {
  const programMax = Number(application.programMax ?? 0);
  const userCap = Number(application.userCap ?? programMax);
  const effectiveCap = Math.min(userCap, programMax);

  return (
    <div role="status" aria-live="polite">
      Enforced monthly cap: {effectiveCap}. This is the lower of your user cap and the program max.
    </div>
  );
}
