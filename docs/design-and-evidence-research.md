# Design and evidence research brief

Reviewed September 6, 2026. Official criteria are recorded separately from GeneMachine's internal design choices. No entry, nomination, score, or award is claimed.

## Official award criteria

| Program | Current official criteria used | GeneMachine response |
| --- | --- | --- |
| [Awwwards](https://www.awwwards.com/sites/1910-genetics) | Current scorecards weight design, usability, creativity, and content; the development review also surfaces semantics/SEO, accessibility, performance, responsive design, and metadata. | Let the evidence ladder and capability map be the memorable interaction. Keep the main flow legible, fast, semantic, and useful without decorative WebGL. |
| [The Webby Awards 2025/2026 judging criteria](https://www.webbyawards.com/judging-criteria/) | Websites and mobile sites are judged on content, structure/navigation, visual design, functionality, interactivity, innovation, and overall experience. The visual-design criterion explicitly includes inclusion for disabled people. | Make privacy consent, import, interpretation boundaries, and recovery one coherent route. Treat accessibility and cross-platform function as product quality. |
| [CSS Design Awards](https://www.cssdesignawards.com/about) | The program describes its public categories as UI design, UX design, and innovation; its FAQ defines UI as aesthetics/effects, UX as experience/functionality, and innovation as new design/development ideas. | Use a distinctive but restrained scientific visual system. Innovation is transparent abstention and explanatory state, not a novelty animation. |

## Comparable experiences inspected

| Experience | Useful technique | What GeneMachine deliberately does differently |
| --- | --- | --- |
| [1910 Genetics](https://www.awwwards.com/sites/1910-genetics) | Scientific storytelling uses a strong timeline/pipeline and polished motion to make a complex process feel navigable. | GeneMachine turns the pipeline into a five-layer evidence ladder whose states are driven by the imported file. Motion is secondary and reduced-motion safe. |
| [GUÍA](https://guiagenomics.com/) | Patient-facing genomic results interleave plain-language explanation with deeper scientific links. | GeneMachine puts uncertainty and the clinical confirmation boundary beside the finding rather than burying them in a footer or disclaimer. |
| [23andMe raw-data access](https://customercare.23andme.com/hc/en-us/articles/212196868-Accessing-Your-Raw-Genetic-Data) | The official article provides multiple recovery paths and warns that only a subset of raw markers is individually validated. | GeneMachine starts with the file a person may already own, retains that limitation, and never upgrades a raw row into a clinical result merely because it parsed. |

## Chosen product direction

Audience: a consumer who already has raw genotype data and wants to prepare a safer medication conversation. Primary job: understand whether the file supports one narrow, cited PGx observation and exactly why GeneMachine proceeds or abstains. Desired feeling: capable, calm, and appropriately cautious. Truthful proof: local-only processing, visible technical gates, source/version dates, and a report whose layers cannot be confused with prescribing advice.

The distinguishing idea is an **evidence ladder**: observed row -> technical validation -> clinical phenotype boundary -> guideline context -> discussion prompt. The state changes with the file; uncertainty is not decoration or a generic disclaimer.

## Narrow scientific path

The candidate uses only the SLCO1B1 c.521T>C exact marker, rs4149056. The [2022 CPIC statin guideline](https://files.cpicpgx.org/data/guideline/publication/statins/2022/publication.pdf) describes rs4149056 as the most common and well-studied SLCO1B1 variant and notes that it can be genotyped alone. The [FDA pharmacogenetic associations table](https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations) lists simvastatin with SLCO1B1 521 TC or CC under associations with potential safety/response impact, while warning that table inclusion is not a universal testing or treatment recommendation. [PharmVar's SLCO1B1 page](https://www.pharmvar.org/gene/SLCO1B1) remains the allele-definition authority.

GeneMachine therefore reports an exact-marker observation only. It does not assign a star allele, diplotype, phenotype, or prescribing recommendation. Even a technically validated row remains a discussion point that requires clinical confirmation before a medication decision. The complex-caller route remains out of scope: [PharmCAT](https://github.com/PharmGKB/PharmCAT) is pinned in documentation as the appropriate future validated VCF lane, but consumer export compatibility is not assumed and no PharmCAT run is represented by this candidate.

## Provider support and current acquisition facts

See [consumer-pgx-sources.md](consumer-pgx-sources.md) for the dated matrix. The first choice is always an existing export. The current U.S. Ancestry comparison page listed the base AncestryDNA kit at $99 before shipping on September 6, 2026; its [shipping page](https://support.ancestry.com/s/article/AncestryDNA-Shipping) listed $9.95 standard U.S. shipping for a first kit. Taxes, promotions, availability, memberships, and checkout totals can change. No 23andMe price is copied because a current stable official U.S. base price was not independently verified during this review.
