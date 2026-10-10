import { MEDICINE_TOPICS, MAX_QUESTIONS, LIBRARY_REVIEW_DATE, FDA_SOURCES, FDA_LABELING_SOURCE, getMedicineTopic, searchMedicineTopics } from '../lib/medicine-library.mjs';
import { MAX_MEDICINE_LENGTH, MAX_QUESTION_LENGTH, MAX_NOTE_LENGTH, createTopicEntry, createCustomEntry, normalizeAppointmentEntries, createAppointmentHtml, createAppointmentText } from '../lib/appointment-kit.mjs';

const $ = selector => document.querySelector(selector);
const search = $('#medicine-search');
const grid = $('#medicine-grid');
const detail = $('#medicine-detail');
const questionStatus = $('#question-status');
const list = $('#question-list');
const newButton = $('#question-new');
const exportButton = $('#question-export');
const copyButton = $('#question-copy');
const clearButton = $('#question-clear');
const trayNote = $('#question-note');
const copyFallback = $('#copy-fallback');
const copyText = $('#copy-text');
const libraryWrite = $('#library-write-question');
const editorPanel = $('#question-editor');
const editorTitle = $('#editor-title');
const editorBadge = $('#editor-provenance');
const editorContext = $('#editor-context');
const medicineField = $('#entry-medicine-field');
const notesField = $('#entry-notes-field');
const notesToggle = $('#entry-notes-toggle');
const restoreButton = $('#entry-restore');
const entryError = $('#entry-error');
const fields = {
  medicine: { input: $('#entry-medicine'), count: $('#entry-medicine-count'), max: MAX_MEDICINE_LENGTH },
  question: { input: $('#entry-question'), count: $('#entry-question-count'), max: MAX_QUESTION_LENGTH },
  notes: { input: $('#entry-notes'), count: $('#entry-notes-count'), max: MAX_NOTE_LENGTH },
};

let entries = [];
let editor = null;
let nextUid = 1;
let openTopic = null;
let checklistUrl = null;
let copyRun = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function sourceLink(title, url) {
  const link = node('a', 'topic-source', title);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
}

const plain = ({ uid, ...entry }) => entry;
const entryName = entry => entry.kind === 'topic' ? getMedicineTopic(entry.topicId).name : entry.medicine;
const hasTopic = id => entries.some(entry => entry.kind === 'topic' && entry.topicId === id);
const reserved = () => entries.length + (editor?.mode === 'new' ? 1 : 0);
const plural = count => `${count} question${count === 1 ? '' : 's'}`;

function provenance(entry) {
  if (entry.kind === 'custom') return 'Your question · Medicine not assessed';
  return entry.question === getMedicineTopic(entry.topicId).question ? 'Suggested question' : 'Your question · Library topic';
}

function announce(message, tone = '') {
  questionStatus.textContent = message;
  if (tone) questionStatus.dataset.tone = tone;
  else delete questionStatus.dataset.tone;
}

function focusFirst(...candidates) {
  for (const candidate of candidates) {
    const element = typeof candidate === 'function' ? candidate() : candidate;
    if (element?.isConnected && !element.disabled && element.getClientRects().length) {
      element.focus();
      return;
    }
  }
}

function invalidateExports() {
  copyRun += 1;
  if (checklistUrl) { URL.revokeObjectURL(checklistUrl); checklistUrl = null; }
  copyText.value = '';
  copyFallback.hidden = true;
}

function renderLibrary() {
  const query = search.value.trim();
  const topics = searchMedicineTopics(search.value);
  $('#medicine-count').textContent = query ? `${topics.length} of ${MEDICINE_TOPICS.length}` : `${MEDICINE_TOPICS.length} topics`;
  $('#library-empty').hidden = topics.length > 0;
  $('#library-write-name').textContent = query.length > 48 ? `${query.slice(0, 47)}…` : query;
  const full = reserved() >= MAX_QUESTIONS;
  libraryWrite.disabled = full;
  $('#library-full').hidden = !full;
  grid.replaceChildren(...topics.map(topic => {
    const card = node('button', 'medicine-card');
    card.type = 'button';
    card.dataset.topic = topic.id;
    card.setAttribute('aria-expanded', String(openTopic === topic.id));
    card.setAttribute('aria-controls', 'medicine-detail');
    card.append(node('strong', 'medicine-name', topic.name), node('span', 'medicine-genes', topic.genes.join(' · ')));
    if (hasTopic(topic.id)) card.append(node('span', 'medicine-added', 'Added'));
    card.addEventListener('click', () => showTopic(topic.id));
    return card;
  }));
}

function syncTopicButton() {
  if (!openTopic) return;
  const add = detail.querySelector('.topic-add-button');
  const added = hasTopic(openTopic);
  add.textContent = added ? 'Added to your questions' : 'Add this question';
  add.disabled = added;
  detail.querySelector('.topic-add-hint').hidden = added || reserved() < MAX_QUESTIONS;
}

function showTopic(id) {
  const topic = getMedicineTopic(id);
  openTopic = id;
  $('#medicine-detail-title').textContent = topic.name;
  const body = $('#medicine-detail-body');
  const genes = node('p', 'topic-genes', topic.genes.join(' · '));
  const sections = node('dl', 'topic-sections');
  for (const [title, text] of [
    ['Why genetics comes up', topic.context],
    ['What this cannot tell you', topic.unknown],
    ['What a clinical test could add', topic.testing],
    ['What FDA labeling says', topic.fda],
  ]) sections.append(node('dt', '', title), node('dd', '', text));
  const evidence = node('details', 'more topic-evidence');
  const fdaLinks = node('p', 'topic-fda-sources');
  fdaLinks.append('FDA sources: ');
  FDA_SOURCES.forEach((source, index) => fdaLinks.append(...(index ? ['; '] : []), sourceLink(source.title, source.url)));
  evidence.append(node('summary', '', 'Evidence and limits'), sections, fdaLinks);
  const boundary = node('p', 'topic-boundary', `Learning only. ${topic.checker}. Do not change treatment from this topic.`);
  const sources = node('div', 'topic-sources');
  sources.append(node('span', 'topic-sources-label', 'Sources'), sourceLink(topic.source.title, topic.source.url), sourceLink('FDA labeling', FDA_LABELING_SOURCE.url), node('span', 'topic-reviewed', `checked ${LIBRARY_REVIEW_DATE}`));
  if (topic.update) sources.append(node('p', 'topic-update', topic.update.note), sourceLink('Read the CPIC update notice', topic.update.url));
  const question = node('div', 'topic-question');
  const add = node('button', 'primary-button topic-add-button', 'Add this question');
  add.type = 'button';
  add.addEventListener('click', () => addTopic(id));
  const hint = node('p', 'topic-add-hint', 'Your list is full. Remove a question to add this one.');
  question.append(node('span', 'topic-question-label', 'Ask your care team'), node('p', '', topic.question), add, hint);
  body.replaceChildren(genes, question, sources, boundary, evidence);
  syncTopicButton();
  detail.hidden = false;
  renderLibrary();
  $('#medicine-detail-title').focus({ preventScroll: true });
  detail.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function closeTopic(restoreFocus = false) {
  const previous = openTopic;
  openTopic = null;
  detail.hidden = true;
  $('#medicine-detail-body').replaceChildren();
  renderLibrary();
  if (restoreFocus) grid.querySelector(`[data-topic="${previous}"]`)?.focus();
}

function itemButton(className, visible, hidden, disabled, onClick, hiddenFirst = false) {
  const button = node('button', `item-button ${className}`);
  button.type = 'button';
  button.disabled = disabled;
  const label = node('span', 'visually-hidden', hidden);
  if (hiddenFirst) button.append(label, visible);
  else button.append(visible, label);
  button.addEventListener('click', onClick);
  return button;
}

function renderQuestions() {
  const editing = Boolean(editor);
  $('#question-count').textContent = `${entries.length} of ${MAX_QUESTIONS} questions`;
  list.replaceChildren(...entries.map((entry, index) => {
    const name = entryName(entry);
    const item = node('li', 'question-item');
    item.dataset.kind = entry.kind;
    item.dataset.uid = String(entry.uid);
    if (editor?.uid === entry.uid) item.classList.add('is-editing');
    const head = node('div', 'question-head');
    const number = node('span', 'question-index', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    head.append(number, node('strong', 'question-name', name), node('span', `provenance${entry.kind === 'custom' ? ' is-custom' : ''}`, provenance(entry)));
    const body = node('div', 'question-body');
    body.append(head, node('p', 'question-text', entry.question));
    if (entry.notes) {
      const notes = node('details', 'question-notes');
      notes.append(node('summary', '', 'Your notes'), node('p', '', entry.notes));
      body.append(notes);
    }
    const controls = node('div', 'question-controls');
    controls.append(
      itemButton('question-up', 'Up', `Move ${name} `, editing || index === 0, () => moveUp(entry.uid), true),
      itemButton('question-edit', 'Edit', ` ${name}`, editing, () => openEditor({ mode: 'edit', uid: entry.uid })),
      itemButton('question-remove', 'Remove', ` ${name}`, editing, () => removeEntry(entry.uid)),
    );
    item.append(body, controls);
    return item;
  }));
  if (!entries.length) list.append(node('li', 'empty-state', 'Add a suggested question or write your own.'));
  newButton.disabled = editing || entries.length >= MAX_QUESTIONS;
  newButton.setAttribute('aria-expanded', String(editor?.mode === 'new'));
  exportButton.disabled = editing || !entries.length;
  copyButton.disabled = editing || !entries.length;
  clearButton.disabled = !entries.length && !editing && copyFallback.hidden;
  trayNote.hidden = !entries.length && !editing;
  trayNote.textContent = editing
    ? 'Save or cancel to copy or download. Drafts stay in this tab only.'
    : 'Stays in this tab only; closing it clears your list. Copy or download to keep it.';
}

function refresh() {
  renderQuestions();
  renderLibrary();
  syncTopicButton();
}

function commit(next) {
  try {
    const normalized = normalizeAppointmentEntries(next.map(plain));
    entries = normalized.map((entry, index) => ({ ...entry, uid: next[index].uid }));
  } catch (error) {
    announce(`That change was not made: ${error.message}`, 'error');
    return false;
  }
  invalidateExports();
  refresh();
  return true;
}

function addTopic(id) {
  if (hasTopic(id)) return;
  if (reserved() >= MAX_QUESTIONS) {
    announce(editor?.mode === 'new'
      ? 'Your list has five questions, counting the one you are writing. Save or cancel it first.'
      : 'Your list has five questions. Remove one first.', 'error');
    return;
  }
  if (commit([...entries, { ...createTopicEntry(id), uid: nextUid++ }])) {
    announce(`${getMedicineTopic(id).name} added. ${entries.length} of ${MAX_QUESTIONS} questions.`);
  }
}

function moveUp(uid) {
  const index = entries.findIndex(entry => entry.uid === uid);
  if (editor || index <= 0) return;
  const next = [...entries];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  if (!commit(next)) return;
  announce(`${entryName(entries[index - 1])} moved to position ${index} of ${entries.length}.`);
  const item = () => list.querySelector(`[data-uid="${uid}"]`);
  focusFirst(() => item()?.querySelector('.question-up'), () => item()?.querySelector('.question-edit'));
}

function removeEntry(uid) {
  const index = entries.findIndex(entry => entry.uid === uid);
  if (editor || index < 0) return;
  const name = entryName(entries[index]);
  if (!commit(entries.filter(entry => entry.uid !== uid))) return;
  announce(`${name} removed. ${entries.length} of ${MAX_QUESTIONS} questions.`);
  const items = list.querySelectorAll('.question-item');
  focusFirst(() => (items[index] ?? items[index - 1])?.querySelector('.question-remove'), newButton, search);
}

function updateCounts() {
  for (const { input, count, max } of Object.values(fields)) {
    const length = input.value.trim().length;
    count.textContent = length > max ? `${length}/${max} · ${length - max} over` : `${length}/${max}`;
    count.classList.toggle('is-over', length > max);
  }
  if (editor?.kind === 'topic') restoreButton.hidden = fields.question.input.value.trim() === getMedicineTopic(editor.topicId).question;
}

function setNotesVisible(visible) {
  notesField.hidden = !visible;
  notesToggle.hidden = visible;
  notesToggle.setAttribute('aria-expanded', String(visible));
}

function clearErrors() {
  entryError.hidden = true;
  entryError.textContent = '';
  for (const { input } of Object.values(fields)) input.removeAttribute('aria-invalid');
}

function showErrors(problems) {
  clearErrors();
  for (const [field] of problems) if (field) fields[field].input.setAttribute('aria-invalid', 'true');
  entryError.textContent = problems.map(([, message]) => message).join(' ');
  entryError.hidden = false;
  const first = problems.find(([field]) => field)?.[0];
  if (first === 'notes') setNotesVisible(true);
  focusFirst(first && fields[first].input, $('#entry-save'));
}

function resetEditor() {
  editor = null;
  editorPanel.hidden = true;
  for (const { input } of Object.values(fields)) input.value = '';
  clearErrors();
  setNotesVisible(false);
  restoreButton.hidden = true;
}

function openEditor({ mode, uid = null, medicine = '', opener }) {
  if (editor) {
    announce('Finish or cancel the question you are writing first.');
    focusFirst(editor.kind === 'topic' ? null : fields.medicine.input, fields.question.input);
    return;
  }
  if (mode === 'new' && entries.length >= MAX_QUESTIONS) {
    announce('Your list has five questions. Remove one first.', 'error');
    return;
  }
  const entry = mode === 'edit' ? entries.find(item => item.uid === uid) : createCustomEntry(medicine);
  if (!entry) return;
  const topic = entry.kind === 'topic' ? getMedicineTopic(entry.topicId) : null;
  editor = {
    mode,
    uid,
    kind: entry.kind,
    topicId: topic?.id ?? null,
    opener: opener ?? (() => list.querySelector(`[data-uid="${uid}"] .question-edit`)),
  };
  editorTitle.textContent = mode === 'new' ? 'Write a question' : topic ? `Edit question: ${topic.name}` : 'Edit your question';
  editorBadge.textContent = topic ? 'Library topic' : 'Medicine not assessed';
  editorBadge.classList.toggle('is-custom', !topic);
  editorContext.textContent = topic
    ? 'Your wording replaces the suggested question. The library sources stay attached.'
    : 'GeneMachine has not assessed this medicine and adds no gene, source, or interpretation. Not being in the library does not mean genetics is irrelevant.';
  medicineField.hidden = Boolean(topic);
  fields.medicine.input.value = topic ? '' : entry.medicine;
  fields.question.input.value = entry.question;
  fields.notes.input.value = entry.notes;
  clearErrors();
  setNotesVisible(Boolean(entry.notes));
  restoreButton.hidden = true;
  updateCounts();
  editorPanel.hidden = false;
  refresh();
  const focusQuestion = topic || entry.medicine.trim();
  const target = focusQuestion ? fields.question.input : fields.medicine.input;
  target.focus();
  if (focusQuestion) target.setSelectionRange(target.value.length, target.value.length);
}

function cancelEditor() {
  if (!editor) return;
  const { mode, opener } = editor;
  resetEditor();
  refresh();
  announce(mode === 'new' ? 'Draft discarded. Nothing was added.' : 'Edit cancelled. The saved question is unchanged.');
  focusFirst(opener, newButton, search);
}

function validateDraft() {
  const problems = [];
  const value = name => fields[name].input.value.trim();
  if (editor.kind === 'custom') {
    if (!value('medicine')) problems.push(['medicine', 'Enter the medicine or topic name.']);
    else if (value('medicine').length > MAX_MEDICINE_LENGTH) problems.push(['medicine', `Shorten the medicine name to ${MAX_MEDICINE_LENGTH} characters.`]);
  }
  if (!value('question')) problems.push(['question', 'Enter a question.']);
  else if (value('question').length > MAX_QUESTION_LENGTH) problems.push(['question', `Shorten the question to ${MAX_QUESTION_LENGTH} characters.`]);
  if (value('notes').length > MAX_NOTE_LENGTH) problems.push(['notes', `Shorten the notes to ${MAX_NOTE_LENGTH} characters.`]);
  if (editor.mode === 'new' && entries.length >= MAX_QUESTIONS) problems.push([null, 'Your list already has five questions. Cancel, then remove one.']);
  if (editor.mode === 'edit' && !entries.some(entry => entry.uid === editor.uid)) problems.push([null, 'This question is no longer in your list. Cancel to close the editor.']);
  return problems;
}

function saveEditor() {
  if (!editor) return;
  const problems = validateDraft();
  if (problems.length) { showErrors(problems); return; }
  const { mode, kind, topicId } = editor;
  const question = fields.question.input.value;
  const notes = fields.notes.input.value;
  const draft = kind === 'topic'
    ? { kind, topicId, question, notes }
    : { kind, medicine: fields.medicine.input.value, question, notes };
  const uid = mode === 'edit' ? editor.uid : nextUid++;
  const next = mode === 'edit' ? entries.map(entry => entry.uid === uid ? { ...draft, uid } : entry) : [...entries, { ...draft, uid }];
  let normalized;
  try {
    normalized = normalizeAppointmentEntries(next.map(plain));
  } catch (error) {
    showErrors([[null, `${error.message} Nothing was saved.`]]);
    return;
  }
  entries = normalized.map((entry, index) => ({ ...entry, uid: next[index].uid }));
  resetEditor();
  invalidateExports();
  refresh();
  const saved = entries.find(entry => entry.uid === uid);
  announce(`${entryName(saved)} ${mode === 'new' ? 'saved' : 'updated'}. ${entries.length} of ${MAX_QUESTIONS} questions.`);
  focusFirst(() => list.querySelector(`[data-uid="${uid}"] .question-edit`), newButton);
}

function resetPrivateState() {
  resetEditor();
  entries = [];
  invalidateExports();
  announce('');
  refresh();
}

newButton.addEventListener('click', () => openEditor({ mode: 'new', opener: () => newButton }));
libraryWrite.addEventListener('click', () => openEditor({ mode: 'new', medicine: search.value.trim(), opener: () => libraryWrite }));
$('#entry-save').addEventListener('click', saveEditor);
$('#entry-cancel').addEventListener('click', cancelEditor);
editorPanel.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  cancelEditor();
});
for (const { input } of Object.values(fields)) {
  input.addEventListener('input', () => {
    updateCounts();
    if (input.getAttribute('aria-invalid') !== 'true') return;
    input.removeAttribute('aria-invalid');
    if (!Object.values(fields).some(field => field.input.getAttribute('aria-invalid') === 'true')) clearErrors();
  });
}
notesToggle.addEventListener('click', () => {
  setNotesVisible(true);
  fields.notes.input.focus();
});
restoreButton.addEventListener('click', () => {
  if (editor?.kind !== 'topic') return;
  fields.question.input.value = getMedicineTopic(editor.topicId).question;
  updateCounts();
  fields.question.input.focus();
});

search.addEventListener('input', () => { closeTopic(); });
$('#medicine-close').addEventListener('click', () => closeTopic(true));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && openTopic) closeTopic(true); });

clearButton.addEventListener('click', () => {
  const hadDraft = Boolean(editor);
  resetPrivateState();
  announce(`${hadDraft ? 'List and draft cleared' : 'List cleared'}. Files you downloaded and text you pasted elsewhere are not affected.`);
  focusFirst(newButton, search);
});

exportButton.addEventListener('click', () => {
  if (editor || !entries.length) return;
  let html;
  try {
    html = createAppointmentHtml(entries.map(plain));
  } catch (error) {
    announce(`The download was not created: ${error.message} Edit or remove that question, then try again.`, 'error');
    return;
  }
  try {
    if (checklistUrl) URL.revokeObjectURL(checklistUrl);
    checklistUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const download = node('a');
    download.href = checklistUrl;
    download.download = 'genemachine-appointment-questions.html';
    download.click();
    announce('Saved to this device. Open it to print or save as PDF.');
  } catch {
    announce('The download could not start. Try again, or use Copy questions.', 'error');
  }
});

copyButton.addEventListener('click', async () => {
  if (editor || !entries.length) return;
  let text;
  try {
    text = createAppointmentText(entries.map(plain));
  } catch (error) {
    announce(`The text was not prepared: ${error.message} Edit or remove that question, then try again.`, 'error');
    return;
  }
  copyRun += 1;
  const run = copyRun;
  copyFallback.hidden = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (run !== copyRun) return;
    announce(`Copied ${plural(entries.length)}. Pasted copies stay wherever you put them.`);
  } catch {
    if (run !== copyRun) return;
    copyText.value = text;
    copyFallback.hidden = false;
    renderQuestions();
    copyText.focus();
    copyText.select();
    announce('The browser blocked copying. The text below is selected; copy it with your keyboard or menu.', 'error');
  }
});

$('#copy-close').addEventListener('click', () => {
  copyRun += 1;
  copyText.value = '';
  copyFallback.hidden = true;
  renderQuestions();
  announce('');
  focusFirst(copyButton, newButton, search);
});
copyFallback.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  $('#copy-close').click();
});

window.addEventListener('pagehide', () => {
  resetPrivateState();
  search.value = '';
  closeTopic();
});

renderLibrary();
renderQuestions();
