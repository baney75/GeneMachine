import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { analyzeLocalText, analyzeLocalBytes, MAX_FILE_BYTES } from '../lib/local-analysis.mjs';

const fixture = readFileSync(new URL('../samples/synthetic-ancestry.txt', import.meta.url));

test('worker result contains aggregate QC and the supported finding without filename or full genotype table', () => {
  const result = analyzeLocalText(fixture.toString(), 'private-person-name.txt');
  assert.equal(result.finding.status, 'supported_observation');
  assert.equal(result.finding.observedGenotype.marker, 'rs4149056');
  assert.ok(result.report.variantRows > 1);
  assert.equal(Object.hasOwn(result.report, 'markers'), false);
  assert.equal(Object.hasOwn(result.report, 'fileName'), false);
  assert.doesNotMatch(JSON.stringify(result), /private-person-name|rs101/);
});

test('input digest hashes original bytes, including BOM and CRLF, without changing observation', async () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(fixture.toString().replaceAll('\n', '\r\n'))]);
  const result = await analyzeLocalBytes(bytes);
  assert.equal(result.digest, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.finding.status, 'supported_observation');
});

test('missing locus stays unknown through summary boundary', () => {
  const result = analyzeLocalText(fixture.toString().replace(/^rs4149056.*\n?/m, ''));
  assert.equal(result.finding.status, 'abstain');
  assert.equal(result.finding.reasonCode, 'marker_missing');
  assert.equal(result.capability.exactMarker.status, 'abstain');
});

test('invalid encoding and oversized inputs fail before parsing', async () => {
  await assert.rejects(analyzeLocalBytes(new Uint8Array([0xff, 0xfe, 0xfd])), /encoded data/);
  await assert.rejects(analyzeLocalBytes({ byteLength: MAX_FILE_BYTES + 1 }), /80 MB/);
});
