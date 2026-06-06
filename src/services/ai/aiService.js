const config = require('../../config');
const logger = require('../../utils/logger');

let _gemini = null;

function getGemini() {
  if (!config.gemini.enabled || !config.gemini.apiKey) return null;
  if (_gemini) return _gemini;
  const { GoogleGenAI } = require('@google/genai');
  _gemini = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return _gemini;
}

// ─── Retry helper for 429s ────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const MAX_RETRIES = 2;

async function callWithRetry(fn, label) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.code === 429 ||
                    (err.message && err.message.includes('429'));
      if (is429 && attempt < MAX_RETRIES) {
        const match = err.message?.match(/retry\s*(?:in|Delay[":]*\s*)"?\s*(\d+)/i);
        const waitSec = match ? Math.min(parseInt(match[1], 10), 120) : (30 * Math.pow(2, attempt));
        logger.warn(`AI [${label}]: 429 hit, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ─── AI functions ─────────────────────────────────────────────────────────────

async function transcribeAudio(buffer, mimeType) {
  const ai = getGemini();
  if (!ai) return null;
  try {
    const base64 = buffer.toString('base64');
    const result = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [
        {
          parts: [
            { text: 'Transcribe this audio exactly as spoken. Return only the transcript text.' },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    }), 'transcribe');
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    logger.info('AI: transcription complete');
    return text || null;
  } catch (err) {
    logger.error(`AI: transcription failed — ${err.message}`);
    return null;
  }
}

async function generateSummaryAndTags(text) {
  const ai = getGemini();
  if (!ai || !text) return { summary: null, tags: [] };
  try {
    const result = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [
        {
          parts: [
            {
              text: `You are a personal knowledge assistant. Return valid JSON with keys: summary (1 sentence), tags (array of 3-5 lowercase strings).\n\n${text.slice(0, 3000)}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }), 'summary');
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(raw);
    logger.info('AI: summary + tags generated');
    return { summary: parsed.summary || null, tags: parsed.tags || [] };
  } catch (err) {
    logger.error(`AI: summary/tags failed — ${err.message}`);
    return { summary: null, tags: [] };
  }
}

async function generateL2Context(ogDescription) {
  const ai = getGemini();
  if (!ai || !ogDescription) return null;
  try {
    const result = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [
        {
          parts: [
            {
              text: `You are a semantic intelligence layer. Given an OG description from a webpage, extract 2-3 crisp insight bullets representing the deeper context, intent, or significance of this content. Be analytical and action-oriented — one level deeper than the surface summary.\n\nOG Description: "${ogDescription.slice(0, 1000)}"\n\nReturn valid JSON with key: insights (array of 2-3 strings, each under 120 chars).`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }), 'L2');
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(raw);
    logger.info('AI: L2 context generated');
    return Array.isArray(parsed.insights) ? parsed.insights : null;
  } catch (err) {
    logger.error(`AI: L2 context failed — ${err.message}`);
    return null;
  }
}

module.exports = { transcribeAudio, generateSummaryAndTags, generateL2Context };
