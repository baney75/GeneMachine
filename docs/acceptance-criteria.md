# GeneMachine consumer PGx candidate acceptance criteria

Frozen for the September 6, 2026 candidate. These are product gates, not a claim of clinical validation or award eligibility.

## Journey

- A person can find current first-party instructions for retrieving an existing AncestryDNA or 23andMe export before being shown a purchase path.
- Import requires a plain-language privacy/consent acknowledgement. The chosen file is read locally, held only in memory, and reset is visible and complete.
- Import reports provider/layout evidence, declared build, orientation evidence, call rate, malformed rows, duplicates, chromosome coverage, and specific warnings.
- The product exposes exactly one narrow PGx lane: a versioned, source-linked SLCO1B1 rs4149056 exact-marker observation. It does not manufacture a star allele, diplotype, phenotype, drug choice, or dose.
- The exact-marker lane proceeds only for an unambiguous called genotype with supported build, explicit forward/plus orientation, expected coordinate, and no duplicate conflict. Missing, no-call, conflicting, unsupported-build, or ambiguous-orientation inputs abstain and name the missing evidence.
- A user can export a self-contained discussion report that excludes raw rows and the original filename, separates observation from validation/evidence/uncertainty, and advises clinical confirmation at the decision point.

## Scientific and privacy boundaries

- Missing markers are unknown, never reference or normal calls. Array call rate is never described as gene coverage.
- Complex CYP2D6, HLA, copy-number, structural, and phased calls remain unavailable.
- Consumer arrays are described as sparse genotyping, not sequencing or comprehensive clinical PGx.
- No raw DNA, report content, filename, genotype, hash, or error text is sent to analytics, logs, storage APIs, service workers, Runpod, 1min.ai, or another origin.
- Synthetic fixtures are conspicuously labeled and never described as a person or clinical truth.

## Product quality and verification

- `npm test` proves supported and abstaining library paths, malformed/no-call/duplicate cases, and report escaping.
- A browser journey proves consent, synthetic demo, supported finding, report export, reset/deletion, a meaningful import error, keyboard focus, reduced motion, and no unexpected network/persistence activity.
- Render evidence covers desktop, a narrow phone, and 200% zoom. Chromium and WebKit are attempted and named; unavailable Safari/iOS hardware is disclosed.
- Performance is measured on the local `/web/?demo=1` route with a named browser, viewport, and network conditions. Lab results are not presented as field Core Web Vitals.
- An independent Terra reviewer returns PASS on an immutable candidate after challenging scientific certainty, privacy, accessibility, design, security, and the real journey.
