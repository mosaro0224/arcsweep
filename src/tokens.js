export const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainIdDecimal: 5042002,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://explorer.testnet.arc.network"],
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  }
};

export const USDC_TOKEN = {
  chainId: ARC_TESTNET.chainIdDecimal,
  address: "0x3600000000000000000000000000000000000000",
  symbol: "USDC",
  name: "USDC",
  decimals: 18,
  priceUsd: 1
};

export const DEFAULT_TOKEN_LIST = [
  USDC_TOKEN,
  {
    chainId: ARC_TESTNET.chainIdDecimal,
    address: "0x1111111111111111111111111111111111111111",
    symbol: "aETH",
    name: "Arc Ether",
    decimals: 18,
    priceUsd: 3100
  },
  {
    chainId: ARC_TESTNET.chainIdDecimal,
    address: "0x2222222222222222222222222222222222222222",
    symbol: "aWBTC",
    name: "Arc Wrapped Bitcoin",
    decimals: 8,
    priceUsd: 68000
  },
  {
    chainId: ARC_TESTNET.chainIdDecimal,
    address: "0x3333333333333333333333333333333333333333",
    symbol: "NOVA",
    name: "Nova Points",
    decimals: 18,
    priceUsd: 0.18
  },
  {
    chainId: ARC_TESTNET.chainIdDecimal,
    address: "0x4444444444444444444444444444444444444444",
    symbol: "ARCX",
    name: "ArcX",
    decimals: 18,
    priceUsd: 0.72
  },
  {
    chainId: ARC_TESTNET.chainIdDecimal,
    address: "0x5555555555555555555555555555555555555555",
    symbol: "SPRK",
    name: "Spark",
    decimals: 18,
    priceUsd: 0.04
  }
];
