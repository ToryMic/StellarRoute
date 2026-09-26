import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CardDeclineBanner,
  declineToPlainLanguage,
} from "../CardDeclineBanner";
import { CardPageClient } from "../CardPageClient";

describe("CardDeclineBanner", () => {
  it("shows the decline code in plain language", () => {
    render(
      <CardDeclineBanner
        authorization={{
          id: "auth-1",
          status: "declined",
          decline_code: "insufficient_funds",
          amount: "12.50",
          currency: "USD",
        }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByTestId("card-decline-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/weren’t enough funds/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Code: insufficient_funds/)).toBeInTheDocument();
  });

  it("falls back to generic plain language for unknown codes", () => {
    expect(declineToPlainLanguage("something_new")).toMatch(/declined by/i);
    expect(declineToPlainLanguage(null)).toMatch(/declined by/i);
  });

  it("calls onDismiss when the dismiss control is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <CardDeclineBanner
        authorization={{ id: "auth-9", status: "declined" }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByTestId("card-decline-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("CardPageClient", () => {
  it("dismiss hides the banner until the id changes", async () => {
    window.localStorage.clear();
    const declined = {
      id: "auth-1",
      status: "declined",
      decline_code: "insufficient_funds",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { authorizations: [declined], total: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { rerender } = render(<CardPageClient />);
    expect(await screen.findByTestId("card-decline-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("card-decline-dismiss"));
    expect(screen.queryByTestId("card-decline-banner")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("stellarroute:card:decline-dismissed")).toBe(
      "auth-1",
    );

    // A new decline id shows again even though the old id was dismissed.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            authorizations: [{ ...declined, id: "auth-2" }],
            total: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    rerender(<CardPageClient />);
    // Force a fresh mount so the effect refetches with the new fixture.
    window.localStorage.removeItem("stellarroute:card:decline-dismissed");
  });
});
