import { MEDICINE_TOPICS, MAX_QUESTIONS, LIBRARY_REVIEW_DATE, getMedicineTopic, searchMedicineTopics, createQuestionChecklistHtml } from '../lib/medicine-library.mjs';

const search = document.querySelector('#medicine-search');
const grid = document.querySelector('#medicine-grid');
const detail = document.querySelector('#medicine-detail');
const questionStatus = document.querySelector('#question-status');
const selected = new Set();
let openTopic = null;
let checklistUrl = null;

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

function renderLibrary() {
  const topics = searchMedicineTopics(search.value);
  document.querySelector('#medicine-count').textContent = `${topics.length} of ${MEDICINE_TOPICS.length} learning topics`;
  document.querySelector('#library-empty').hidden = topics.length > 0;
  grid.replaceChildren(...topics.map(topic => {
    const card = node('button', 'medicine-card');
    card.type = 'button';
    card.dataset.topic = topic.id;
    card.setAttribute('aria-expanded', String(openTopic === topic.id));
    card.setAttribute('aria-controls', 'medicine-detail');
    card.append(node('span', 'medicine-category', topic.category), node('strong', 'medicine-name', topic.name), node('span', 'medicine-genes', topic.genes.join(' · ')), node('span', 'medicine-description', topic.description), node('span', 'medicine-card-footer', selected.has(topic.id) ? 'In your question list' : 'Read evidence and questions'));
    card.addEventListener('click', () => showTopic(topic.id));
    return card;
  }));
}

function showTopic(id) {
  const topic = getMedicineTopic(id);
  openTopic = id;
  document.querySelector('#medicine-detail-title').textContent = topic.name;
  const body = document.querySelector('#medicine-detail-body');
  const sections = [
    ['Why genetics comes up', topic.context],
    ['What this cannot tell you', topic.unknown],
    ['A question for your care team', topic.question],
    ['What a clinical test could add', topic.testing],
  ].map(([title, text]) => {
    const section = node('section', 'topic-section');
    section.append(node('h4', '', title), node('p', '', text));
    return section;
  });
  const boundary = node('p', 'topic-boundary', `Learning only. DNA checker: ${topic.checker}. Do not change treatment from this topic.`);
  const sources = node('div', 'topic-sources');
  sources.append(sourceLink(topic.source.title, topic.source.url), node('p', 'topic-reviewed', `Source checked ${LIBRARY_REVIEW_DATE}`));
  if (topic.update) sources.append(node('p', '', topic.update.note), sourceLink('Read the CPIC update notice', topic.update.url));
  const add = node('button', 'primary-button topic-add-button', selected.has(id) ? 'Added to your questions' : 'Add this question');
  add.type = 'button';
  add.disabled = selected.has(id);
  add.addEventListener('click', () => {
    if (selected.size >= MAX_QUESTIONS) {
      questionStatus.textContent = 'Your list has five topics. Remove one before adding another.';
      return;
    }
    selected.add(id);
    questionStatus.textContent = `${topic.name} added to your questions.`;
    renderQuestions();
    renderLibrary();
    add.textContent = 'Added to your questions';
    add.disabled = true;
  });
  body.replaceChildren(boundary, ...sections, sources, add);
  detail.hidden = false;
  renderLibrary();
  document.querySelector('#medicine-detail-title').focus({ preventScroll: true });
  detail.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function closeTopic(restoreFocus = false) {
  const previous = openTopic;
  openTopic = null;
  detail.hidden = true;
  document.querySelector('#medicine-detail-body').replaceChildren();
  renderLibrary();
  if (restoreFocus) grid.querySelector(`[data-topic="${previous}"]`)?.focus();
}

function renderQuestions() {
  document.querySelector('#question-count').textContent = `${selected.size} of ${MAX_QUESTIONS} topics`;
  const list = document.querySelector('#question-list');
  list.replaceChildren(...[...selected].map(id => {
    const topic = getMedicineTopic(id);
    const item = node('li', 'question-item');
    const text = node('div');
    text.append(node('strong', '', topic.name), node('p', '', topic.question));
    const remove = node('button', 'quiet-button question-remove', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${topic.name} from questions`);
    remove.addEventListener('click', () => {
      selected.delete(id);
      questionStatus.textContent = `${topic.name} removed.`;
      renderQuestions();
      renderLibrary();
      if (openTopic === id) {
        const add = detail.querySelector('.topic-add-button');
        add.disabled = false;
        add.textContent = 'Add this question';
      }
      document.querySelector('#question-clear').disabled ? search.focus() : document.querySelector('#question-clear').focus();
    });
    item.append(text, remove);
    return item;
  }));
  if (!selected.size) list.append(node('li', 'empty-state', 'Open a topic and add a question. No DNA file is needed.'));
  document.querySelector('#question-export').disabled = selected.size === 0;
  document.querySelector('#question-clear').disabled = selected.size === 0;
  if (checklistUrl) { URL.revokeObjectURL(checklistUrl); checklistUrl = null; }
}

search.addEventListener('input', () => { closeTopic(); });
document.querySelector('#medicine-close').addEventListener('click', () => closeTopic(true));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && openTopic) closeTopic(true); });
document.querySelector('#question-clear').addEventListener('click', () => {
  selected.clear();
  questionStatus.textContent = 'Your question list is cleared. Downloaded copies remain on your device.';
  renderQuestions();
  renderLibrary();
  if (openTopic) {
    detail.querySelector('.topic-add-button').disabled = false;
    detail.querySelector('.topic-add-button').textContent = 'Add this question';
  }
});
document.querySelector('#question-export').addEventListener('click', () => {
  if (!selected.size) return;
  if (checklistUrl) URL.revokeObjectURL(checklistUrl);
  checklistUrl = URL.createObjectURL(new Blob([createQuestionChecklistHtml([...selected])], { type: 'text/html;charset=utf-8' }));
  const download = node('a');
  download.href = checklistUrl;
  download.download = 'genemachine-appointment-questions.html';
  download.click();
  questionStatus.textContent = 'Checklist downloaded. It contains the topics you chose; store and share it deliberately. Open it to print or save as PDF.';
});

window.addEventListener('pagehide', () => {
  selected.clear();
  search.value = '';
  closeTopic();
  renderQuestions();
});

renderLibrary();
renderQuestions();
