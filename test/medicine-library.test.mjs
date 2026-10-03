import assert from 'node:assert/strict';
import test from 'node:test';
import { MEDICINE_TOPICS, searchMedicineTopics, createQuestionChecklistHtml } from '../lib/medicine-library.mjs';

test('medicine, brand and gene searches work without genetic or personal data', () => {
  assert.equal(searchMedicineTopics().length, 7);
  assert.deepEqual(searchMedicineTopics(' Plavix ').map(topic => topic.id), ['clopidogrel']);
  assert.deepEqual(searchMedicineTopics('CYP2D6 pain').map(topic => topic.id), ['opioids']);
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

test('question export is educational, carries uncertainty and excludes search or DNA', () => {
  const html = createQuestionChecklistHtml(['warfarin', 'statins', 'warfarin']);
  assert.equal((html.match(/<article>/g) || []).length, 2);
  assert.match(html, /not a personal medical assessment/);
  assert.match(html, /Do not start, stop, substitute/);
  assert.match(html, /cannot replace INR monitoring/);
  assert.match(html, /Source|sources checked/);
  assert.match(html, /cpicpgx.org/);
  assert.doesNotMatch(html, /<script|<img|rs4149056|genotype/);
});

test('export rejects empty, unknown, excessive or injected topic IDs', () => {
  assert.throws(() => createQuestionChecklistHtml([]), /at least one/);
  assert.throws(() => createQuestionChecklistHtml(['<img src=x onerror=alert(1)>']), /Unknown/);
  assert.throws(() => createQuestionChecklistHtml(MEDICINE_TOPICS.map(topic => topic.id)), /five/);
});
