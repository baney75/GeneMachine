import { escapeHtml } from './discussion-report.mjs';
import { getMedicineTopic, LIBRARY_REVIEW_DATE, MAX_QUESTIONS } from './medicine-library.mjs';

export const MAX_MEDICINE_LENGTH = 120;
export const MAX_QUESTION_LENGTH = 600;
export const MAX_NOTE_LENGTH = 1200;

const DEFAULT_CUSTOM_QUESTION = 'Could a pharmacogenetic test be relevant to this medicine and my situation? What other factors matter?';

export function createTopicEntry(topicId) {
  const topic = getMedicineTopic(topicId);
  if (!topic) throw new TypeError('Unknown medicine topic.');
  return { kind: 'topic', topicId: topic.id, question: topic.question, notes: '' };
}

export function createCustomEntry(medicine = '', question = DEFAULT_CUSTOM_QUESTION) {
  return { kind: 'custom', medicine, question, notes: '' };
}

function cleanText(value, field, limit) {
  if (typeof value !== 'string') throw new TypeError(`${field} must be text.`);
  const cleaned = value.trim();
  if (cleaned.length > limit) throw new RangeError(`${field} is too long.`);
  return cleaned;
}

export function normalizeAppointmentEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError('Appointment entries must be a list.');
  if (entries.length > MAX_QUESTIONS) throw new RangeError(`Keep the worksheet to ${MAX_QUESTIONS} questions.`);

  const seenTopics = new Set();
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('Invalid appointment entry.');
    }
    const question = cleanText(entry.question, 'Question', MAX_QUESTION_LENGTH);
    const notes = cleanText(entry.notes, 'Notes', MAX_NOTE_LENGTH);
    if (!question) throw new TypeError('Question cannot be empty.');

    if (entry.kind === 'topic') {
      if (typeof entry.topicId !== 'string') throw new TypeError('Topic ID must be text.');
      const topic = getMedicineTopic(entry.topicId);
      if (!topic) throw new TypeError('Unknown medicine topic.');
      if (seenTopics.has(topic.id)) throw new TypeError('Duplicate medicine topic.');
      seenTopics.add(topic.id);
      return { kind: 'topic', topicId: topic.id, question, notes };
    }
    if (entry.kind === 'custom') {
      const medicine = cleanText(entry.medicine, 'Medicine', MAX_MEDICINE_LENGTH);
      if (!medicine) throw new TypeError('Medicine cannot be empty.');
      return { kind: 'custom', medicine, question, notes };
    }
    throw new TypeError('Unknown appointment entry kind.');
  });
}

function preparedEntries(entries) {
  const normalized = normalizeAppointmentEntries(entries);
  if (!normalized.length) throw new RangeError('Add at least one question before exporting.');
  return normalized;
}

function preparedDate(options) {
  const date = options.generatedOn ?? new Date();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('generatedOn must be a valid date.');
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function questionLabel(entry, topic) {
  return !topic || entry.question !== topic.question ? 'Your question' : 'Suggested question';
}

function htmlQuestion(entry, index) {
  const topic = entry.kind === 'topic' ? getMedicineTopic(entry.topicId) : null;
  const name = topic?.name ?? entry.medicine;
  const provenance = topic ? 'Library topic' : 'Your question · Medicine not assessed';
  return `<article class="question"><div class="question-head"><span class="number">${index + 1}</span><div><h2>${escapeHtml(name)}</h2><p class="eyebrow">${provenance}</p></div></div><p class="field-label">${questionLabel(entry, topic)}</p><p class="user-text">${escapeHtml(entry.question)}</p><p class="field-label">Your notes · user-written, not clinically assessed</p><p class="user-text notes">${entry.notes ? escapeHtml(entry.notes) : '&nbsp;'}</p></article>`;
}

function htmlEvidence(entry) {
  const topic = getMedicineTopic(entry.topicId);
  return `<article class="evidence"><h3>${escapeHtml(topic.name)}</h3><p><strong>What remains unknown:</strong> ${escapeHtml(topic.unknown)}</p><p><strong>Testing discussion:</strong> ${escapeHtml(topic.testing)}</p><p><strong>Primary source:</strong> <a href="${escapeHtml(topic.source.url)}" rel="noreferrer">${escapeHtml(topic.source.title)}</a> <span class="url">${escapeHtml(topic.source.url)}</span></p>${topic.update ? `<p><strong>Update notice:</strong> ${escapeHtml(topic.update.note)} <a href="${escapeHtml(topic.update.url)}" rel="noreferrer">${escapeHtml(topic.update.url)}</a></p>` : ''}</article>`;
}

export function createAppointmentHtml(entries, options = {}) {
  const items = preparedEntries(entries);
  const date = preparedDate(options);
  const curated = items.filter((entry) => entry.kind === 'topic');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GeneMachine appointment worksheet</title><style>
  :root{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#152b32;background:#eaf2ef}*{box-sizing:border-box}body{margin:0}main{width:min(840px,calc(100% - 32px));margin:28px auto;padding:clamp(24px,5vw,52px);background:#fff;box-shadow:0 12px 40px #19392c18;overflow-wrap:anywhere}h1{font-size:clamp(2rem,5vw,2.8rem);line-height:1.08;margin:.2em 0 .45em}h2{font-size:1.16rem;margin:0}h3{font-size:1rem;margin:0 0 .5em}p{line-height:1.48;margin:.45em 0}.kicker,.eyebrow,.field-label{font-size:.72rem;letter-spacing:.07em;font-weight:750;text-transform:uppercase;color:#27685c}.meta{color:#51656a;font-size:.86rem}.boundary{border-left:4px solid #247461;background:#f0f7f4;padding:14px 18px;margin:24px 0}.question{padding:19px 0;border-top:1px solid #d5e0dc;break-inside:avoid}.question-head{display:flex;align-items:start;gap:14px}.number{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;background:#155a4d;color:white;font-size:.82rem;font-weight:700}.eyebrow{margin:.2em 0}.field-label{margin:1.1em 0 .2em}.user-text{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;margin:0}.notes{min-height:3.5em;border-bottom:1px solid #c7d5d0}.evidence{border-top:1px solid #d5e0dc;padding:14px 0;break-inside:avoid;font-size:.88rem}.url{display:block;font-size:.75rem;overflow-wrap:anywhere}.evidence a{color:#115a70;overflow-wrap:anywhere}.small{font-size:.84rem;color:#51656a}@media print{html,body{background:white}main{width:auto;margin:0;padding:0;box-shadow:none}.boundary,.question,.evidence{break-inside:avoid}a{color:#152b32}}
  </style></head><body><main><p class="kicker">GENEMACHINE / APPOINTMENT WORKSHEET</p><h1>Questions for your care team</h1><p class="meta">Prepared locally ${escapeHtml(date)}.${curated.length ? ` Library sources checked ${LIBRARY_REVIEW_DATE}.` : ''}</p><p class="boundary">General learning and your own questions. This is not a personal medical assessment, a DNA result, a recommendation to test, or a treatment plan. Do not start, stop, substitute, or change a medicine or dose from this worksheet.</p><section aria-label="Appointment questions">${items.map(htmlQuestion).join('')}</section>${curated.length ? `<section aria-label="Library evidence"><h2>Library context and sources</h2><p class="small">The library material below applies only to the named library topics. Edited questions and personal notes are your words, not reviewed evidence. Sources checked ${LIBRARY_REVIEW_DATE}; ask your care team to check current guidance.</p>${curated.map(htmlEvidence).join('')}</section>` : `<p class="small">Custom medicines were not assessed by the GeneMachine library. No gene, test, or source is inferred for them.</p>`}<p class="small">Bring your current medicine list and any clinical test reports if your care team requests them. Store or share this local file deliberately. Open it in a browser to print or save as PDF.</p></main></body></html>`;
}

export function createAppointmentText(entries, options = {}) {
  const items = preparedEntries(entries);
  const date = preparedDate(options);
  const curated = items.filter((entry) => entry.kind === 'topic');
  const questions = items.map((entry, index) => {
    const topic = entry.kind === 'topic' ? getMedicineTopic(entry.topicId) : null;
    return `${index + 1}. ${topic?.name ?? entry.medicine} — ${topic ? 'Library topic' : 'Your question · Medicine not assessed'}\n${questionLabel(entry, topic)}: ${entry.question}\nYour notes (user-written, not clinically assessed): ${entry.notes}`;
  }).join('\n\n');
  const evidence = curated.map((entry) => {
    const topic = getMedicineTopic(entry.topicId);
    return `${topic.name}\nWhat remains unknown: ${topic.unknown}\nTesting discussion: ${topic.testing}\nPrimary source: ${topic.source.title} — ${topic.source.url}${topic.update ? `\nUpdate notice: ${topic.update.note} ${topic.update.url}` : ''}`;
  }).join('\n\n');
  return `GENEMACHINE / APPOINTMENT WORKSHEET\nQuestions for your care team\nPrepared locally ${date}.${curated.length ? ` Library sources checked ${LIBRARY_REVIEW_DATE}.` : ''}\n\nGeneral learning and your own questions. This is not a personal medical assessment, a DNA result, a recommendation to test, or a treatment plan. Do not start, stop, substitute, or change a medicine or dose from this worksheet.\n\n${questions}\n\n${curated.length ? `LIBRARY CONTEXT AND SOURCES\nThe library material below applies only to the named library topics. Edited questions and personal notes are your words, not reviewed evidence. Sources checked ${LIBRARY_REVIEW_DATE}; ask your care team to check current guidance.\n\n${evidence}` : 'Custom medicines were not assessed by the GeneMachine library. No gene, test, or source is inferred for them.'}\n\nBring your current medicine list and any clinical test reports if your care team requests them. Store or share this local file deliberately.`;
}
