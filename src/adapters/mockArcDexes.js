import { ARC_TESTNET } from "../tokens.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CONFIG_STORAGE_KEY = "arcsweep:dexes";

export function createArcDexQuoteAdapter({
  id,
  name,
  quoteUrl,
  routerAddress,
  headers = {},
  timeoutMs = 12000,
  buildRequest = buildDefaultQuoteRequest,
  parseResponse = parseDefaultQuoteResponse
}) {
  assertAdapterConfig({ id, name, quoteUrl, routerAddress });

  return {
    id,
    name,
    routerAddress,
    async quote(payload) {
      const requestBody = buildRequest({
        ...payload,
        chainId: ARC_TESTNET.chainIdDecimal,
        routerAddress
      });

      const response = await fetchWithTimeout(quoteUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers
        },
        body: JSON.stringify(requestBody)
      }, timeoutMs);

      if (!response.ok) {
        throw new Error(`${name} quote failed with HTTP ${response.status}`);
      }

      const quote = parseResponse(await response.json(), {
        ...payload,
        adapterId: id,
        adapterName: name,
        routerAddress
      });

      validateQuote(quote, name);
      return quote;
    }
  };
}

export function createHttpQuoteAdapter(config) {
  return createArcDexQuoteAdapter({
    ...config,
    quoteUrl: config.quoteUrl || config.endpoint
  });
}

export function createArcDexAdaptersFromConfig(configs = readRuntimeDexConfig()) {
  return configs.flatMap((config) => {
    try {
      return [createArcDexQuoteAdapter(config)];
    } catch (error) {
      globalThis.console?.warn?.(`ArcSweep skipped DEX adapter: ${error.message}`);
      return [];
    }
  });
}

export const DEFAULT_ARC_DEX_ADAPTERS = createArcDexAdaptersFromConfig();

export function buildDefaultQuoteRequest({
  token,
  amount,
  rawAmount,
  outputToken,
  slippageBps,
  account,
  chainId
}) {
  return {
    chainId,
    sellToken: token.address,
    sellTokenSymbol: token.symbol,
    sellAmount: rawAmount || toBaseUnits(amount, token.decimals),
    buyToken: outputToken.address,
    buyTokenSymbol: outputToken.symbol,
    taker: account,
    slippageBps
  };
}

export function parseDefaultQuoteResponse(response, context) {
  const outputAmount = readNumber(response, ["outputAmount", "buyAmount", "amountOut", "toTokenAmount"]);
  const minimumOutputAmount = readNumber(response, ["minimumOutputAmount", "minBuyAmount", "minAmountOut"]) ||
    outputAmount * (1 - context.slippageBps / 10000);
  const priceImpactBps = readNumber(response, ["priceImpactBps", "estimatedPriceImpactBps"]) ||
    readPercentAsBps(response, ["priceImpact", "estimatedPriceImpact"]) ||
    0;
  const tx = response.tx || response.transaction || response.txRequest || {};
  const route = response.route || response.path || [context.token.symbol, context.outputToken.symbol];

  return {
    adapterId: context.adapterId,
    adapterName: context.adapterName,
    inputToken: context.token,
    outputToken: context.outputToken,
    inputAmount: context.amount,
    outputAmount,
    minimumOutputAmount,
    priceImpactBps,
    route: Array.isArray(route) ? route : [context.token.symbol, context.outputToken.symbol],
    txRequest: {
      to: tx.to || response.to || context.routerAddress,
      data: tx.data || response.data,
      value: tx.value || response.value || "0x0"
    },
    raw: response
  };
}

export function readRuntimeDexConfig() {
  const globalConfig = globalThis.ARCSWEEP_DEXES;
  if (Array.isArray(globalConfig)) {
    return globalConfig;
  }

  try {
    const stored = globalThis.localStorage?.getItem(CONFIG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function assertAdapterConfig({ id, name, quoteUrl, routerAddress }) {
  if (!id || !name || !quoteUrl) {
    throw new Error("DEX adapter requires id, name, and quoteUrl");
  }

  if (!isAddress(routerAddress) || routerAddress.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${name} requires a real Arc Testnet router address`);
  }
}

function validateQuote(quote, adapterName) {
  if (!Number.isFinite(quote.outputAmount) || quote.outputAmount <= 0) {
    throw new Error(`${adapterName} returned no usable output amount`);
  }

  if (!isAddress(quote.txRequest?.to) || quote.txRequest.to.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${adapterName} returned an invalid router address`);
  }

  if (!quote.txRequest?.data || quote.txRequest.data === "0x") {
    throw new Error(`${adapterName} returned empty swap calldata`);
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function readNumber(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function readPercentAsBps(source, keys) {
  const percent = readNumber(source, keys);
  return percent ? percent * 100 : 0;
}

function toBaseUnits(amount, decimals) {
  const [whole, fraction = ""] = String(amount).split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return `${whole}${paddedFraction}`.replace(/^0+/, "") || "0";
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "");
}
