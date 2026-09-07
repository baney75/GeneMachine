const KNOWN_HEADERS = {
  rsid: ["rsid", "snp", "marker", "id"],
  chromosome: ["chromosome", "chrom", "chr"],
  position: ["position", "pos", "basepair"],
  genotype: ["genotype", "result", "call"],
  allele1: ["allele1", "allele_1"],
  allele2: ["allele2", "allele_2"],
};

const NO_CALLS = new Set(["", "--", "00", "0", "NC", "N/N", "./.", ".."]);
const VALID_CHROMOSOMES = new Set([...Array.from({ length: 22 }, (_, index) => String(index + 1)), "X", "Y", "XY", "MT"]);
const ANCESTRY_CHROMOSOMES = new Map([["23", "X"], ["24", "Y"], ["25", "XY"], ["26", "MT"]]);
export const MAX_INPUT_CHARACTERS = 50_000_000;
export const MAX_VARIANT_ROWS = 2_000_000;
const MAX_HEADER_COMMENT_CHARACTERS = 16_384;
const MAX_TOTAL_HEADER_CHARACTERS = 100_000;
const UNSUPPORTED_TEXT_FORMATTING_ERROR = "This file contains unsupported non-printing or non-ASCII formatting. Use the provider's original plain-text export without rich-text formatting.";

export const SLCO1B1_RS4149056_EVIDENCE = Object.freeze({
  id: "SLCO1B1-rs4149056-exact-marker-v1",
  version: "1.0.0",
  reviewedOn: "2026-09-06",
  gene: "SLCO1B1",
  marker: "rs4149056",
  referenceAllele: "T",
  alternateAllele: "C",
  supportedBuilds: Object.freeze({
    "37": Object.freeze({ chromosome: "12", position: 21331549 }),
    "38": Object.freeze({ chromosome: "12", position: 21178615 }),
  }),
  scope: "Exact-marker observation only. This record does not call a star allele, diplotype, phenotype, drug response, or dose.",
  sources: Object.freeze([
    Object.freeze({
      organization: "CPIC",
      title: "CPIC Guideline for Statins and SLCO1B1, ABCG2, and CYP2C9",
      url: "https://cpicpgx.org/guidelines/cpic-guideline-for-statins/",
      use: "Guideline context showing that SLCO1B1 genetic results may be relevant to statin prescribing when clinically established.",
    }),
    Object.freeze({
      organization: "ClinPGx",
      title: "SLCO1B1 c.521T>C (rs4149056) variant page",
      url: "https://www.clinpgx.org/variant/PA166154579",
      use: "Variant identity and pharmacogenomic evidence context.",
    }),
    Object.freeze({
      organization: "NCBI ClinVar",
      title: "SLCO1B1 c.521T>C (rs4149056) variation record",
      url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/37346/",
      use: "Pinned GRCh37 and GRCh38 chromosome coordinates and forward-strand T>C identity.",
    }),
  ]),
});

function cleanCell(value = "") {
  return value.trim().replace(/^"|"$/g, "");
}

function splitCsv(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(cleanCell(current));
      current = "";
    } else {
      current += character;
    }
  }
  values.push(cleanCell(current));
  return values;
}

function splitLine(line, delimiter) {
  return delimiter === "," ? splitCsv(line) : line.split("\t").map(cleanCell);
}

function normalizedHeader(cell) {
  return cleanCell(cell).toLowerCase().replace(/^#+\s*/, "").replace(/[\s_-]+/g, "");
}

function findColumn(headers, aliases) {
  return headers.findIndex((header) => aliases.some((alias) => normalizedHeader(alias) === header));
}

function mapColumns(cells) {
  const headers = cells.map(normalizedHeader);
  const columns = Object.fromEntries(
    Object.entries(KNOWN_HEADERS).map(([name, aliases]) => [name, findColumn(headers, aliases)]),
  );
  const hasCore = columns.rsid >= 0 && columns.chromosome >= 0 && columns.position >= 0;
  const hasCall = columns.genotype >= 0 || (columns.allele1 >= 0 && columns.allele2 >= 0);
  return hasCore && hasCall ? columns : null;
}

const KNOWN_HEADER_NAMES = new Set(
  Object.values(KNOWN_HEADERS).flat().map(normalizedHeader),
);

function isPureColumnHeader(cells, columns) {
  return Boolean(columns) && cells.every((cell) => KNOWN_HEADER_NAMES.has(normalizedHeader(cell)));
}

function detectBuild(comments) {
  const joined = comments.join(" ");
  const grch = joined.match(/(?:GRCh|build(?:\s+number)?(?:\s+is|\s*:)?\s*)(36|37|38)/i);
  if (!grch) return { value: null, label: "Not declared in header" };
  const number = grch[1];
  return { value: number, label: number === "38" ? "GRCh38 / build 38" : `GRCh${number} / build ${number}` };
}

function detectOrientation(comments, provider) {
  const forwardWords = String.raw`(?:forward|positive|plus)`;
  const reverseWords = String.raw`(?:reverse|negative|minus)`;
  const directionWords = String.raw`(?:${forwardWords}|${reverseWords})`;
  const declarationLines = comments
    .map((comment) => comment.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  const providerForwardLines = new Set();
  if (provider === "AncestryDNA") {
    for (let index = 0; index < declarationLines.length - 1; index += 1) {
      const first = declarationLines[index];
      const second = declarationLines[index + 1];
      const ancestryLead = /^(?:columns four and five\s+)?contain the two alleles observed at this snp \(genotype\)\. the genotype is reported$/i.test(first);
      const ancestryContinuation = /^on the forward\s*\(\s*\+\s*\)\s+strand with respect to the human reference\.$/i.test(second);
      if (ancestryLead && ancestryContinuation) {
        providerForwardLines.add(index);
        providerForwardLines.add(index + 1);
      }
    }
  }
  if (provider === "23andMe") {
    for (let index = 0; index < declarationLines.length; index += 1) {
      const line = declarationLines[index];
      if (/^genotype call oriented with respect to the plus strand on the human reference sequence\.$/i.test(line)) {
        providerForwardLines.add(index);
      }
      if (
        /^genotype call oriented with respect to the plus strand on the human reference$/i.test(line)
        && /^sequence\.(?:\s+we are using reference human assembly build (?:36|37|38)\.)?$/i.test(declarationLines[index + 1] ?? "")
      ) {
        providerForwardLines.add(index);
        providerForwardLines.add(index + 1);
      }
    }
  }
  const isCanonicalDeclaration = (line, words, symbol) => {
    const escapedSymbol = symbol === "+" ? String.raw`\+` : String.raw`\-`;
    const label = String.raw`(?:(?:${words})(?:\s*\(\s*${escapedSymbol}\s*\))?|\(\s*${escapedSymbol}\s*\)|${escapedSymbol})`;
    const simple = new RegExp(
      String.raw`^${label}[\s-]+(?:strand|orientation)(?:\s+orientation)?\.?$`,
      "i",
    );
    const nounFirst = new RegExp(
      String.raw`^(?:strand|orientation)\s*(?:(?:is|reported\s+(?:as|on))\s*|:|=)\s*(?:the\s+)?${label}\.?$`,
      "i",
    );
    const providerSentence = new RegExp(
      String.raw`^(?:the\s+)?(?:genotype(?:s)?|data|raw\s+data|alleles?)\s+(?:is|are)\s+(?:reported|oriented)\s+(?:on|as|to)\s+(?:the\s+)?${label}[\s-]+(?:strand|orientation)(?:\s+with respect to\s+(?:the\s+)?human reference(?:\s+sequence)?)?\.?$`,
      "i",
    );
    return simple.test(line) || nounFirst.test(line) || providerSentence.test(line);
  };
  const lineEvidence = declarationLines.map((line, index) => ({
    line,
    forward: providerForwardLines.has(index) || isCanonicalDeclaration(line, String.raw`forward|positive|plus`, "+"),
    reverse: isCanonicalDeclaration(line, String.raw`reverse|negative|minus`, "-"),
  }));
  const anyOrientationLanguage = new RegExp(
    String.raw`\b(?:strand|orientation|${directionWords})\b|(?:^|[\s:;,])(?:\(\s*[+-]\s*\)|[+-])\s*(?:strand|orientation)\b`,
    "i",
  );
  const standaloneAmbiguity = /^(?:is\s+)?(?:not|unknown|ambiguous|undetermined|unspecified|uncertain|unconfirmed|unverified|possible|possibly|perhaps|maybe|likely|probably|tentative|provisional)(?:\s+(?:confirmed|known|declared|specified|verified))?[\s.!;:,-]*$/i;
  const hasInvalidDirectionEvidence = lineEvidence.some(({ line, forward, reverse }) => (
    (anyOrientationLanguage.test(line) && !forward && !reverse)
    || standaloneAmbiguity.test(line)
  ));
  if (hasInvalidDirectionEvidence) {
    const combinedHeader = declarationLines.join(" ");
    const hasForwardSymbol = /\(\s*\+\s*\)|(?:^|[\s:;,/])\+\s*(?:strand|orientation)/i.test(combinedHeader);
    const hasReverseSymbol = /\(\s*-\s*\)|(?:^|[\s:;,/])-\s*(?:\/\s*\+\s*)?(?:strand|orientation)/i.test(combinedHeader);
    const hasConflictingDirections = (
      new RegExp(String.raw`\b${forwardWords}\b[\s\S]*\b${reverseWords}\b|\b${reverseWords}\b[\s\S]*\b${forwardWords}\b`, "i").test(combinedHeader)
      || (hasForwardSymbol && hasReverseSymbol)
    );
    return {
      value: null,
      label: hasConflictingDirections ? "Conflicting strand declarations" : "Ambiguous or qualified strand declaration",
      evidence: "File header conflict",
    };
  }

  const forward = lineEvidence.some((entry) => entry.forward);
  const reverse = lineEvidence.some((entry) => entry.reverse);
  if (forward && !reverse) {
    return { value: "forward", label: "Forward / plus strand declared", evidence: "File header" };
  }
  if (reverse && !forward) {
    return { value: "reverse", label: "Reverse / minus strand declared", evidence: "File header" };
  }
  return {
    value: null,
    label: forward && reverse ? "Conflicting strand declarations" : "Not declared in header",
    evidence: forward && reverse ? "File header conflict" : null,
  };
}

function detectProvider(comments, columns, headerText) {
  const evidence = `${comments.join(" ")} ${headerText}`.toLowerCase();
  if (evidence.includes("23andme")) return "23andMe";
  if (evidence.includes("ancestrydna") || evidence.includes("ancestry.com dna")) return "AncestryDNA";
  if (evidence.includes("myheritage")) return "MyHeritage";
  if (evidence.includes("family tree dna") || evidence.includes("familytreedna")) return "FamilyTreeDNA";
  if (columns?.allele1 >= 0) return "Generic split-allele consumer genotype text";
  return "Generic consumer genotype text";
}

function normalizeChromosome(value, provider) {
  const chromosome = cleanCell(value).replace(/^chr/i, "").toUpperCase();
  if (provider === "AncestryDNA" && ANCESTRY_CHROMOSOMES.has(chromosome)) {
    return ANCESTRY_CHROMOSOMES.get(chromosome);
  }
  return chromosome === "M" ? "MT" : chromosome;
}

function isNoCall(value) {
  const genotype = value.toUpperCase();
  return NO_CALLS.has(genotype) || (genotype.length <= 2 && /[N0.\-?]/.test(genotype));
}

function isValidCalledGenotype(value) {
  return /^[ACGTID]{1,2}$/.test(value.toUpperCase());
}

function chromosomeOrder(chromosome) {
  const numeric = Number(chromosome);
  if (Number.isFinite(numeric)) return numeric;
  return { X: 23, Y: 24, XY: 25, MT: 26, M: 26 }[chromosome] ?? 99;
}

export function parseConsumerDna(text, fileName = "consumer-dna.txt", options = {}) {
  if (/\.(zip|gz)$/i.test(fileName)) {
    throw new Error("Compressed exports are not opened in this milestone. Extract the archive locally, then choose the .txt or .csv file inside.");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("This file is empty.");
  }
  const normalizedText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (/[^\x09\x0A\x20-\x7E]/.test(normalizedText)) {
    throw new Error(UNSUPPORTED_TEXT_FORMATTING_ERROR);
  }
  const requestedLimit = Number.isFinite(options.maxCharacters) && options.maxCharacters > 0
    ? Math.floor(options.maxCharacters)
    : MAX_INPUT_CHARACTERS;
  const effectiveLimit = Math.min(requestedLimit, MAX_INPUT_CHARACTERS);
  const requestedRowLimit = Number.isFinite(options.maxVariantRows) && options.maxVariantRows > 0
    ? Math.floor(options.maxVariantRows)
    : MAX_VARIANT_ROWS;
  const effectiveRowLimit = Math.min(requestedRowLimit, MAX_VARIANT_ROWS);
  if (normalizedText.length > effectiveLimit) {
    throw new Error(`This file is too large to inspect safely in the browser (${normalizedText.length.toLocaleString()} characters; limit ${effectiveLimit.toLocaleString()}).`);
  }
  if (/^##fileformat=VCF|^#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT/im.test(normalizedText.slice(0, 100_000))) {
    throw new Error("VCF input is not supported. VCFs may contain multiple samples, phased calls, and fields this consumer-array importer does not validate.");
  }

  const lines = normalizedText.split("\n");
  const comments = [];
  let headerCommentCharacters = 0;
  const retainHeaderComment = (comment) => {
    if (/\t/.test(comment)) throw new Error(UNSUPPORTED_TEXT_FORMATTING_ERROR);
    if (
      comment.length > MAX_HEADER_COMMENT_CHARACTERS
      || headerCommentCharacters + comment.length > MAX_TOTAL_HEADER_CHARACTERS
    ) {
      throw new Error("The header is too large to verify build and strand orientation safely.");
    }
    comments.push(comment);
    headerCommentCharacters += comment.length;
  };
  let delimiter = null;
  let columns = null;
  let headerText = "";
  let firstDataIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    const candidate = raw.replace(/^#+\s*/, "");
    const candidateDelimiter = candidate.includes("\t") ? "\t" : candidate.includes(",") ? "," : null;
    const candidateCells = candidateDelimiter ? splitLine(candidate, candidateDelimiter) : [];
    const possibleColumns = candidateDelimiter ? mapColumns(candidateCells) : null;
    if (raw.startsWith("#") && !isPureColumnHeader(candidateCells, possibleColumns)) {
      retainHeaderComment(raw);
    }
    if (!candidateDelimiter) continue;
    if (possibleColumns) {
      const normalized = candidateCells.map(normalizedHeader);
      const sampleColumns = normalized.filter((header) => ["sample", "sampleid", "individual", "individualid"].includes(header));
      const genotypeColumns = normalized.filter((header) => KNOWN_HEADERS.genotype.some((alias) => normalizedHeader(alias) === header));
      if (sampleColumns.length > 0 || genotypeColumns.length > 1) {
        throw new Error("Multiple-sample or repeated genotype columns are not supported. Choose one person's original consumer raw-data export.");
      }
      delimiter = candidateDelimiter;
      columns = possibleColumns;
      headerText = candidate;
      firstDataIndex = index + 1;
      break;
    }
    if (!raw.startsWith("#")) {
      delimiter = candidateDelimiter;
      columns = { rsid: 0, chromosome: 1, position: 2, genotype: 3, allele1: -1, allele2: -1 };
      firstDataIndex = index;
      break;
    }
  }

  if (!columns || !delimiter || firstDataIndex < 0) {
    throw new Error("GeneMachine could not find consumer-genotype columns. Expected rsid, chromosome, position, and genotype/result (or allele1 + allele2).");
  }
  const provider = detectProvider(comments, columns, headerText);

  const chromosomes = new Map();
  const seenIds = new Set();
  const markers = [];
  let duplicateIds = 0;
  let malformedRows = 0;
  let noCalls = 0;
  let rsIdRows = 0;
  let variantRows = 0;

  for (let index = firstDataIndex; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    if (raw.startsWith("#")) {
      retainHeaderComment(raw);
      continue;
    }
    const cells = splitLine(raw, delimiter);
    const rsid = cleanCell(cells[columns.rsid]);
    const normalizedRsid = rsid.toLowerCase();
    const chromosome = normalizeChromosome(cells[columns.chromosome], provider);
    const position = Number(cleanCell(cells[columns.position]));
    const allele1 = columns.allele1 >= 0 ? cleanCell(cells[columns.allele1]).toUpperCase() : null;
    const allele2 = columns.allele2 >= 0 ? cleanCell(cells[columns.allele2]).toUpperCase() : null;
    const genotype = columns.genotype >= 0
      ? cleanCell(cells[columns.genotype]).toUpperCase()
      : `${allele1 ?? ""}${allele2 ?? ""}`;
    const noCall = columns.genotype >= 0
      ? isNoCall(genotype)
      : isNoCall(allele1 ?? "") || isNoCall(allele2 ?? "");

    if (
      !rsid
      || !VALID_CHROMOSOMES.has(chromosome)
      || !Number.isInteger(position)
      || position <= 0
      || (!noCall && !isValidCalledGenotype(genotype))
    ) {
      malformedRows += 1;
      continue;
    }
    variantRows += 1;
    if (variantRows > effectiveRowLimit) {
      throw new Error(`This file exceeds the ${effectiveRowLimit.toLocaleString()}-variant in-memory safety limit.`);
    }
    if (/^rs\d+$/i.test(rsid)) rsIdRows += 1;
    if (seenIds.has(normalizedRsid)) duplicateIds += 1;
    else seenIds.add(normalizedRsid);
    if (noCall) noCalls += 1;
    chromosomes.set(chromosome, (chromosomes.get(chromosome) ?? 0) + 1);
    markers.push(Object.freeze({
      rsid: normalizedRsid,
      chromosome,
      position,
      genotype: noCall ? null : genotype,
      noCall,
    }));
  }

  if (variantRows === 0) {
    throw new Error("The columns were recognized, but no valid variant rows were found.");
  }

  const build = detectBuild(comments);
  const orientation = detectOrientation(comments, provider);
  const callRate = (variantRows - noCalls) / variantRows;
  const rsIdRate = rsIdRows / variantRows;
  const chromosomeSummary = [...chromosomes.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => chromosomeOrder(a.name) - chromosomeOrder(b.name));

  const checks = [
    { label: "Recognized genotype structure", state: "pass", detail: `${provider} layout` },
    {
      label: "Genome build declared",
      state: build.value ? "pass" : "warn",
      detail: build.label,
    },
    {
      label: "Stable marker identifiers",
      state: rsIdRate >= 0.95 ? "pass" : "warn",
      detail: `${(rsIdRate * 100).toFixed(1)}% rsID rows`,
    },
    {
      label: "Array-scale row count",
      state: variantRows >= 10000 ? "pass" : "warn",
      detail: `${variantRows.toLocaleString()} parsed rows`,
    },
  ];

  const warnings = [];
  if (!build.value) warnings.push("Genome build is missing. Coordinate-based matching must stay locked until the build is verified.");
  if (malformedRows > 0) warnings.push(`${malformedRows.toLocaleString()} malformed row${malformedRows === 1 ? " was" : "s were"} skipped.`);
  if (duplicateIds > 0) warnings.push(`${duplicateIds.toLocaleString()} duplicate marker ID${duplicateIds === 1 ? " was" : "s were"} detected.`);
  if (variantRows < 10000) warnings.push("This is much smaller than a typical consumer array export. It may be a synthetic example or partial file.");
  warnings.push("Row count and call rate describe this file only; they do not establish pharmacogene coverage or clinical validity.");

  return {
    fileName,
    provider,
    build,
    orientation,
    delimiter: delimiter === "\t" ? "Tab-separated" : "Comma-separated",
    variantRows,
    noCalls,
    callRate,
    duplicateIds,
    malformedRows,
    rsIdRate,
    chromosomes: chromosomeSummary,
    markers: Object.freeze(markers),
    checks,
    warnings,
  };
}

export function findMarkerObservations(report, rsid) {
  if (!report || !Array.isArray(report.markers)) {
    throw new TypeError("A parsed GeneMachine report is required.");
  }
  const normalizedRsid = String(rsid).trim().toLowerCase();
  return report.markers.filter((marker) => marker.rsid === normalizedRsid);
}

function abstention(reasonCode, reason, observed = null) {
  return {
    status: "abstain",
    reasonCode,
    observedGenotype: observed,
    validation: { status: "not_validated", detail: reason },
  };
}

export function evaluateSlco1b1ExactMarker(report) {
  const evidence = SLCO1B1_RS4149056_EVIDENCE;
  const base = {
    evidence,
    phenotypeMapping: {
      status: "not_performed",
      detail: "An exact rs4149056 observation alone is not a GeneMachine phenotype, star-allele, or diplotype call.",
    },
    guidelineEvidence: {
      status: "context_only",
      detail: "CPIC identifies c.521T>C as a well-studied SLCO1B1 variant. The FDA association table lists SLCO1B1 521 TC or CC with simvastatin under potential safety or response impact. These sources do not validate this consumer row or provide a treatment decision.",
      sources: evidence.sources,
    },
    uncertainty: [
      "Consumer-array calls can contain assay, strand, labeling, or sample errors.",
      "This check does not assess phase, other SLCO1B1 variants, structural variation, or comprehensive pharmacogenomic coverage.",
      "Analytical and clinical confirmation are outside this software's validated scope.",
    ],
    clinicianDiscussion: "If this marker could affect a medication decision, discuss confirmatory clinical testing and the complete medication context with a qualified prescriber or pharmacist before changing treatment.",
    complexCalls: {
      status: "unavailable",
      detail: "CYP2D6, HLA, copy-number, structural-variant, phase-dependent, and other complex calls are unavailable from this exact-marker path.",
    },
  };

  if (!report?.build?.value || !Object.hasOwn(evidence.supportedBuilds, report.build.value)) {
    return { ...base, ...abstention("unsupported_or_missing_build", "GRCh37 or GRCh38 must be explicitly declared in the file header.") };
  }
  if (report?.orientation?.value !== "forward") {
    return { ...base, ...abstention("missing_or_unsupported_orientation", "Forward / plus strand orientation must be explicitly declared in the file header.") };
  }

  const observations = findMarkerObservations(report, evidence.marker);
  if (observations.length === 0) {
    return {
      ...base,
      ...abstention("marker_missing", `${evidence.marker} is absent; absence is unknown, not a reference or normal call.`),
      additionalTest: "A clinically validated pharmacogenetic test that directly assays SLCO1B1 and reports its validated interpretation scope.",
    };
  }
  if (observations.length > 1) {
    const calls = new Set(observations.map((observation) => observation.noCall
      ? "NO_CALL"
      : [...observation.genotype].sort().join("")));
    return {
      ...base,
      ...abstention(
        calls.size > 1 ? "conflicting_duplicate" : "duplicate_marker",
        calls.size > 1
          ? `${evidence.marker} appears more than once with conflicting observations.`
          : `${evidence.marker} appears more than once; duplicate rows are not interpreted.`,
        observations.map(({ chromosome, position, genotype, noCall }) => ({ chromosome, position, genotype, noCall })),
      ),
    };
  }

  const observation = observations[0];
  const expected = evidence.supportedBuilds[report.build.value];
  const observed = {
    marker: evidence.marker,
    chromosome: observation.chromosome,
    position: observation.position,
    genotype: observation.genotype,
    strand: report.orientation.value,
    build: report.build.value,
    source: "Observed directly in the imported file",
  };
  if (observation.noCall) {
    return { ...base, ...abstention("no_call", `${evidence.marker} is present but has no genotype call.`, observed) };
  }
  if (observation.chromosome !== expected.chromosome || observation.position !== expected.position) {
    return { ...base, ...abstention("coordinate_mismatch", `${evidence.marker} does not match the pinned ${report.build.label} coordinate.`, observed) };
  }
  if (!/^[CT]{2}$/.test(observation.genotype)) {
    return { ...base, ...abstention("unexpected_allele", `${evidence.marker} contains an allele outside the pinned forward-strand T/C definition.`, observed) };
  }

  return {
    ...base,
    status: "supported_observation",
    reasonCode: null,
    observedGenotype: observed,
    validation: {
      status: "input_consistency_checks_passed",
      detail: "The exact rsID, declared build, pinned coordinate, forward strand, and expected allele alphabet agree. This is not analytical or clinical validation.",
    },
  };
}

export function createPharmacogeneticCapabilityMap(report) {
  const exactMarker = evaluateSlco1b1ExactMarker(report);
  return {
    exactMarker: {
      status: exactMarker.status,
      marker: SLCO1B1_RS4149056_EVIDENCE.marker,
      gene: SLCO1B1_RS4149056_EVIDENCE.gene,
      reasonCode: exactMarker.reasonCode,
      detail: exactMarker.validation.detail,
    },
    starAlleles: { status: "unavailable", detail: "Required-site completeness and phase have not been validated." },
    copyNumberAndStructuralVariation: { status: "unavailable", detail: "Consumer-array rows do not establish copy number or structural alleles." },
    complexGenes: { status: "unavailable", detail: "CYP2D6 and HLA interpretation requires specialized, validated methods." },
  };
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
