# ArcSweep

ArcSweep is a single-page Arc Testnet wallet dust cleaner. It scans low-value token balances, compares quote adapters, and prepares selected swaps into USDC.

## Run

```powershell
npm.cmd start
```

Open `http://localhost:4173`.

## Test

```powershell
npm.cmd test
```

## Import

```js
import { DustCleaner } from "arcsweep";
import { createHttpQuoteAdapter } from "arcsweep/adapters";

const cleaner = new DustCleaner({
  provider: window.ethereum,
  account,
  adapters: [
    createHttpQuoteAdapter({
      id: "your-dex",
      name: "Your DEX",
      quoteUrl: "https://example.com/arc/quote",
      routerAddress: "0xYourArcTestnetRouter"
    })
  ]
});

const dust = await cleaner.detectDust({ thresholdUsd: 2 });
const quoted = await cleaner.getBestQuotes(dust, { slippageBps: 50 });
const sweep = await cleaner.buildSweep(quoted);
```

## Arc Testnet DEX adapters

The default adapter list now reads live DEX configuration from `window.ARCSWEEP_DEXES` or `localStorage["arcsweep:dexes"]`. It does not return simulated quotes.

Add a config block before `src/app.js` in `index.html`, or inject the same value from your hosting environment:

```html
<script>
  window.ARCSWEEP_DEXES = [
    {
      id: "your-dex",
      name: "Your DEX",
      quoteUrl: "https://your-dex.example/arc-testnet/quote",
      routerAddress: "0x0000000000000000000000000000000000000001"
    }
  ];
</script>
```

Each quote endpoint should accept `sellToken`, `sellAmount`, `buyToken`, `taker`, `slippageBps`, and `chainId`, then return an output amount plus executable transaction data:

```json
{
  "outputAmount": "1.2345",
  "minimumOutputAmount": "1.2283",
  "priceImpactBps": 25,
  "route": ["TOKEN", "USDC"],
  "tx": {
    "to": "0xRouterAddress",
    "data": "0xSwapCalldata",
    "value": "0x0"
  }
}
```

Use verified Arc Testnet router addresses only. The adapter rejects zero addresses, empty calldata, and missing quote output.
