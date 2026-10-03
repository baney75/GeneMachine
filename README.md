<p align="center"><img src="assets/wordmark.svg" alt="GeneMachine" width="760"></p>

# Genetics and medicine, with the evidence visible

GeneMachine is a free educational browser app and an Agent Skill for genomic research. The app helps you understand established gene–medicine evidence, prepare questions for a care team, and inspect a compatible consumer DNA export on your own device.

You can use the medicine library without a DNA file, account, subscription, or paid kit. Optional DNA checking runs in a local Web Worker. Genetic data is never sent to an AI service by the browser app.

## Start here

**[Open GeneMachine](https://genemachine.magnus-b37.workers.dev/)** to use the educational app in your browser. No installation is required. For the source-backed product evaluation, [read the published evaluation](https://genemachine.magnus-b37.workers.dev/docs/product-evaluation.html).

To run your own local copy:

Install [Node.js](https://nodejs.org/) 22 or later and Git, then:

```bash
git clone https://github.com/baney75/GeneMachine.git
cd GeneMachine
npm start
```

Open **http://127.0.0.1:4173/**. The app requires no runtime packages or API keys. Search for `clopidogrel` or `CYP2D6`, open a topic, and choose **Add this question**. Build a list of up to five topics and download a printable appointment checklist. Open the downloaded HTML file in your browser to print or save as PDF.

To see the DNA workflow without using anyone’s data, choose **Try the synthetic example**. You should see **OBSERVATION SUPPORTED**, an explicit synthetic label, and a single rs4149056 observation with its limits. **Clear this DNA now** clears the displayed finding.

For a private file, read the privacy explanation, consent to local-only processing, and choose an original `.txt`, `.tsv`, or `.csv` export. Extract ZIP files on your device first. See the official [23andMe](https://support.23andme.org/hc/en-us/articles/42965156401687-Accessing-Your-Raw-Genetic-Data) and [AncestryDNA](https://help.ancestry.com/hc/en-us/articles/53933317283603-Downloading-DNA-Data) instructions. No new kit is needed to use the library.

## What the app provides

- Seven source-linked learning topics: statins, clopidogrel, thiopurines, fluorouracil/capecitabine, codeine/tramadol, warfarin, and tacrolimus. Search recognizes medicine names, several brand names, genes, and categories.
- General evidence, individual unknowns, testing questions, and a local appointment checklist. Library topics are educational; they are never matched to your DNA or presented as your prescriptions.
- File-quality checks, chromosome row counts, declared genome build and strand, no-calls, duplicate markers, and an original-byte SHA-256 digest.
- One gated **SLCO1B1 rs4149056 observation**, or a specific reason the tool cannot report it. Build 37/38, forward strand, exact coordinate, valid alleles, and a unique called row must agree.
- A separate source-backed DNA discussion report, with the original filename and full genotype table excluded.

The checker does not call star alleles, diplotypes, phenotypes, CYP2D6, HLA, copy number, or structural variants. A missing marker is unknown. A high file call rate does not establish pharmacogene coverage. The medicine library does not expand the DNA checker’s analytical scope.

## Privacy and medical scope

Raw DNA is read and parsed in a worker that is terminated after analysis or cancellation. Only aggregate quality checks and the narrow supported finding reach the interface. No analytics, accounts, localStorage, sessionStorage, IndexedDB, or external API is used. Withdrawing consent clears the derived DNA result. Reset cannot delete your original file or a downloaded report. Downloads contain sensitive findings or selected learning topics; store and share them deliberately. Browser extensions, a compromised device, or a modified app are outside these software guarantees.

This app provides educational exploration and discussion support. It has no clinical validation or regulatory clearance. It does not diagnose a condition, predict individual medication response, or recommend a dose or treatment change. Clinical medication decisions require qualified professional interpretation and appropriate confirmation. Medical content and DPYD updates need continued qualified review.

Read the [analytical scope](docs/analytical-scope.md), [source register](docs/consumer-pgx-sources.md), [product evaluation](docs/product-evaluation.html), and [security guidance](SECURITY.md).

## Verify or host the app

The local server binds only to loopback, exposes public app files, rejects uploads, and sends restrictive content-security and referrer headers. To use another local port: `GENEMACHINE_PORT=4174 npm start`.

```bash
npm install
npx playwright install chromium webkit
npm test
npm run test:browser
npm run test:experience
npm run test:design
npm run build
```

The browser checks exercise import, technical abstention, consent, cancellation, exports, medication search, checklist limits, responsive reflow, and requests/storage in Chromium and Playwright WebKit. WebKit is not a native iPhone or Safari-device test. Synthetic fixtures test software behavior; they do not establish clinical accuracy or real-user comprehension.

Keep the default page under 220 rendered words. Evidence, file guidance, and technical checks open on demand; consent, the primary finding, source links, and a short educational boundary remain visible in their relevant flows. `test:design` checks this presentation and its disclosures in both browser engines.

`npm run build` produces `dist/`, containing only the static app, libraries, brand assets, synthetic example, and hosting rules. Serve it over HTTPS or localhost so workers and cryptographic hashing work. Preserve its folder structure; `/web/` is the app entry. Building is separate from deployment.

The checked-in Cloudflare configuration serves static assets in Donovan's Personal account, with no database or upload endpoint. `hosting/_headers` preserves the local server's content-security, referrer, MIME, and cache protections. The root redirects to `/web/`. To release from an authorized Cloudflare login:

```bash
npm ci
npx wrangler login
npm run deploy
```

Deployment uses the pinned Wrangler version and the `genemachine` Worker name in `wrangler.jsonc`. Review the account and name before deploying a fork. No custom domain is configured. The deployed site still performs DNA parsing inside the visitor's browser.

To run the same synthetic experience checks against a deployed HTTPS origin, set `GENEMACHINE_TEST_ORIGIN` to that origin and run `npm run test:experience`. This checks the live worker, downloads, security headers, request origins, browser storage, mobile reflow, and blocked upload methods in both browser engines.

## Install the Agent Skill

The browser app runs without an AI agent. The separate `SKILL.md` describes how an authorized agent should route genomic research through compatible tools, quality checks, current evidence, and inspected reports. The skill is a procedure, not bundled sequencing software or proof that every listed workflow is available.

```bash
git clone https://github.com/baney75/GeneMachine.git ~/.codex/skills/genemachine
```

Different input classes require different tools and validation. The browser importer accepts one consumer genotype table; VCF/gVCF, BAM/CRAM, FASTQ, methylation, and multi-sample inputs require a separate reference-aware workflow. Never send a genome to an external destination without its owner’s explicit consent for that destination and purpose.

## Contribute

Use synthetic fixtures only. Do not submit a real genome, report, identifying filename, private record, or credential in an issue or pull request. Medical claims need dated primary sources. Tests must preserve unknown values rather than inventing reference calls. See [SECURITY.md](SECURITY.md).

Licensed under Apache-2.0. Copyright 2026 Donovan Baney and contributors.
