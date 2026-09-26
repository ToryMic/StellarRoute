import type { Metadata } from "next";
import { CardPageClient } from "./CardPageClient";

export const metadata: Metadata = {
  title: "Card | StellarRoute",
  description:
    "Preview of card authorization status. Webhook declines surface here only — the notification inbox is unchanged.",
};

export default function CardPage() {
  return (
    <main className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Card
          </h1>
          <p
            data-testid="card-paused-sentence"
            className="text-sm text-muted-foreground"
          >
            Card issuance is currently paused while we finish the preview.
          </p>
        </div>
        <CardPageClient />
      </div>
    </main>
  );
}
