# Analytical scope and known gaps

Reviewed September 6, 2026. This document describes what the browser candidate was tested to do. It is not an analytical-validation study, clinical validation, regulatory review, or laboratory certification.

## Implemented scope

The local importer accepts one plain-text consumer genotype table with an rsID, chromosome, position, and combined genotype or split allele columns. It reports file-level counts, no-calls, malformed rows, duplicate rsIDs, chromosome row counts, declared build, and declared orientation. Inputs are limited to 50 million characters and 2 million retained variant rows in the parser; the browser rejects files over 80 MB before reading.

The only PGx lane is SLCO1B1 c.521T>C, rs4149056. GeneMachine reports an exact-marker observation only when all of these checks pass:

- the file explicitly declares GRCh37 or GRCh38;
- the file explicitly declares forward or plus orientation;
- rs4149056 appears exactly once with a called genotype;
- chromosome and position match the pinned NCBI ClinVar coordinate for that build;
- the genotype uses only the forward-strand T/C allele alphabet.

The software then says that the file-level consistency checks passed. It does not say the assay, sample, or genotype was analytically confirmed.

## Forced abstention

GeneMachine stops when the build or orientation is absent or unsupported, the marker is missing or a no-call, a duplicate exists, duplicate calls conflict, the coordinate does not match, or the observed allele is outside the pinned definition. Missing remains unknown. The interface names a clinically validated pharmacogenetic test as the next evidence when the locus is missing.

VCF, gVCF, BAM, CRAM, FASTQ, methylation, compressed archives, and multi-sample tables are not accepted by this browser importer. CYP2D6, HLA, star alleles, diplotypes, phenotype calls, phase, copy number, structural variation, medication response, and dose remain unavailable.

## Verification performed

The automated fixtures cover GRCh37 and GRCh38 exact-marker paths; missing locus; missing build; missing and reverse orientation; no-call; duplicate; conflicting duplicate; wrong coordinate; unexpected allele; malformed rows; unsupported chromosomes; VCF; multiple-sample headers; and configured size/row limits. The browser candidate is separately checked with synthetic fixtures for the visible journey, export, reset, network requests, and browser persistence.

## Known gaps before clinical use

- No wet-lab or orthogonal assay comparison was performed.
- No reference-material panel, sensitivity, specificity, accuracy, precision, reproducibility, interference, or report-interpretation study was performed.
- No provider array version was validated as comprehensive for SLCO1B1 or any drug decision.
- Header text is treated as provenance evidence, not proof that a provider generated or oriented the file correctly.
- The software does not validate sample identity, contamination, mosaicism, ploidy, sex chromosomes, relatedness, or chain of custody.
- The exact-marker observation does not establish a star allele, diplotype, phenotype, or medication recommendation.
- A qualified pharmacogenomics scientist or clinical laboratory professional has not reviewed this software as a clinical system.

The browser app is therefore appropriate only for local educational exploration and preparation for a professional discussion.
