import { parseConsumerDna, evaluateSlco1b1ExactMarker, createPharmacogeneticCapabilityMap } from './consumer-dna.mjs';

export const MAX_FILE_BYTES = 80 * 1024 * 1024;

// Only the finding and aggregate QC cross the worker boundary.
export function analyzeLocalText(text, sourceName = '') {
  const parsed = parseConsumerDna(text, sourceName);
  const finding = evaluateSlco1b1ExactMarker(parsed);
  const capability = createPharmacogeneticCapabilityMap(parsed);
  const { markers, fileName, ...report } = parsed;
  return { report, finding, capability };
}

export async function analyzeLocalBytes(bytes, sourceName = '') {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('This file is larger than the 80 MB browser safety limit.');
  const digestBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const digest = [...new Uint8Array(digestBuffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { ...analyzeLocalText(text, sourceName), digest };
}
