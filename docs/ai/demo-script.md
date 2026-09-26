# AI Agent Fixture Demo Script (Six Tools Walkthrough)

This document provides a deterministic review and testing walkthrough for all six AI Agent tools without requiring mainnet funds, live private keys, or external LLM API keys.

> **Important**: Do not set production flags.
> All feature flags (such as `AI_AGENT_ENABLED` and `NEXT_PUBLIC_AI_AGENT`) must remain unset or set to `false` in production environments. Test execution and reviewer walkthroughs run strictly in local development or test fixture environments.
>
> None of the commands or steps in this script broadcast a transaction on-chain. All operations either generate read-only previews, deep-link into existing review pages with prefilled parameters, or simulate local cancellation and scheduled approvals.

---

## Tool Overview and Tracking Matrix

| Tool | Feature / Action | Tracking Issues | Broadcast Behavior |
| :--- | :--- | :--- | :--- |
| 1. `convert` | Convert Handoff & Preview | Issue #1424 (AI-14), Issue #1425 (AI-15) | Read-only quote preview; deep-links to `/swap` with prefilled parameters; zero automatic broadcast. |
| 2. `send` | Send Preview & Cancel | Issue #1417 (AI-07), Issue #1426 (AI-16), Issue #1427 (AI-17) | Unsigned preview; Cancel clears the card without signing or broadcasting. |
| 3. `receive` | Receive Card & Address Display | Issue #1428 (AI-18), Issue #1429 (AI-19) | Read-only payment request / QR representation; no on-chain transaction. |
| 4. `bridge` | Bridge-off Copy / Bridge Preview | Issue #1430 (AI-20), Issue #1431 (AI-21) | Informational routing and manual copy instructions; no burn or mint broadcast. |
| 5. `offramp` | Offramp Handoff | Issue #1432 (AI-22), Issue #1433 (AI-23) | Cash-out intent preview; deep-links into `/offramp`; no wallet or provider execution. |
| 6. `subscribe` | Subscription Awaiting Confirmation | Issue #1434 (AI-24), Issue #1435 (AI-25), Issue #1436 (AI-26), Issue #1437 (AI-27) | Local schedule creation; waits for explicit per-payment user confirmation; never signs automatically. |
| *Runner* | Multi-step Plan Runner | Issue #1439 (AI-29) | Evaluates step dependencies sequentially with explicit per-step gates. |

---

## Prerequisites (Local Development Only)

1. Run the local development server (flags enabled in local development only):
   ```bash
   NEXT_PUBLIC_AI_AGENT=true npm --prefix frontend run dev
   ```
2. Navigate to the agent page at `http://localhost:3000/ai`.
3. Verify that the agent page displays the status chip and composer.

---

## Step 1: `convert` — Convert Handoff (AI-14, AI-15)

* **Implemented by**: [Issue #1424 (AI-14)](https://github.com/StellarRoute/StellarRoute/issues/1424) and [Issue #1425 (AI-15)](https://github.com/StellarRoute/StellarRoute/issues/1425)
* **Intent**: `convert`
* **Input Fixture Prompt**:
  ```text
  swap 10 XLM to USDC
  ```

### Verification Flow:
1. Enter the prompt into the agent composer.
2. The agent parses the intent into a typed `convert` object (`fromAsset: "native"`, `toAsset: "USDC"`, `amount: "10"`).
3. The preview card renders the indicative quote and estimated output without initiating a network swap transaction.
4. Click **Confirm**.
5. The application navigates to `/swap?from=native&to=USDC&amount=10`.
6. Confirm that the standard `/swap` UI renders with prefilled parameters and requires manual user approval through the standard wallet provider. No transaction has been submitted.

---

## Step 2: `send` — Send Cancel (AI-07, AI-16, AI-17)

* **Implemented by**: [Issue #1417 (AI-07)](https://github.com/StellarRoute/StellarRoute/issues/1417), [Issue #1426 (AI-16)](https://github.com/StellarRoute/StellarRoute/issues/1426), and [Issue #1427 (AI-17)](https://github.com/StellarRoute/StellarRoute/issues/1427)
* **Intent**: `send`
* **Input Fixture Prompt**:
  ```text
  send 5 USDC to GBYI5WQLXJ2L654Z27O5R7B5R4T5V2C4L3M5K6J7H8G9F0E1D2C3B4A5
  ```

### Verification Flow:
1. Enter the send prompt into the agent composer.
2. The agent displays the preview card detailing the asset (`USDC`), amount (`5`), and recipient account.
3. Click **Cancel**.
4. The preview card is dismissed, the transaction is discarded, and no wallet prompt or Horizon submission occurs.
5. Telemetry emits `agent_cancel` with `kind: "send"`.

---

## Step 3: `receive` — Payment Request & Address Display (AI-18, AI-19)

* **Implemented by**: [Issue #1428 (AI-18)](https://github.com/StellarRoute/StellarRoute/issues/1428) and [Issue #1429 (AI-19)](https://github.com/StellarRoute/StellarRoute/issues/1429)
* **Intent**: `receive`
* **Input Fixture Prompt**:
  ```text
  receive
  ```

### Verification Flow:
1. Enter `receive` into the agent composer.
2. The agent presents the receive card with the connected public key address and QR representation.
3. Click the copy button to copy the address to clipboard.
4. No transaction or ledger entry is published.

---

## Step 4: `bridge` — Bridge-off Copy & Cross-Chain Preview (AI-20, AI-21)

* **Implemented by**: [Issue #1430 (AI-20)](https://github.com/StellarRoute/StellarRoute/issues/1430) and [Issue #1431 (AI-21)](https://github.com/StellarRoute/StellarRoute/issues/1431)
* **Intent**: `bridge`
* **Input Fixture Prompt**:
  ```text
  bridge 25 USDC to sepolia
  ```

### Verification Flow:
1. Enter the bridge prompt into the agent composer.
2. The preview displays source chain (`Stellar`), destination (`Ethereum Sepolia`), estimated CCTP attestation fee, and expected timing.
3. Review the bridge parameters. If bridging out, copy instructions and destination recipient addresses are made available for review.
4. No deposit-for-burn transaction is broadcast to the network.

---

## Step 5: `offramp` — Offramp Handoff (AI-22, AI-23)

* **Implemented by**: [Issue #1432 (AI-22)](https://github.com/StellarRoute/StellarRoute/issues/1432) and [Issue #1433 (AI-23)](https://github.com/StellarRoute/StellarRoute/issues/1433)
* **Intent**: `offramp`
* **Input Fixture Prompt**:
  ```text
  cash out 50 USDC to NGN
  ```

### Verification Flow:
1. Enter the cash out prompt into the agent composer.
2. The intent preview card parses the fiat corridor (`NGN`) and crypto source (`USDC`).
3. Click **Confirm**.
4. The user is redirected to `/offramp?sourceAsset=USDC&amount=50&fiatCurrency=NGN`.
5. The offramp form loads prefilled in review mode. No fiat payout order or crypto deposit is broadcast automatically.

---

## Step 6: `subscribe` — Subscription Awaiting Confirm (AI-24, AI-25, AI-26, AI-27)

* **Implemented by**: [Issue #1434 (AI-24)](https://github.com/StellarRoute/StellarRoute/issues/1434), [Issue #1435 (AI-25)](https://github.com/StellarRoute/StellarRoute/issues/1435), [Issue #1436 (AI-26)](https://github.com/StellarRoute/StellarRoute/issues/1436), and [Issue #1437 (AI-27)](https://github.com/StellarRoute/StellarRoute/issues/1437)
* **Intent**: `subscribe`
* **Input Fixture Prompt**:
  ```text
  pay 15 USDC monthly to GBYI5WQLXJ2L654Z27O5R7B5R4T5V2C4L3M5K6J7H8G9F0E1D2C3B4A5
  ```

### Verification Flow:
1. Enter the recurring payment instruction.
2. The subscription preview card displays payee address, amount (`15 USDC`), interval (`monthly`), and max payments.
3. Confirming registers the plan in local browser storage only.
4. When a cycle reaches due state, the interface displays a pending approval notification.
5. In accordance with non-custodial safety rules, no payment executes or broadcasts until the user explicitly approves each individual installment.

---

## Step 7: Multi-Step Plan Runner Simulation (AI-29)

* **Implemented by**: [Issue #1439 (AI-29)](https://github.com/StellarRoute/StellarRoute/issues/1439)
* **Input Fixture Prompt**:
  ```text
  swap 10 XLM to USDC then send 5 USDC to GBYI5WQLXJ2L654Z27O5R7B5R4T5V2C4L3M5K6J7H8G9F0E1D2C3B4A5
  ```

### Verification Flow:
1. The agent splits composite requests into a plan consisting of Step 1 (`convert`) followed by Step 2 (`send`).
2. Each step requires explicit, independent confirmation.
3. Rejecting Step 1 aborts the remaining steps with no transactions generated or submitted.
