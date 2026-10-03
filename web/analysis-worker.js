import { analyzeLocalBytes, MAX_FILE_BYTES } from '../lib/local-analysis.mjs';

self.onmessage = async ({ data }) => {
  try {
    if (data.file && data.file.size > MAX_FILE_BYTES) throw new Error('This file is larger than the 80 MB browser safety limit.');
    self.postMessage({ stage: 'Reading your file on this device' });
    const bytes = data.file ? await data.file.arrayBuffer() : new TextEncoder().encode(data.text).buffer;
    self.postMessage({ stage: 'Checking file quality and the supported marker' });
    const result = await analyzeLocalBytes(bytes, data.file?.name || 'synthetic-reference.tsv');
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'This file could not be inspected.' });
  }
};
