import assert from 'node:assert/strict';
import test from 'node:test';
import { MEDICINE_TOPICS, FDA_SOURCES, searchMedicineTopics, createQuestionChecklistHtml } from '../lib/medicine-library.mjs';

test('medicine, brand and gene searches work without genetic or personal data', () => {
  assert.equal(searchMedicineTopics().length, 9);
  assert.deepEqual(searchMedicineTopics(' Plavix ').map(topic => topic.id), ['clopidogrel']);
  assert.deepEqual(searchMedicineTopics('CYP2D6 pain').map(topic => topic.id), ['opioids']);
  assert.deepEqual(searchMedicineTopics('sevoflurane').map(topic => topic.id), ['anesthesia']);
  assert.deepEqual(searchMedicineTopics('malignant hyperthermia').map(topic => topic.id), ['anesthesia']);
  assert.deepEqual(searchMedicineTopics('Celebrex').map(topic => topic.id), ['nsaids']);
  assert.deepEqual(searchMedicineTopics('CYP2C9').map(topic => topic.id), ['statins', 'warfarin', 'nsaids']);
  assert.deepEqual(searchMedicineTopics('made-up-medicine'), []);
  assert.deepEqual(searchMedicineTopics('<script>alert(1)</script>'), []);
});

test('every topic has a primary guideline and explicit unavailability or single-marker scope', () => {
  for (const topic of MEDICINE_TOPICS) {
    assert.match(topic.source.url, /^https:\/\/(files\.)?cpicpgx\.org\//);
    assert.ok(topic.unknown && topic.question && topic.testing && topic.checker);
    assert.ok(Object.isFrozen(topic));
  }
});

test('every topic carries an FDA labeling summary without dose numbers or instructions to the user', () => {
  assert.deepEqual(FDA_SOURCES.map(source => new URL(source.url).hostname), ['www.fda.gov', 'www.fda.gov']);
  for (const topic of MEDICINE_TOPICS) {
    assert.match(topic.fda, /^FDA /, topic.id);
    assert.doesNotMatch(topic.fda, /\d+\s*(mg|%)|\b(you should|stop taking|start taking)\b/i, topic.id);
  }
});

test('the library covers only CPIC Level A pairs named in the source register', () => {
  const genes = Object.fromEntries(MEDICINE_TOPICS.map(topic => [topic.id, topic.genes.join(',')]));
  assert.equal(genes.anesthesia, 'RYR1,CACNA1S');
  assert.equal(genes.nsaids, 'CYP2C9');
  assert.match(MEDICINE_TOPICS.find(topic => topic.id === 'nsaids').unknown, /no genetic recommendation for aspirin/);
  assert.match(MEDICINE_TOPICS.find(topic => topic.id === 'anesthesia').unknown, /does not rule out/);
  assert.match(MEDICINE_TOPICS.find(topic => topic.id === 'opioids').source.title, /2021/);
});

test('question export is educational, carries uncertainty and excludes search or DNA', () => {
  const html = createQuestionChecklistHtml(['warfarin', 'statins', 'warfarin']);
  assert.equal((html.match(/<article>/g) || []).length, 2);
  assert.match(html, /not a personal medical assessment/);
  assert.match(html, /Do not start, stop, substitute/);
  assert.match(html, /cannot replace INR monitoring/);
  assert.match(html, /Source|sources checked/);
  assert.match(html, /cpicpgx.org/);
  assert.match(html, /FDA labeling:/);
  assert.match(html, /fda\.gov\/medical-devices\/precision-medicine\/table-pharmacogenetic-associations/);
  assert.doesNotMatch(html, /<script|<img|rs4149056|genotype/);
});

test('export rejects empty, unknown, excessive or injected topic IDs', () => {
  assert.throws(() => createQuestionChecklistHtml([]), /at least one/);
  assert.throws(() => createQuestionChecklistHtml(['<img src=x onerror=alert(1)>']), /Unknown/);
  assert.throws(() => createQuestionChecklistHtml(MEDICINE_TOPICS.map(topic => topic.id)), /five/);
});
