/**
 * Gemini gemini-embedding-001 wrapper.
 * Returns Float32Array of 3072 dims per input string.
 * Rate-limit aware: retries on 429 with exponential backoff,
 * concurrency capped at 4 to stay under free-tier 100 RPM.
 */
const logger = require('../../utils/logger');

let _genai = null;

function getClient() {
  if (_genai) return _genai;
  const { GoogleGenAI } = require('@google/genai');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set — embedder unavailable');
  _genai = new GoogleGenAI({ apiKey });
  return _genai;
}

const EMBED_MODEL = 'gemini-embedding-001';
const MAX_RETRIES = 3;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Embed a single string with retry on 429.
 * Returns Float32Array (3072 dims) or null on failure.
 */
async function embedText(text) {
  if (!text || typeof text !== 'string') return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ai     = getClient();
      const result = await ai.models.embedContent({
        model:    EMBED_MODEL,
        contents: text.slice(0, 2000),
      });
      const values = result?.embeddings?.[0]?.values;
      if (!values) return null;
      return new Float32Array(values);
    } catch (err) {
      const is429 = err?.status === 429 || err?.code === 429 ||
                    (err.message && err.message.includes('429'));
      if (is429 && attempt < MAX_RETRIES) {
        // Parse retryDelay from error or use exponential backoff
        const match = err.message?.match(/retry\s*(?:in|Delay[":]*\s*)"?\s*(\d+)/i);
        const waitSec = match ? parseInt(match[1], 10) : (15 * Math.pow(2, attempt));
        logger.warn(`embedder: 429 hit, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitSec * 1000);
        continue;
      }
      logger.warn(`embedder: failed — ${err.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Embed multiple strings. Returns array of Float32Array | null (same length as input).
 * Concurrency capped at 4 with inter-batch delay to respect free-tier RPM limits.
 */
async function embedBatch(texts) {
  if (!texts.length) return [];

  const CONCURRENCY = 4; // reduced from 8 to stay under 100 RPM
  const INTER_BATCH_DELAY_MS = 3000; // 4 calls per 3s ≈ 80 RPM, well under 100
  const results = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((t) => embedText(t))
    );
    for (let j = 0; j < settled.length; j++) {
      results[i + j] = settled[j].status === 'fulfilled' ? settled[j].value : null;
    }

    // Throttle between batches (skip after last batch)
    if (i + CONCURRENCY < texts.length) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }
  return results;
}

/**
 * Cosine similarity between two Float32Arrays.
 */
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

module.exports = { embedText, embedBatch, cosineSim };
