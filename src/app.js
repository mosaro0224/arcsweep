import { DustCleaner, formatCurrency, formatTokenAmount } from "./arcSweep.js";
import { DEFAULT_ARC_DEX_ADAPTERS } from "./adapters/mockArcDexes.js";
import { ARC_TESTNET } from "./tokens.js";

const state = {
  account: null,
  provider: null,
  cleaner: new DustCleaner(),
  detected: [],
  selected: new Set(),
  thresholdUsd: 2,
  slippageBps: 50
};

const els = {
  connectWallet: document.querySelector("#connectWallet"),
  scanWallet: document.querySelector("#scanWallet"),
  sweepSelected: document.querySelector("#sweepSelected"),
  threshold: document.querySelector("#threshold"),
  thresholdValue: document.querySelector("#thresholdValue"),
  slippage: document.querySelector("#slippage"),
  autoSelect: document.querySelector("#autoSelect"),
  walletLabel: document.querySelector("#walletLabel"),
  networkStatus: document.querySelector("#networkStatus"),
  detectedTotal: document.querySelector("#detectedTotal"),
  bestOutput: document.querySelector("#bestOutput"),
  selectedCount: document.querySelector("#selectedCount"),
  adapterCount: document.querySelector("#adapterCount"),
  tokenList: document.querySelector("#tokenList"),
  routeList: document.querySelector("#routeList"),
  statusBox: document.querySelector("#statusBox"),
  selectAll: document.querySelector("#selectAll"),
  reviewDialog: document.querySelector("#reviewDialog"),
  reviewContent: document.querySelector("#reviewContent"),
  confirmSweep: document.querySelector("#confirmSweep")
};

els.adapterCount.textContent = `${DEFAULT_ARC_DEX_ADAPTERS.length} adapters`;
renderEmptyState();

els.threshold.addEventListener("input", () => {
  state.thresholdUsd = Number(els.threshold.value);
  els.thresholdValue.textContent = formatCurrency(state.thresholdUsd);
  void scanWallet();
});

els.slippage.addEventListener("change", () => {
  state.slippageBps = Number(els.slippage.value) * 100;
  void scanWallet();
});

els.connectWallet.addEventListener("click", connectWallet);
els.scanWallet.addEventListener("click", scanWallet);
els.selectAll.addEventListener("click", toggleSelectAll);
els.sweepSelected.addEventListener("click", openReview);
els.confirmSweep.addEventListener("click", confirmSweep);

async function connectWallet() {
  const ethereum = window.ethereum;
  if (!ethereum) {
    setStatus("No injected wallet found. Running demo scan with Arc Testnet sample balances.");
    await scanWallet();
    return;
  }

  try {
    const [account] = await ethereum.request({ method: "eth_requestAccounts" });
    state.account = account;
    state.provider = ethereum;
    state.cleaner = new DustCleaner({ provider: ethereum, account });
    await ensureArcTestnet(ethereum);
    els.connectWallet.textContent = "Wallet connected";
    els.walletLabel.textContent = shortenAddress(account);
    setStatus("Wallet connected. Scan when ready.");
    await scanWallet();
  } catch (error) {
    setStatus(`Wallet connection cancelled or failed: ${error.message}`);
  }
}

async function scanWallet() {
  if (!state.cleaner.adapters.length) {
    setStatus("No live Arc Testnet DEX adapters configured. Add window.ARCSWEEP_DEXES with quoteUrl and routerAddress before public testing.");
  }

  setBusy(true, "Scanning balances and comparing routes...");

  try {
    const dust = await state.cleaner.detectDust({ thresholdUsd: state.thresholdUsd });
    const quoted = await state.cleaner.getBestQuotes(dust, { slippageBps: state.slippageBps });
    state.detected = quoted;

    if (els.autoSelect.checked) {
      state.selected = new Set(quoted.map((entry) => entry.token.address));
    } else {
      state.selected = new Set([...state.selected].filter((address) => quoted.some((entry) => entry.token.address === address)));
    }

    render();
    if (!state.cleaner.adapters.length) {
      setStatus("Dust scan finished, but no DEX adapters are configured for live quotes.");
    } else {
      setStatus(quoted.length ? "Routes refreshed. Review the sweep before signing." : "No dust found under the selected limit.");
    }
  } catch (error) {
    setStatus(`Scan failed: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

function render() {
  const selectedEntries = getSelectedEntries();
  const totalDetected = state.detected.reduce((sum, entry) => sum + entry.valueUsd, 0);
  const totalOutput = selectedEntries.reduce((sum, entry) => sum + (entry.bestQuote?.outputAmount || 0), 0);

  els.detectedTotal.textContent = formatCurrency(totalDetected);
  els.bestOutput.textContent = `${formatTokenAmount(totalOutput, 4)} USDC`;
  els.selectedCount.textContent = `${selectedEntries.length} ${selectedEntries.length === 1 ? "token" : "tokens"}`;
  els.sweepSelected.disabled = selectedEntries.length === 0 || selectedEntries.every((entry) => !entry.bestQuote);

  if (!state.detected.length) {
    renderEmptyState();
    return;
  }

  els.tokenList.innerHTML = state.detected.map((entry) => tokenRow(entry)).join("");
  els.routeList.innerHTML = selectedEntries.length
    ? selectedEntries.map((entry) => routeCard(entry)).join("")
    : "<p class=\"muted\">Select tokens to compare aggregate output.</p>";

  els.tokenList.querySelectorAll("[data-token]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const address = event.currentTarget.dataset.token;
      if (event.currentTarget.checked) {
        state.selected.add(address);
      } else {
        state.selected.delete(address);
      }
      render();
    });
  });
}

function tokenRow(entry) {
  const checked = state.selected.has(entry.token.address) ? "checked" : "";
  const quoteLabel = entry.bestQuote ? `${entry.bestQuote.adapterName} -> ${formatTokenAmount(entry.bestQuote.outputAmount, 4)} USDC` : "No quote";

  return `
    <article class="token-row">
      <div class="token-name">
        <span class="token-icon">${entry.token.symbol.slice(0, 2)}</span>
        <div>
          <strong>${entry.token.symbol}</strong>
          <small>${entry.token.name}</small>
        </div>
      </div>
      <span>${formatTokenAmount(entry.amount, 6)}</span>
      <strong>${formatCurrency(entry.valueUsd)}</strong>
      <span>${quoteLabel}</span>
      <label class="switch" aria-label="Select ${entry.token.symbol}">
        <input data-token="${entry.token.address}" type="checkbox" ${checked}>
        <span></span>
      </label>
    </article>
  `;
}

function routeCard(entry) {
  const quoteRows = entry.quotes.map((quote) => `
    <li>
      <span>${quote.adapterName}</span>
      <strong>${formatTokenAmount(quote.outputAmount, 4)} USDC</strong>
      <small>${(quote.priceImpactBps / 100).toFixed(2)}% impact</small>
    </li>
  `).join("");

  return `
    <article class="route-card">
      <div>
        <strong>${entry.token.symbol} best route</strong>
        <span>${entry.bestQuote?.route.join(" / ") || "No route"}</span>
      </div>
      <ol>${quoteRows}</ol>
    </article>
  `;
}

function renderEmptyState() {
  els.tokenList.innerHTML = `
    <div class="empty-state">
      <strong>No scan yet</strong>
      <p>Connect a wallet to scan Arc Testnet balances, or press Scan wallet to preview demo dust.</p>
    </div>
  `;
  els.routeList.innerHTML = "<p class=\"muted\">Best routes will appear after scan.</p>";
}

function toggleSelectAll() {
  const allSelected = state.detected.every((entry) => state.selected.has(entry.token.address));
  state.selected = allSelected ? new Set() : new Set(state.detected.map((entry) => entry.token.address));
  render();
}

async function openReview() {
  const sweep = await state.cleaner.buildSweep(getSelectedEntries());
  els.reviewContent.innerHTML = `
    <div class="review-total">
      <span>Estimated USDC received</span>
      <strong>${formatTokenAmount(sweep.totalOutput, 6)} ${sweep.outputToken.symbol}</strong>
    </div>
    <p>${sweep.requiresSignatures} wallet ${sweep.requiresSignatures === 1 ? "signature" : "signatures"} prepared. Check token approvals and router addresses before confirming on a live DEX adapter.</p>
    <ul>
      ${sweep.transactions.map((tx) => `<li>${tx.token.symbol} via ${tx.quote.adapterName}: ${formatTokenAmount(tx.quote.minimumOutputAmount, 6)} minimum USDC</li>`).join("")}
    </ul>
  `;
  els.reviewDialog.showModal();
}

async function confirmSweep(event) {
  event.preventDefault();
  const sweep = await state.cleaner.buildSweep(getSelectedEntries());

  if (!state.provider) {
    setStatus(`Demo sweep prepared for ${formatTokenAmount(sweep.totalOutput, 6)} USDC. Connect a wallet to sign real transactions.`);
    els.reviewDialog.close();
    return;
  }

  try {
    for (const tx of sweep.transactions) {
      await state.provider.request({ method: "eth_sendTransaction", params: [tx.txRequest] });
    }
    setStatus("Sweep transactions submitted.");
  } catch (error) {
    setStatus(`Sweep stopped: ${error.message}`);
  } finally {
    els.reviewDialog.close();
  }
}

async function ensureArcTestnet(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainId }]
    });
    els.networkStatus.textContent = "Arc Testnet";
  } catch (error) {
    if (error.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [ARC_TESTNET]
    });
  }
}

function getSelectedEntries() {
  return state.detected.filter((entry) => state.selected.has(entry.token.address) && entry.bestQuote);
}

function setBusy(isBusy, message) {
  els.scanWallet.disabled = isBusy;
  if (message) {
    setStatus(message);
  }
}

function setStatus(message) {
  els.statusBox.textContent = message;
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
