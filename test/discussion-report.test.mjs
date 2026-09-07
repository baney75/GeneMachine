import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateSlco1b1ExactMarker, parseConsumerDna } from "../lib/consumer-dna.mjs";
import { createDiscussionReportHtml, escapeHtml } from "../lib/discussion-report.mjs";

test("escapes untrusted text in the discussion report", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("exports the supported summary without the original filename or raw rows", () => {
  const fixtureUrl = new URL("../samples/reference/slco1b1-rs4149056-grch37-forward.tsv", import.meta.url);
  const raw = readFileSync(fixtureUrl, "utf8");
  const secretFileName = "donovan-private-genome.txt";
  const report = parseConsumerDna(raw, secretFileName);
  const finding = evaluateSlco1b1ExactMarker(report);
  const html = createDiscussionReportHtml(
    { report, finding, digest: "a".repeat(64), isSynthetic: true },
    { generatedOn: new Date("2026-09-06T12:00:00Z") },
  );
  assert.match(html, /File checks support one observation/);
  assert.match(html, /rs4149056 T\/C/);
  assert.match(html, /Do not change treatment/);
  assert.match(html, /sparse genotyping, not sequencing/);
  assert.match(html, /ClinPGx rs4149056 variant record/);
  assert.doesNotMatch(html, new RegExp(secretFileName));
  assert.doesNotMatch(html, /# Forward strand/);
  assert.doesNotMatch(html, /rsid\s+chromosome\s+position/);
  assert.match(html, new RegExp(`LOCAL INPUT SHA-256</span>${"a".repeat(64)}`));
  assert.match(html, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /break-inside:avoid/);
});
