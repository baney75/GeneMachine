import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_MEDICINE_LENGTH, MAX_NOTE_LENGTH, MAX_QUESTION_LENGTH,
  createTopicEntry, createCustomEntry, normalizeAppointmentEntries,
  createAppointmentHtml, createAppointmentText,
} from '../lib/appointment-kit.mjs';
import { LIBRARY_REVIEW_DATE, MEDICINE_TOPICS } from '../lib/medicine-library.mjs';

const generatedOn = new Date('2026-10-02T12:00:00Z');

test('constructors create editable drafts with the required shape', () => {
  const topic = MEDICINE_TOPICS[0];
  assert.deepEqual(createTopicEntry(topic.id), { kind: 'topic', topicId: topic.id, question: topic.question, notes: '' });
  assert.deepEqual(createCustomEntry(), {
    kind: 'custom', medicine: '',
    question: 'Could a pharmacogenetic test be relevant to this medicine and my situation? What other factors matter?', notes: '',
  });
  assert.throws(() => createTopicEntry('made-up'), /Unknown medicine topic/);
});

test('mixed worksheet keeps edits, multiline notes, and curated evidence in both exports', () => {
  const topic = MEDICINE_TOPICS.find((item) => item.id === 'fluoropyrimidines');
  const edited = { ...createTopicEntry(topic.id), question: '  What assessment fits\nmy situation?  ', notes: '  Prior report:\nask my oncologist  ' };
  const custom = { ...createCustomEntry('  Example medicine  ', '  My own question?  '), notes: '  Ask about other medicines.  ' };
  const original = structuredClone([edited, custom]);
  const normalized = normalizeAppointmentEntries([edited, custom]);
  assert.deepEqual([edited, custom], original);
  assert.deepEqual(normalized[0], { kind: 'topic', topicId: topic.id, question: 'What assessment fits\nmy situation?', notes: 'Prior report:\nask my oncologist' });
  assert.deepEqual(normalized[1], { kind: 'custom', medicine: 'Example medicine', question: 'My own question?', notes: 'Ask about other medicines.' });
  assert.notStrictEqual(normalized[0], edited);

  const html = createAppointmentHtml([edited, custom], { generatedOn });
  const text = createAppointmentText([edited, custom], { generatedOn });
  for (const output of [html, text]) {
    assert.match(output, /What assessment fits\nmy situation\?/);
    assert.match(output, /Prior report:\nask my oncologist/);
    assert.match(output, /Your question/);
    assert.match(output, /Medicine not assessed/);
    assert.match(output, new RegExp(LIBRARY_REVIEW_DATE));
    assert.ok(output.includes(topic.unknown));
    assert.ok(output.includes(topic.testing));
    assert.ok(output.includes(topic.source.title));
    assert.ok(output.includes(topic.source.url));
    assert.ok(output.includes(topic.update.note));
    assert.ok(output.includes(topic.update.url));
    assert.match(output, /not a personal medical assessment/);
    assert.match(output, /Do not start, stop, substitute, or change/);
  }
  assert.match(html, /white-space:pre-wrap/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /break-inside:avoid/);
  assert.match(html, /Your notes · user-written, not clinically assessed/);
});

test('custom-only worksheet makes no library assessment or source claim', () => {
  const entry = createCustomEntry('Unlisted medicine');
  const html = createAppointmentHtml([entry], { generatedOn });
  const text = createAppointmentText([entry], { generatedOn });
  for (const output of [html, text]) {
    assert.match(output, /Your question · Medicine not assessed/);
    assert.match(output, /No gene, test, or source is inferred/);
    assert.doesNotMatch(output, /Library sources checked/);
    assert.doesNotMatch(output, /CPIC/);
    assert.doesNotMatch(output, /FDA/);
  }
  assert.match(html, /<h2>Unlisted medicine<\/h2>/);
});

test('source spoofing cannot give custom content or an edited topic curated authority', () => {
  const spoof = {
    ...createCustomEntry('Unknown'), topicId: 'warfarin',
    source: { title: 'Fake guideline', url: 'https://evil.example' }, genes: ['CYP2C9'],
  };
  const topic = {
    ...createTopicEntry('warfarin'), question: 'My edited question?',
    source: { title: 'Fake guideline', url: 'https://evil.example' }, medicine: 'Fake medicine',
  };
  assert.deepEqual(normalizeAppointmentEntries([spoof])[0], createCustomEntry('Unknown'));
  const html = createAppointmentHtml([spoof, topic], { generatedOn });
  const text = createAppointmentText([spoof, topic], { generatedOn });
  for (const output of [html, text]) {
    assert.doesNotMatch(output, /Fake guideline|evil\.example|Fake medicine/);
    assert.match(output, /CPIC warfarin guideline \(2017\)/);
    assert.match(output, /My edited question\?/);
    assert.match(output, /Your question/);
  }
  assert.match(html, /<h2>Warfarin<\/h2>/);
  assert.doesNotMatch(html, /Suggested question<\/p><p class="user-text">My edited question/);
});

test('all curated warnings, testing guidance, primary sources, and updates survive export', () => {
  for (const topic of MEDICINE_TOPICS) {
    const html = createAppointmentHtml([createTopicEntry(topic.id)], { generatedOn });
    const text = createAppointmentText([createTopicEntry(topic.id)], { generatedOn });
    for (const output of [html, text]) {
      assert.ok(output.includes(topic.unknown));
      assert.ok(output.includes(topic.testing));
      assert.ok(output.includes(topic.source.title));
      assert.ok(output.includes(topic.source.url));
      assert.ok(output.includes(topic.fda), `${topic.id} FDA labeling summary`);
      assert.ok(output.includes('https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations'));
      if (topic.update) {
        assert.ok(output.includes(topic.update.note));
        assert.ok(output.includes(topic.update.url));
      }
      assert.match(output, /Suggested question/);
    }
  }
});

test('rejects invalid kinds, duplicates, empty and malformed fields, and all length limits', () => {
  const topic = createTopicEntry('warfarin');
  const custom = createCustomEntry('Medicine');
  assert.throws(() => normalizeAppointmentEntries('wrong'), TypeError);
  assert.throws(() => normalizeAppointmentEntries([null]), TypeError);
  assert.throws(() => normalizeAppointmentEntries([createCustomEntry()]), /Medicine cannot be empty/);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, kind: 'other' }]), /Unknown appointment entry kind/);
  assert.throws(() => normalizeAppointmentEntries([{ ...topic, topicId: 'unknown' }]), /Unknown medicine topic/);
  assert.throws(() => normalizeAppointmentEntries([topic, topic]), /Duplicate medicine topic/);
  assert.throws(() => normalizeAppointmentEntries(Array(6).fill(custom)), RangeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, question: '  ' }]), /Question cannot be empty/);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, medicine: 17 }]), TypeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, question: null }]), TypeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, notes: {} }]), TypeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...topic, topicId: 5 }]), TypeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, medicine: 'm'.repeat(MAX_MEDICINE_LENGTH + 1) }]), RangeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, question: 'q'.repeat(MAX_QUESTION_LENGTH + 1) }]), RangeError);
  assert.throws(() => normalizeAppointmentEntries([{ ...custom, notes: 'n'.repeat(MAX_NOTE_LENGTH + 1) }]), RangeError);
  assert.throws(() => createAppointmentHtml([]), /at least one question/);
  assert.throws(() => createAppointmentText([]), /at least one question/);
});

test('HTML escapes untrusted medicine, question, and notes without executable markup', () => {
  const malicious = '<img src=x onerror="alert(1)">';
  const entry = { ...createCustomEntry(malicious, malicious), notes: `${malicious}\n<script>alert(2)</script>` };
  const html = createAppointmentHtml([entry], { generatedOn });
  assert.equal((html.match(/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/g) ?? []).length, 3);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img\b|<script\b|onerror="alert/);
  assert.match(html, /\n&lt;script&gt;/);
});
