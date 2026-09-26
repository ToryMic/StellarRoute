"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CardDeclineBanner,
  type CardDeclineAuthorization,
} from "./CardDeclineBanner";

const DISMISS_KEY = "stellarroute:card:decline-dismissed";

function apiBase(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_TESTNET;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.replace(/\/$/, "");
  return "http://localhost:8080";
}

function unwrapList(body: unknown): CardDeclineAuthorization[] {
  if (Array.isArray(body)) return body as CardDeclineAuthorization[];
  if (body !== null && typeof body === "object") {
    const root = body as {
      data?: unknown;
      authorizations?: unknown;
    };
    const data = root.data ?? body;
    if (Array.isArray(data)) return data as CardDeclineAuthorization[];
    if (data !== null && typeof data === "object") {
      const nested = data as { authorizations?: unknown };
      if (Array.isArray(nested.authorizations)) {
        return nested.authorizations as CardDeclineAuthorization[];
      }
    }
    if (Array.isArray(root.authorizations)) {
      return root.authorizations as CardDeclineAuthorization[];
    }
  }
  return [];
}

export function CardPageClient() {
  const [latestDeclined, setLatestDeclined] =
    useState<CardDeclineAuthorization | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedId(window.localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissedId(null);
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/v1/card/authorizations`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const body = (await res.json()) as unknown;
        const list = unwrapList(body);
        const declined = list.filter((a) => a?.status === "declined");
        if (!cancelled && declined.length > 0) {
          // Most recent first when the API returns newest-first; otherwise
          // fall back to the last declined entry.
          setLatestDeclined(declined[0] ?? null);
        }
      } catch {
        // Flag-gated / offline — the paused sentence below still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (!latestDeclined) return;
    try {
      window.localStorage.setItem(DISMISS_KEY, latestDeclined.id);
    } catch {
      // Dismiss is local-only; storage failures just mean it reappears.
    }
    setDismissedId(latestDeclined.id);
  }, [latestDeclined]);

  const showBanner =
    latestDeclined !== null &&
    latestDeclined.id !== dismissedId &&
    latestDeclined.status === "declined";

  return (
    <div className="space-y-4">
      {showBanner && latestDeclined ? (
        <CardDeclineBanner
          authorization={latestDeclined}
          onDismiss={handleDismiss}
        />
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
        Declines from the card partner appear on this page only.
      </p>
    </div>
  );
}
