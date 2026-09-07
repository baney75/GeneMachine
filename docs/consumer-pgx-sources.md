# Consumer pharmacogenetics source register

Evidence reviewed on 2026-09-06. These sources support the local app's onboarding, one exact-marker evidence lane, and safety language. They do not clinically validate GeneMachine or a medication interpretation engine.

| Source | What GeneMachine uses it for |
| --- | --- |
| [23andMe: Accessing Your Raw Genetic Data](https://customercare.23andme.com/hc/en-us/articles/212196868-Accessing-Your-Raw-Genetic-Data) | Current first-party path to browse and download a customer's raw genotyping data. |
| [Ancestry: Downloading DNA Data](https://support.ancestry.com/s/article/Downloading-DNA-Data) | Current first-party download help page linked from onboarding. The page may require regional selection or client-side scripts. |
| [AncestryDNA kit page](https://www.ancestry.com/dna/) | First-party page for current kit and bundle options. GeneMachine does not copy a sale price because pricing, renewal terms, and bundles change. |
| [23andMe DNA Test Kit Service Options](https://customercare.23andme.com/hc/en-us/articles/202908020-23andMe-DNA-Test-Kit-Service-Options) | First-party comparison of current service tiers. It states that ancestry services include access to a raw, uninterpreted file and that the file must not be used for medical or diagnostic purposes. |
| [H600 Microarray File Formats](https://wiki.h600.org/Microarray%2BFile%2BFormats) | Technical format reference for provider-generated raw files. It documents AncestryDNA's numeric non-autosomal encoding: 23 = X, 24 = Y, 25 = X/Y pseudoautosomal region, and 26 = mitochondrial. GeneMachine applies this mapping only when the file identifies itself as AncestryDNA. |
| [CPIC Guidelines](https://cpicpgx.org/guidelines/) | CPIC guidelines explain how available genetic test results can inform drug therapy. CPIC states that the site is not intended for direct diagnostic use or medical decisions without professional review. |
| [FDA: Direct-to-Consumer Tests](https://www.fda.gov/medical-devices/in-vitro-diagnostics/direct-consumer-tests) | Consumer tests vary in variants and evidence. The FDA says consumers should not make treatment decisions from these results alone and describes independent confirmation and provider discussion as appropriate safeguards. |
| [FDA: 23andMe pharmacogenetic report authorization](https://www.fda.gov/news-events/press-announcements/fda-authorizes-first-direct-consumer-test-detecting-genetic-variants-may-be-associated-medication) | Even the reviewed 23andMe pharmacogenetic report does not determine whether a medication is appropriate; results should be confirmed before medical decisions. This does not confer authorization or clinical validity on third-party raw-file interpretation. |
| [CPIC 2022 SLCO1B1, ABCG2, CYP2C9 and statin guideline](https://files.cpicpgx.org/data/guideline/publication/statins/2022/publication.pdf) | Describes SLCO1B1 c.521T>C (rs4149056) as a common, well-studied variant that can be genotyped alone. GeneMachine uses this only to support a technically gated exact-marker observation; it does not copy treatment recommendations. |
| [FDA Table of Pharmacogenetic Associations](https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations) | Lists simvastatin with SLCO1B1 521 TC or CC under potential safety/response impact and emphasizes that table inclusion is not a universal test or treatment recommendation. |
| [PharmVar SLCO1B1](https://www.pharmvar.org/gene/SLCO1B1) | Current allele-definition authority. Its multi-variant haplotypes are why the app does not manufacture a star allele from one consumer-array marker. |
| [ClinPGx rs4149056](https://www.clinpgx.org/variant/PA166154579) | Current ClinPGx variant endpoint. The app uses it as evidence context, not as proof that a consumer row is clinically validated. |
| [NCBI ClinVar VCV000037346.109](https://www.ncbi.nlm.nih.gov/clinvar/variation/37346/) | Confirms the c.521T>C identity and pinned coordinates at chromosome 12:21331549 on GRCh37 and 12:21178615 on GRCh38. |
| [PharmCAT releases](https://github.com/PharmGKB/PharmCAT/releases) | Current maintained caller reference. Version 3.4.0 was the latest visible release on 2026-09-06. It is documented as a future validated VCF lane, not bundled or run by this browser candidate. |

## Dated provider/file support matrix

| Source / layout | Import support | Interpretation support | Known boundaries |
| --- | --- | --- | --- |
| 23andMe tab-separated raw text | Yes, when the expected header/columns are present | SLCO1B1 rs4149056 exact-marker observation only when build 37/38, explicit forward/plus orientation, expected coordinate, unambiguous genotype, and no conflicting duplicate are present | Consumer microarray; not comprehensive sequencing or clinical PGx. 23andMe says only a subset of raw markers is individually validated and the raw data is informational. |
| AncestryDNA split-allele tab-separated text | Yes, including provider-specific chromosome codes | Same narrow exact-marker gate; ambiguous strand/orientation abstains | Consumer microarray; array version and exported markers can vary. Missing marker means unknown. |
| Generic `.txt`, `.tsv`, or `.csv` genotype table | Technical import when core columns are recognized | Abstains unless the file explicitly declares a supported build and forward/plus orientation | Provider/assay provenance may be insufficient even when rows parse. |
| ZIP/GZIP archive | No | No | Extract locally first. Archives are never uploaded or opened in the app. |
| VCF/gVCF, sequencing, BAM/CRAM/FASTQ, methylation, multi-sample table | No in this browser candidate | No | Requires a separate reference-aware validated workflow and, for complex PGx, required-position, phase, copy-number, and structural-variant handling. |

## Current lower-cost path, United States

Use an existing export first for $0. If no suitable file exists, the [Ancestry product comparison](https://www.ancestry.com/c/dna/compare-ancestry-dna-test-kits?geo-lang=en) showed a $99 U.S. base AncestryDNA kit on 2026-09-06, excluding shipping; Ancestry's [shipping page](https://support.ancestry.com/s/article/AncestryDNA-Shipping) listed $9.95 standard U.S. shipping for the first kit. Taxes, promotions, memberships, availability, and checkout total can change. This consumer ancestry kit is not recommended as a comprehensive clinical PGx test. No current 23andMe price is copied because a stable first-party U.S. base price was not independently verified during this review.

## Boundary carried into the product

The app reports what it observes in the selected text file: layout, declared build/orientation, row counts, rsID proportion, no-call rate, malformed rows, duplicate marker IDs, chromosome counts, and a strictly gated rs4149056 observation. It does not infer star alleles, phase, copy number, HLA type, phenotype, medication suitability, or dose. A high file call rate is not pharmacogene coverage. A missing tested allele is unknown, not a comprehensive negative result.

The raw file stays in browser memory. No raw row, original filename, derived genotype, hash, or report is sent to analytics, logs, browser storage, external AI, Runpod, or another origin. Export is a deliberate local download containing only the displayed, derived discussion summary; it excludes raw rows and the original filename.
