import {
  formatPercent,
} from "../lib/consumer-dna.mjs";
import { createDiscussionReportHtml } from "../lib/discussion-report.mjs";

import { MAX_FILE_BYTES } from "../lib/local-analysis.mjs";
const fileInput = document.querySelector("#file-input");
const consentCheckbox = document.querySelector("#consent-checkbox");
const dropZone = document.querySelector("#drop-zone");
const demoButton = document.querySelector("#demo-button");
const cancelButton = document.querySelector("#cancel-button");
const resetButton = document.querySelector("#reset-button");
const exportButton = document.querySelector("#export-button");
const progressLine = document.querySelector("#progress-line");
const progressValue = document.querySelector("#progress-value");
const results = document.querySelector("#results");
const errorToast = document.querySelector("#error-toast");
let latestRequest = 0;
let activeWorker = null;
let demoController = null;
let activeResult = null;
let activeObjectUrl = null;
fileInput.tabIndex = -1;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showError(message) {
  errorToast.textContent = message;
  errorToast.hidden = false;
  window.clearTimeout(showError.timer);
  showError.timer = window.setTimeout(() => { errorToast.hidden = true; }, 10000);
}

function preferredScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function updateConsentState() {
  const allowed = consentCheckbox.checked;
  fileInput.disabled = !allowed;
  dropZone.disabled = !allowed;
  dropZone.classList.toggle("is-disabled", !allowed);
  dropZone.setAttribute("aria-disabled", String(!allowed));
  if (!allowed) {
    cancelInspection();
    scrubDerivedResult();
    fileInput.value = "";
  }
}

function scrubDerivedResult() {
  activeResult = null;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = null;
  results.hidden = true;
  document.querySelector("#result-title").textContent = "Local DNA file";
  document.querySelector("#result-summary").textContent = "";
  document.querySelector("#provenance-input").textContent = "Local file";
  document.querySelector("#provenance-hash").textContent = "Cleared";
  document.querySelector("#metric-grid").replaceChildren();
  document.querySelector("#chromosome-chart").replaceChildren();
  document.querySelector("#readiness-checks").replaceChildren();
  document.querySelector("#evidence-ladder").replaceChildren();
  document.querySelector("#capability-grid").replaceChildren();
  document.querySelector("#warning-list").replaceChildren();
  document.querySelector("#finding-lede").textContent = "";
  document.querySelector("#clinician-discussion").textContent = "";
  document.querySelector("#status-title").textContent = "";
  document.querySelector("#status-detail").textContent = "";
  document.querySelector("#finding-badge").textContent = "";
  document.querySelector("#finding-badge").dataset.state = "";
  document.querySelector("#result-kicker").textContent = "";
  document.querySelector("#synthetic-badge").textContent = "";
}

function formatGenotype(value) {
  return value ? value.split("").join("/") : "No call";
}

function renderMetrics(report) {
  const metrics = [
    ["Source layout", report.provider],
    ["Parsed markers", report.variantRows.toLocaleString()],
    ["File call rate", formatPercent(report.callRate)],
    ["Genome build", report.build.value ? `Build ${report.build.value}` : "Unknown"],
    ["Orientation", report.orientation.value === "forward" ? "Forward" : "Unverified"],
  ];
  const grid = document.querySelector("#metric-grid");
  grid.replaceChildren(...metrics.map(([label, value]) => {
    const metric = createElement("div", "metric");
    metric.append(createElement("span", "", label), createElement("strong", "", value));
    return metric;
  }));
}

function renderChromosomes(report) {
  const chart = document.querySelector("#chromosome-chart");
  const max = Math.max(...report.chromosomes.map((chromosome) => chromosome.count));
  const bars = report.chromosomes.map((chromosome, index) => {
    const wrapper = createElement("div", "chromosome-bar");
    wrapper.title = `Chromosome ${chromosome.name}: ${chromosome.count.toLocaleString()} rows`;
    const bar = createElement("i");
    bar.style.height = `${Math.max(5, Math.round((chromosome.count / max) * 178))}px`;
    bar.style.animationDelay = `${index * 22}ms`;
    wrapper.append(bar, createElement("span", "", chromosome.name));
    return wrapper;
  });
  chart.replaceChildren(...bars);
  chart.setAttribute("aria-label", report.chromosomes.map(({ name, count }) => `chromosome ${name}: ${count} rows`).join(", "));
}

function renderChecks(report) {
  const checks = [
    ...report.checks,
    {
      label: "Forward orientation declared",
      state: report.orientation.value === "forward" ? "pass" : "warn",
      detail: report.orientation.label,
    },
    {
      label: "No conflicting marker IDs",
      state: report.duplicateIds === 0 ? "pass" : "warn",
      detail: report.duplicateIds === 0 ? "No duplicate IDs found" : `${report.duplicateIds.toLocaleString()} duplicate ID rows`,
    },
  ];
  document.querySelector("#readiness-checks").replaceChildren(...checks.map((check) => {
    const row = createElement("div", "check-row");
    const state = createElement("span", `check-state ${check.state}`, check.state === "pass" ? "PASS" : "CHECK");
    row.append(state, createElement("b", "", check.label), createElement("small", "", check.detail));
    return row;
  }));
}

function renderWarnings(report, finding) {
  const warnings = [...report.warnings, ...finding.uncertainty];
  if (finding.additionalTest) warnings.push(`Next evidence needed: ${finding.additionalTest}`);
  document.querySelector("#warning-list").replaceChildren(
    ...warnings.map((warning) => createElement("li", "", warning)),
  );
}

function ladderStep(index, label, state, detail) {
  const item = createElement("li", "evidence-step");
  item.dataset.state = state;
  item.append(
    createElement("span", "step-index", String(index).padStart(2, "0")),
    createElement("strong", "", label),
    createElement("p", "", detail),
    createElement("span", "step-state", state),
  );
  return item;
}

function renderFinding(finding) {
  const supported = finding.status === "supported_observation";
  const badge = document.querySelector("#finding-badge");
  badge.textContent = supported ? "OBSERVATION SUPPORTED" : "ABSTAINED";
  badge.dataset.state = supported ? "supported" : "abstain";

  const observed = finding.observedGenotype && !Array.isArray(finding.observedGenotype)
    ? `${finding.observedGenotype.marker} ${formatGenotype(finding.observedGenotype.genotype)} at chromosome ${finding.observedGenotype.chromosome}:${finding.observedGenotype.position.toLocaleString()}`
    : "No single reportable observation";
  document.querySelector("#finding-lede").textContent = supported
    ? `This file contains ${observed}. The file-level consistency gates passed. The result is not clinically validated.`
    : finding.validation.detail;

  const steps = [
    ladderStep(1, "Observed genotype", finding.observedGenotype ? "observed" : "unknown", observed),
    ladderStep(2, "Input consistency", supported ? "passed" : "stopped", finding.validation.detail),
    ladderStep(3, "Phenotype mapping", "not performed", finding.phenotypeMapping.detail),
    ladderStep(4, "Guideline context", "context only", finding.guidelineEvidence.detail),
    ladderStep(5, "Clinical decision", "outside scope", "Clinical confirmation and professional interpretation are required before any medication change."),
  ];
  document.querySelector("#evidence-ladder").replaceChildren(...steps);
  document.querySelector("#clinician-discussion").textContent = finding.clinicianDiscussion;
}

function renderCapabilityMap(capability) {
  const items = [
    ["EXACT", "Exact marker", capability.exactMarker],
    ["PHASE", "Star alleles", capability.starAlleles],
    ["CNV", "Copy number / structure", capability.copyNumberAndStructuralVariation],
    ["CYP / HLA", "Complex genes", capability.complexGenes],
  ];
  document.querySelector("#capability-grid").replaceChildren(...items.map(([code, title, item]) => {
    const card = createElement("div", "capability");
    card.dataset.state = item.status;
    card.append(createElement("span", "capability-code", code), createElement("h4", "", title), createElement("p", "", item.detail));
    return card;
  }));
}

function renderReport(report, finding, digest, capability, isSynthetic = false) {
  activeResult = { report, finding, digest, isSynthetic };
  document.querySelector("#result-title").textContent = isSynthetic ? "Synthetic exact-marker fixture" : "Local DNA file";
  document.querySelector("#result-kicker").textContent = `${report.provider.toUpperCase()} / ${report.delimiter.toUpperCase()}`;
  document.querySelector("#result-summary").textContent = isSynthetic
    ? "This fixture contains no person. It demonstrates the supported exact-marker path."
    : "The original filename and raw rows are not shown or included in the discussion report.";
  document.querySelector("#synthetic-badge").hidden = !isSynthetic;
  document.querySelector("#synthetic-badge").textContent = isSynthetic ? "EXAMPLE, NOT YOUR DNA" : "";
  document.querySelector("#provenance-input").textContent = isSynthetic ? "Built-in synthetic fixture" : "User-selected local file";
  document.querySelector("#provenance-hash").textContent = `${digest.slice(0, 16)}...`;

  const supported = finding.status === "supported_observation";
  document.querySelector("#status-title").textContent = supported ? "One exact-marker observation passed the file checks" : "GeneMachine stopped before interpretation";
  document.querySelector("#status-detail").textContent = supported
    ? "Star allele, phenotype, medication response, and dose remain outside this result."
    : finding.validation.detail;
  document.querySelector("#status-banner").dataset.state = supported ? "supported" : "abstain";
  renderMetrics(report);
  renderChromosomes(report);
  renderChecks(report);
  renderFinding(finding);
  renderCapabilityMap(capability);
  renderWarnings(report, finding);
  results.hidden = false;
  results.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
}

function cancelInspection() {
  latestRequest += 1;
  if (activeWorker) activeWorker.terminate();
  activeWorker = null;
  if (demoController) demoController.abort();
  demoController = null;
  cancelButton.hidden = true;
  progressLine.hidden = true;
  progressValue.style.width = "0";
  document.querySelector("#analysis-status").textContent = "";
}

function beginInspection() {
  cancelInspection();
  scrubDerivedResult();
  errorToast.hidden = true;
  cancelButton.hidden = false;
  progressLine.hidden = false;
  progressValue.style.width = "12%";
  document.querySelector("#analysis-status").textContent = "Starting local analysis. You can cancel at any time.";
  return latestRequest;
}

function inspectInWorker(payload, requestId, isSynthetic) {
  try {
    const worker = new Worker(new URL("./analysis-worker.js", import.meta.url), { type: "module" });
    activeWorker = worker;
    const finish = () => {
      worker.terminate();
      if (activeWorker === worker) activeWorker = null;
      cancelButton.hidden = true;
      progressLine.hidden = true;
      document.querySelector("#analysis-status").textContent = "";
      fileInput.value = "";
    };
    worker.onmessage = ({ data }) => {
      if (requestId !== latestRequest) return;
      if (data.stage) {
        progressLine.setAttribute("aria-label", data.stage);
        document.querySelector("#analysis-status").textContent = data.stage;
        progressValue.style.width = "55%";
        return;
      }
      finish();
      if (data.error) { showError(data.error); return; }
      const { report, finding, digest, capability } = data.result;
      renderReport(report, finding, digest, capability, isSynthetic);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (requestId !== latestRequest) return;
      finish();
      showError("The local analysis could not start. Try a fresh page in a browser with Web Worker support.");
    };
    worker.postMessage(payload);
  } catch {
    cancelInspection();
    showError("The local analysis could not start. Open GeneMachine through its local server in a current browser.");
  }
}

function inspectFile(file) {
  if (!consentCheckbox.checked) {
    fileInput.value = "";
    showError("Consent to local-only processing and acknowledge the clinical boundary before choosing a DNA file.");
    return;
  }
  const requestId = beginInspection();
  if (file.size > MAX_FILE_BYTES) {
    cancelInspection();
    fileInput.value = "";
    showError("This file is larger than the 80 MB browser safety limit.");
    return;
  }
  inspectInWorker({ file }, requestId, false);
}

function exportDiscussionReport() {
  if (!activeResult) return;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  const html = createDiscussionReportHtml(activeResult);
  activeObjectUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = activeObjectUrl;
  link.download = "genemachine-discussion-report.html";
  link.click();
}

function resetAnalysis() {
  cancelInspection();
  scrubDerivedResult();
  fileInput.value = "";
  errorToast.hidden = true;
  document.querySelector("#import-card").scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  demoButton.focus();
}

consentCheckbox.addEventListener("change", updateConsentState);
fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) inspectFile(fileInput.files[0]);
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (consentCheckbox.checked) dropZone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}
dropZone.addEventListener("drop", (event) => {
  if (!consentCheckbox.checked) {
    showError("Consent to local-only processing and acknowledge the clinical boundary before choosing a DNA file.");
    consentCheckbox.focus();
    return;
  }
  const file = event.dataTransfer?.files?.[0];
  if (file) inspectFile(file);
});

dropZone.addEventListener("click", () => {
  fileInput.click();
});

cancelButton.addEventListener("click", () => {
  cancelInspection();
  scrubDerivedResult();
  showError("File reading was canceled. No result was retained.");
});

demoButton.addEventListener("click", async () => {
  const requestId = beginInspection();
  const controller = new AbortController();
  demoController = controller;
  try {
    const response = await fetch("../samples/synthetic-ancestry.txt", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("The synthetic example is unavailable.");
    const text = await response.text();
    if (requestId !== latestRequest) return;
    demoController = null;
    inspectInWorker({ text }, requestId, true);
  } catch (error) {
    if (requestId !== latestRequest) return;
    cancelInspection();
    showError(error instanceof Error ? error.message : "The synthetic example could not be loaded.");
  }
});

window.addEventListener("pagehide", () => { cancelInspection(); scrubDerivedResult(); fileInput.value = ""; });

resetButton.addEventListener("click", resetAnalysis);
exportButton.addEventListener("click", exportDiscussionReport);
updateConsentState();

if (new URLSearchParams(window.location.search).get("demo") === "1") demoButton.click();
