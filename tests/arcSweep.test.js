import assert from "node:assert/strict";
import { DustCleaner, createDemoBalances } from "../src/arcSweep.js";
import { DEFAULT_TOKEN_LIST } from "../src/tokens.js";

const testAdapter = {
  id: "test-dex",
  name: "Test DEX",
  async quote({ token, amount, outputToken, slippageBps }) {
    const outputAmount = amount * token.priceUsd;

    return {
      adapterId: "test-dex",
      adapterName: "Test DEX",
      inputToken: token,
      outputToken,
      inputAmount: amount,
      outputAmount,
      minimumOutputAmount: outputAmount * (1 - slippageBps / 10000),
      priceImpactBps: 12,
      route: [token.symbol, outputToken.symbol],
      txRequest: {
        to: "0x1111111111111111111111111111111111111111",
        data: "0x1234",
        value: "0x0"
      }
    };
  }
};

const cleaner = new DustCleaner({ adapters: [testAdapter] });
const balances = createDemoBalances(DEFAULT_TOKEN_LIST);
const dust = await cleaner.detectDust({ thresholdUsd: 2, balances });
const quoted = await cleaner.getBestQuotes(dust, { slippageBps: 50 });
const sweep = await cleaner.buildSweep(quoted);

assert.ok(dust.length > 0, "expected demo dust balances");
assert.ok(dust.every((entry) => entry.valueUsd <= 2), "all entries are under threshold");
assert.ok(quoted.every((entry) => entry.bestQuote), "every detected token has a best quote");
assert.ok(sweep.totalOutput > 0, "sweep has output");
assert.equal(sweep.requiresSignatures, quoted.length, "one swap tx per selected token");

console.log("ArcSweep core tests passed");
