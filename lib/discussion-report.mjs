import { formatPercent } from "./consumer-dna.mjs";

export const SOURCE_REVIEW_DATE = "September 6, 2026";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function formatGenotype(value) {
  return value ? value.split("").join("/") : "No call";
}

export function createDiscussionReportHtml({ report, finding, digest, isSynthetic }, options = {}) {
  const generatedOn = options.generatedOn ?? new Date();
  const observed = finding.observedGenotype && !Array.isArray(finding.observedGenotype)
    ? `${finding.observedGenotype.marker} ${formatGenotype(finding.observedGenotype.genotype)}, chromosome ${finding.observedGenotype.chromosome}:${finding.observedGenotype.position}`
    : "No single reportable observation";
  const limits = [...report.warnings, ...finding.uncertainty, finding.additionalTest ? `Additional evidence: ${finding.additionalTest}` : null].filter(Boolean);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GeneMachine discussion report</title><style>
  :root{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#102035;background:#edf4f1}*{box-sizing:border-box}body{margin:0}main{width:min(820px,calc(100% - 36px));margin:32px auto;background:#fff;padding:clamp(24px,6vw,64px);box-shadow:0 14px 50px #17314920}h1{font-size:2.7rem;line-height:1;margin:.2em 0}h2{font-size:1.2rem;margin-top:2rem}p,li{line-height:1.55}.kicker,.label{font-size:.72rem;letter-spacing:.12em;font-weight:800;color:#087967}.gate{border-left:5px solid ${finding.status === "supported_observation" ? "#14a389" : "#d9862f"};padding:16px 20px;background:#f2f8f6}.meta{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#d9e5e1;margin:24px 0}.meta div{background:#f7faf9;padding:14px}.meta span{display:block;font-size:.7rem;color:#5b6f70}.warning{border:1px solid #d9862f;padding:18px;background:#fff9f0}.sources a{display:block;color:#0b5a72;margin:.5rem 0}@media(max-width:600px){.meta{grid-template-columns:1fr}h1{font-size:2rem}}@media print{body{background:#fff}main{width:auto;margin:0;box-shadow:none;padding:0}a{color:#102035}}
  </style></head><body><main><p class="kicker">GENEMACHINE / DISCUSSION REPORT</p><h1>Evidence before interpretation</h1><p>Generated locally on ${escapeHtml(generatedOn.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}. ${isSynthetic ? "Synthetic demonstration; no person is represented." : "The original filename and raw genotype rows are intentionally excluded."}</p>
  <div class="meta"><div><span>SOURCE LAYOUT</span>${escapeHtml(report.provider)}</div><div><span>BUILD / ORIENTATION</span>${escapeHtml(report.build.label)} / ${escapeHtml(report.orientation.label)}</div><div><span>ROWS / CALL RATE</span>${report.variantRows.toLocaleString()} / ${escapeHtml(formatPercent(report.callRate))}</div><div><span>LOCAL INPUT SHA-256</span>${escapeHtml(digest)}</div></div>
  <section class="gate"><p class="label">EXACT-MARKER GATE</p><h2>${finding.status === "supported_observation" ? "File checks support one observation" : "GeneMachine abstained"}</h2><p><strong>Observed:</strong> ${escapeHtml(observed)}</p><p><strong>Input consistency:</strong> ${escapeHtml(finding.validation.detail)}</p><p><strong>Phenotype:</strong> ${escapeHtml(finding.phenotypeMapping.detail)}</p><p><strong>Guideline context:</strong> ${escapeHtml(finding.guidelineEvidence.detail)}</p></section>
  <h2>Question for a clinician or pharmacist</h2><p>${escapeHtml(finding.clinicianDiscussion)}</p><div class="warning"><strong>Do not change treatment from this report.</strong> Consumer-array data is not comprehensive clinical pharmacogenetic testing. Missing markers are unknown, not normal or reference calls.</div>
  <h2>Limits carried forward</h2><ul>${limits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  <h2>Sources reviewed ${SOURCE_REVIEW_DATE}</h2><div class="sources"><a href="https://files.cpicpgx.org/data/guideline/publication/statins/2022/publication.pdf">CPIC 2022 statin guideline</a><a href="https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations">FDA Table of Pharmacogenetic Associations</a><a href="https://www.clinpgx.org/variant/PA166154579">ClinPGx rs4149056 variant record</a><a href="https://www.ncbi.nlm.nih.gov/clinvar/variation/37346/">NCBI ClinVar c.521T&gt;C record</a><a href="https://www.pharmvar.org/gene/SLCO1B1">PharmVar SLCO1B1 definitions</a></div>
  <p><strong>Scope:</strong> Educational and research support. Not a medical device, clinical laboratory result, diagnosis, or prescription.</p></main></body></html>`;
}
