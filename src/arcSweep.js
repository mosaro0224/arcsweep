import { DEFAULT_ARC_DEX_ADAPTERS } from "./adapters/mockArcDexes.js";
import { DEFAULT_TOKEN_LIST, USDC_TOKEN } from "./tokens.js";

const ERC20_ABI = {
  balanceOf: "0x70a08231"
};

export class DustCleaner {
  constructor({
    provider,
    account,
    tokens = DEFAULT_TOKEN_LIST,
    adapters = DEFAULT_ARC_DEX_ADAPTERS,
    outputToken = USDC_TOKEN
  } = {}) {
    this.provider = provider;
    this.account = account;
    this.tokens = tokens.filter((token) => token.address.toLowerCase() !== outputToken.address.toLowerCase());
    this.adapters = adapters;
    this.outputToken = outputToken;
  }

  async detectDust({ thresholdUsd = 2, balances } = {}) {
    const tokenBalances = balances || await this.fetchBalances();

    return tokenBalances
      .map((entry) => ({
        ...entry,
        valueUsd: entry.amount * entry.token.priceUsd
      }))
      .filter((entry) => entry.amount > 0 && entry.valueUsd <= thresholdUsd)
      .sort((a, b) => a.valueUsd - b.valueUsd);
  }

  async getBestQuotes(entries, { slippageBps = 50 } = {}) {
    const quotedEntries = await Promise.all(entries.map(async (entry) => {
      const quotes = await Promise.allSettled(this.adapters.map((adapter) => adapter.quote({
        token: entry.token,
        amount: entry.amount,
        rawAmount: entry.rawBalance,
        outputToken: this.outputToken,
        slippageBps,
        account: this.account
      })));

      const successfulQuotes = quotes
        .filter((quote) => quote.status === "fulfilled")
        .map((quote) => quote.value)
        .sort((a, b) => b.outputAmount - a.outputAmount);

      return {
        ...entry,
        quotes: successfulQuotes,
        bestQuote: successfulQuotes[0] || null
      };
    }));

    return quotedEntries;
  }

  async buildSweep(entries) {
    const totalOutput = entries.reduce((sum, entry) => sum + (entry.bestQuote?.outputAmount || 0), 0);
    const transactions = entries
      .filter((entry) => entry.bestQuote?.txRequest)
      .map((entry) => ({
        token: entry.token,
        quote: entry.bestQuote,
        txRequest: entry.bestQuote.txRequest
      }));

    return {
      outputToken: this.outputToken,
      totalOutput,
      transactions,
      requiresSignatures: transactions.length
    };
  }

  async fetchBalances() {
    if (!this.provider || !this.account) {
      return createDemoBalances(this.tokens);
    }

    const balances = await Promise.all(this.tokens.map(async (token) => {
      const rawBalance = await this.provider.request({
        method: "eth_call",
        params: [{
          to: token.address,
          data: ERC20_ABI.balanceOf + stripHexPrefix(padAddress(this.account))
        }, "latest"]
      });

      return {
        token,
        rawBalance,
        amount: formatUnits(BigInt(rawBalance), token.decimals)
      };
    }));

    return balances;
  }
}

export function createDemoBalances(tokens = DEFAULT_TOKEN_LIST) {
  const amountsBySymbol = {
    aETH: 0.00041,
    aWBTC: 0.000018,
    NOVA: 6.4,
    ARCX: 1.7,
    SPRK: 23.5
  };

  return tokens
    .filter((token) => token.symbol !== "USDC")
    .map((token) => ({
      token,
      amount: amountsBySymbol[token.symbol] || 0,
      rawBalance: "0x0"
    }));
}

export function formatCurrency(value, options = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2
  }).format(value || 0);
}

export function formatTokenAmount(value, decimals = 6) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value || 0);
}

function formatUnits(value, decimals) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const padded = fraction.toString().padStart(decimals, "0").slice(0, 8);
  return Number(`${whole}.${padded}`);
}

function padAddress(address) {
  return address.toLowerCase().replace("0x", "").padStart(64, "0");
}

function stripHexPrefix(value) {
  return value.replace(/^0x/, "");
}
