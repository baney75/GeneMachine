import { escapeHtml } from './discussion-report.mjs';

export const LIBRARY_REVIEW_DATE = '2026-10-09';
export const MAX_QUESTIONS = 5;
export const FDA_ASSOCIATIONS_SOURCE = Object.freeze({ title: 'FDA Table of Pharmacogenetic Associations', url: 'https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations' });
export const FDA_LABELING_SOURCE = Object.freeze({ title: 'FDA Table of Pharmacogenomic Biomarkers in Drug Labeling', url: 'https://www.fda.gov/drugs/science-and-research-drugs/table-pharmacogenomic-biomarkers-drug-labeling' });
export const MEDICINE_TOPICS = Object.freeze([
  {
    id: 'statins', name: 'Statins', category: 'Cholesterol', genes: ['SLCO1B1', 'ABCG2', 'CYP2C9'],
    medicines: ['simvastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],
    description: 'Some gene variants affect statin exposure and the risk of muscle symptoms.',
    context: 'Statins lower cholesterol. Established genetic results can help a clinician assess how certain statins are processed. The relevant genes and evidence differ between medicines.',
    unknown: 'A consumer-array marker does not establish your overall statin response. Your medical history, other medicines, symptoms, and the reason for treatment also matter.',
    question: 'If a statin decision or muscle symptoms are relevant to me, would a clinical pharmacogenetic result add useful information?',
    testing: 'Ask which genes and variants a clinical test covers. GeneMachine can check only one SLCO1B1 marker in a compatible DNA file, without calling a phenotype.',
    source: { title: 'CPIC statin guideline (2022)', url: 'https://files.cpicpgx.org/data/guideline/publication/statins/2022/publication.pdf' },
    fda: 'FDA lists reduced SLCO1B1 function as raising blood levels of simvastatin and rosuvastatin, and possibly atorvastatin. For simvastatin, FDA also lists a higher risk of muscle injury (myopathy).',
    checker: 'One marker available; no medication interpretation',
  },
  {
    id: 'clopidogrel', name: 'Clopidogrel', category: 'Heart and circulation', genes: ['CYP2C19'], medicines: ['clopidogrel', 'plavix'],
    description: 'CYP2C19 helps activate clopidogrel, a medicine that reduces blood clotting.',
    context: 'Variation in CYP2C19 can affect conversion of clopidogrel to its active form. The clinical relevance depends on why it is prescribed and the person’s cardiovascular history.',
    unknown: 'GeneMachine does not determine CYP2C19 function, predict clotting risk, or select an antiplatelet medicine.',
    question: 'Given my cardiovascular history, would a clinical CYP2C19 result affect your choice of antiplatelet treatment?',
    testing: 'A clinical CYP2C19 interpretation needs a validated allele and phenotype assessment. An isolated consumer marker is insufficient.',
    source: { title: 'CPIC clopidogrel guideline (2022)', url: 'https://files.cpicpgx.org/data/guideline/publication/clopidogrel/2022/35034351.pdf' },
    fda: 'FDA lists CYP2C19 intermediate and poor metabolizers as making less of clopidogrel’s active form, with a weaker antiplatelet effect and possibly higher cardiovascular risk. The clopidogrel label discusses CYP2C19 in a boxed warning.',
    checker: 'Not interpreted by the DNA checker',
  },
  {
    id: 'thiopurines', name: 'Thiopurines', category: 'Immune conditions and cancer', genes: ['TPMT', 'NUDT15'], medicines: ['azathioprine', 'mercaptopurine', 'thioguanine', 'imuran', 'purinethol'],
    description: 'TPMT and NUDT15 variation can affect the risk of serious thiopurine toxicity.',
    context: 'Azathioprine, mercaptopurine, and thioguanine are used in several conditions. Reduced function of TPMT or NUDT15 can change how thiopurines are handled and raise toxicity risk.',
    unknown: 'Genetics is one part of prescribing and monitoring. This library cannot assess your blood counts, clinical condition, or individual toxicity risk.',
    question: 'If a thiopurine is being considered, what TPMT and NUDT15 testing and ongoing monitoring do you use?',
    testing: 'Ask your care team which genetic or enzyme tests apply and what ongoing laboratory monitoring is required. This checker does not interpret either gene.',
    source: { title: 'CPIC thiopurine guideline, 2025 update (published 2026)', url: 'https://files.cpicpgx.org/data/guideline/publication/thiopurines/2026/41618934.pdf' },
    fda: 'FDA lists TPMT or NUDT15 intermediate and poor metabolizers as having a higher risk of bone marrow suppression (myelosuppression) and different dose needs for azathioprine, mercaptopurine, and thioguanine.',
    checker: 'Not interpreted by the DNA checker',
  },
  {
    id: 'fluoropyrimidines', name: 'Fluorouracil and capecitabine', category: 'Cancer treatment', genes: ['DPYD'], medicines: ['fluorouracil', '5-fu', 'capecitabine', 'xeloda'],
    description: 'Low activity of the DPD enzyme can raise the risk of severe toxicity.',
    context: 'DPYD encodes DPD, an enzyme involved in breaking down fluoropyrimidine cancer medicines. Reduced activity can increase the risk of severe toxicity.',
    unknown: 'A small set of genetic markers does not detect every cause of DPD deficiency. Testing practices and available assessments vary by care setting.',
    question: 'Before treatment, which DPYD or DPD assessment is appropriate in my care setting?',
    testing: 'Discuss the applicable genetic or enzyme assessment with your oncology team. GeneMachine does not interpret DPYD or guide cancer treatment.',
    source: { title: 'CPIC fluoropyrimidine and DPYD guideline', url: 'https://cpicpgx.org/guidelines/guideline-for-fluoropyrimidines-and-dpyd/' },
    update: { note: 'CPIC announced a pending DPYD guideline update in July 2026. Check the live guidance with your care team.', url: 'https://blog.clinpgx.org/cpic-comment-on-pending-dpyd-guideline-update/' },
    fda: 'FDA lists partial or complete DPD deficiency as raising the risk of severe, life-threatening, or fatal toxicity from fluorouracil and capecitabine. The capecitabine label discusses DPYD in a boxed warning.',
    checker: 'Not interpreted by the DNA checker',
  },
  {
    id: 'opioids', name: 'Codeine and tramadol', category: 'Pain', genes: ['CYP2D6'], medicines: ['codeine', 'tramadol', 'ultram'],
    description: 'CYP2D6 helps convert these pain medicines to active products.',
    context: 'Differences in CYP2D6 function can affect activation of codeine and tramadol. Other medicines can also change CYP2D6 activity.',
    unknown: 'CYP2D6 is genetically complex. Consumer-array rows cannot establish a complete result, and GeneMachine does not predict benefit or harm.',
    question: 'If pain treatment is needed, would a clinical CYP2D6 result be useful alongside my history and other medicines?',
    testing: 'A suitable CYP2D6 test may need to examine gene copies and structural variants. This checker does not call CYP2D6 status.',
    source: { title: 'CPIC opioid guideline (2021)', url: 'https://files.cpicpgx.org/data/guideline/publication/opioids/2020/33387367.pdf' },
    fda: 'FDA lists CYP2D6 ultrarapid metabolizers as at risk of life-threatening breathing problems from codeine and tramadol, and poor metabolizers as possibly getting less pain relief. Both labels discuss CYP2D6 in a boxed warning, and both medicines are contraindicated in children under 12.',
    checker: 'Requires specialized clinical testing',
  },
  {
    id: 'warfarin', name: 'Warfarin', category: 'Heart and circulation', genes: ['CYP2C9', 'VKORC1', 'CYP4F2'], medicines: ['warfarin', 'coumadin', 'jantoven'],
    description: 'Genetics can contribute to differences in warfarin requirements.',
    context: 'Warfarin reduces blood clotting. Genetic information can contribute to prescribing decisions together with clinical factors and INR blood-test monitoring.',
    unknown: 'A genetic result cannot replace INR monitoring. GeneMachine does not calculate a dose or assess bleeding or clotting risk.',
    question: 'If warfarin is planned, would prior clinical pharmacogenetic results inform the usual prescribing and monitoring process?',
    testing: 'Ask whether an existing clinical report is suitable for the prescribing method your care team uses. This checker does not interpret these genes.',
    source: { title: 'CPIC warfarin guideline (2017)', url: 'https://files.cpicpgx.org/data/guideline/publication/warfarin/2017/warfarin.pdf' },
    fda: 'FDA labeling says CYP2C9 and VKORC1 results can be weighed with clinical factors when a starting dose is chosen, and that later changes follow INR blood tests.',
    checker: 'Not interpreted by the DNA checker',
  },
  {
    id: 'tacrolimus', name: 'Tacrolimus', category: 'Transplant care', genes: ['CYP3A5'], medicines: ['tacrolimus', 'prograf', 'astagraf', 'envarsus'],
    description: 'CYP3A5 variation can affect tacrolimus blood concentrations.',
    context: 'Tacrolimus is used after transplantation. CYP3A5 differences can affect drug exposure, which the transplant team assesses alongside measured blood levels.',
    unknown: 'Genetics does not replace blood-level monitoring or your transplant team’s assessment. This tool cannot assess rejection or toxicity risk.',
    question: 'Does your transplant team use CYP3A5 testing, and how does it fit with blood-level monitoring?',
    testing: 'Discuss whether an existing clinical CYP3A5 result is useful. This checker does not interpret CYP3A5.',
    source: { title: 'CPIC tacrolimus guideline (2015)', url: 'https://files.cpicpgx.org/data/guideline/publication/tacrolimus/2015/25801146.pdf' },
    fda: 'FDA lists CYP3A5 normal and intermediate metabolizers as having lower tacrolimus blood levels, which may raise rejection risk. FDA ties tacrolimus dosing to measured blood levels.',
    checker: 'Not interpreted by the DNA checker',
  },
  {
    id: 'anesthesia', name: 'Inhaled anesthetics and succinylcholine', category: 'Surgery and anesthesia', genes: ['RYR1', 'CACNA1S'],
    medicines: ['sevoflurane', 'desflurane', 'isoflurane', 'succinylcholine', 'anectine', 'quelicin', 'general anesthesia', 'malignant hyperthermia', 'surgery'],
    description: 'Certain RYR1 and CACNA1S variants cause malignant hyperthermia susceptibility, a dangerous reaction to some anesthesia drugs.',
    context: 'Potent inhaled anesthetics, such as sevoflurane, desflurane, and isoflurane, and the muscle relaxant succinylcholine can trigger malignant hyperthermia in susceptible people. CPIC advises that anesthesia teams avoid these drugs and use non-triggering anesthesia in anyone known or thought to be susceptible.',
    unknown: 'Most susceptible people show no signs of it in daily life. A negative or partial genetic result does not rule out susceptibility, so a personal or family history of anesthesia reactions still matters.',
    question: 'Before anesthesia, should my personal or family history of anesthesia reactions, or any RYR1 or CACNA1S result, change how my anesthesia is planned?',
    testing: 'Ask whether clinical RYR1 and CACNA1S testing or a malignant hyperthermia specialist fits your history. GeneMachine does not interpret these genes.',
    source: { title: 'CPIC RYR1 and CACNA1S anesthesia guideline (2019)', url: 'https://cpicpgx.org/guidelines/cpic-guideline-for-ryr1-and-cacna1s/' },
    fda: 'FDA labeling for desflurane, isoflurane, sevoflurane, and succinylcholine lists known or suspected genetic susceptibility to malignant hyperthermia as a contraindication. The succinylcholine label also discusses it in a boxed warning.',
    checker: 'Not interpreted by the DNA checker',
  },
  {
    id: 'nsaids', name: 'NSAID pain relievers', category: 'Pain and inflammation', genes: ['CYP2C9'],
    medicines: ['celecoxib', 'celebrex', 'ibuprofen', 'advil', 'motrin', 'meloxicam', 'mobic', 'piroxicam', 'feldene', 'flurbiprofen', 'lornoxicam', 'tenoxicam', 'nsaid'],
    description: 'Reduced CYP2C9 function can raise blood levels of some NSAID pain relievers.',
    context: 'Celecoxib, flurbiprofen, ibuprofen, lornoxicam, meloxicam, piroxicam, and tenoxicam are cleared partly by CYP2C9. Reduced CYP2C9 function can raise drug exposure. NSAIDs can cause serious stomach, kidney, and heart side effects, and higher exposure may raise that risk.',
    unknown: 'CPIC makes no genetic recommendation for aspirin, diclofenac, indomethacin, nabumetone, or naproxen. Kidney function, stomach and heart history, other medicines, and how long you take an NSAID also matter.',
    question: 'If I take or may be prescribed an NSAID for pain or after surgery, would a clinical CYP2C9 result help choose the medicine?',
    testing: 'Ask whether a clinical CYP2C9 result is already in your record. GeneMachine does not interpret CYP2C9.',
    source: { title: 'CPIC CYP2C9 and NSAID guideline (2020)', url: 'https://files.cpicpgx.org/data/guideline/publication/NSAID/2020/32189324.pdf' },
    fda: 'FDA lists reduced CYP2C9 function as raising blood levels of celecoxib, flurbiprofen, meloxicam, and piroxicam, and possibly ibuprofen. Several of these labels describe dose changes for poor metabolizers; only a prescriber should apply them.',
    checker: 'Not interpreted by the DNA checker',
  },
].map(topic => Object.freeze({ ...topic, genes: Object.freeze(topic.genes), medicines: Object.freeze(topic.medicines), source: Object.freeze(topic.source), ...(topic.update ? { update: Object.freeze(topic.update) } : {}) })));

export const FDA_SOURCES = Object.freeze([FDA_ASSOCIATIONS_SOURCE, FDA_LABELING_SOURCE]);

export function getMedicineTopic(id) { return MEDICINE_TOPICS.find(topic => topic.id === id); }

export function searchMedicineTopics(query = '') {
  const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return MEDICINE_TOPICS.filter(topic => {
    const text = [topic.name, topic.category, ...topic.genes, ...topic.medicines].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function normalizeQuestionIds(ids) {
  if (!Array.isArray(ids)) throw new TypeError('Choose medicine topics from the library.');
  const unique = [...new Set(ids)];
  if (unique.length > MAX_QUESTIONS) throw new RangeError('Keep the checklist to five topics.');
  if (unique.some(id => !getMedicineTopic(id))) throw new TypeError('Unknown medicine topic.');
  return unique;
}

export function createQuestionChecklistHtml(ids, options = {}) {
  const topics = normalizeQuestionIds(ids).map(getMedicineTopic);
  if (!topics.length) throw new RangeError('Add at least one topic before downloading a checklist.');
  const date = options.generatedOn ?? new Date();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GeneMachine appointment questions</title><style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#edf3f2;color:#102035;line-height:1.6}main{max-width:800px;margin:32px auto;padding:40px;background:#fff;overflow-wrap:anywhere}h1{font-size:2rem;line-height:1.15}h2{font-size:1.2rem}.kicker{font-size:.75rem;color:#086d5b;letter-spacing:.1em;font-weight:700}.boundary{padding:18px;border-left:4px solid #086d5b;background:#eff8f5}article{border-top:1px solid #cfdad7;padding:20px 0;break-inside:avoid}a{color:#075e7a}.meta{color:#516575;font-size:.85rem}@media(max-width:600px){main{margin:0;padding:24px}}@media print{body{background:#fff}main{margin:0;padding:0}.boundary{break-inside:avoid}}
  </style></head><body><main><p class="kicker">GENEMACHINE / APPOINTMENT QUESTIONS</p><h1>Questions to take to your care team</h1><p class="meta">Prepared locally ${escapeHtml(date.toLocaleDateString('en-US'))}. Library sources checked ${LIBRARY_REVIEW_DATE}.</p>
  <p class="boundary">General learning topics you selected. This is not a personal medical assessment, a DNA result, a recommendation to test, or a treatment plan. Do not start, stop, substitute, or change a medicine or dose from this checklist.</p>
  ${topics.map(topic => `<article><h2>${escapeHtml(topic.name)}</h2><p><strong>Question:</strong> ${escapeHtml(topic.question)}</p><p><strong>What remains unknown:</strong> ${escapeHtml(topic.unknown)}</p><p><strong>Testing discussion:</strong> ${escapeHtml(topic.testing)}</p><p><strong>FDA labeling:</strong> ${escapeHtml(topic.fda)}</p><p><a href="${escapeHtml(topic.source.url)}" rel="noreferrer">${escapeHtml(topic.source.title)}</a> · ${FDA_SOURCES.map(source => `<a href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.title)}</a>`).join(' · ')}</p>${topic.update ? `<p>${escapeHtml(topic.update.note)} <a href="${escapeHtml(topic.update.url)}" rel="noreferrer">CPIC update notice</a></p>` : ''}</article>`).join('')}
  <p>Bring your current medicine list and any clinical test reports if your care team requests them. GeneMachine did not collect those records.</p><p class="meta">The downloaded file records your chosen topics. Store or share it deliberately. Open it in a browser to print or save as PDF.</p></main></body></html>`;
}
