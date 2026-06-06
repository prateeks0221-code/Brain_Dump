/**
 * Telegram webhook controller.
 *
 * ACK strategy (prevents Telegram retries):
 *   1. res.sendStatus(200) IMMEDIATELY — before ANY async work
 *   2. Idempotency check (message_id already seen → bail)
 *   3. Download + createEntry (minimal persist, ~1-2s)
 *   4. ALL enrichment pushed to enrichmentQueue (fire-and-forget)
 *
 * Enrichment queue ensures:
 *   - No duplicate enrichment on same pageId
 *   - Timeout per job (5 min)
 *   - Concurrency limit (3 simultaneous)
 *   - Errors logged but never crash main loop
 */
const { getFileBuffer, sendMessage } = require('../services/telegram/telegramClient');
const { uploadToMasterDump }         = require('../services/drive/driveService');
const { findByMessageId, createEntry, patchEmptyFields } = require('../services/notion/notionService');
const { transcribeAudio, generateSummaryAndTags }        = require('../services/ai/aiService');
const { enrichLink }                 = require('../services/link/linkService');
const { extractReel, isReelUrl }     = require('../services/extraction/reelExtractor');
const { detectMessageType, buildFileName } = require('../utils/fileHelpers');
const { queue }                      = require('../services/enrichment/enrichmentQueue');
const { invalidate: invalidateIndex } = require('../services/search/searchIndex');
const logger                         = require('../utils/logger');

const MIME_MAP = {
  voice:    'audio/ogg',
  audio:    null,
  document: null,
  photo:    'image/jpeg',
  video:    'video/mp4',
};

// ─── Enrichment job builders ──────────────────────────────────────────────────

function buildAiEnrichJob(pageId, rawContent) {
  return async () => {
    const { summary, tags } = await generateSummaryAndTags(rawContent);
    const patch = {};
    if (summary)       patch.summary = { rich_text: [{ text: { content: summary } }] };
    if (tags?.length)  patch.tags    = { multi_select: tags.map((t) => ({ name: t })) };
    if (Object.keys(patch).length > 0) await patchEmptyFields(pageId, patch);
    logger.info(`enrichment[AI]: done for ${pageId}`);
  };
}

function buildLinkEnrichJob(pageId, rawContent) {
  return async () => {
    const linkData = await enrichLink(rawContent);
    if (!linkData) return;

    const patch = {};
    if (linkData.link_kind)        patch.link_kind        = { select: { name: linkData.link_kind } };
    if (linkData.link_url)         patch.link_url         = { url: linkData.link_url };
    if (linkData.og_title)         patch.og_title         = { rich_text: [{ text: { content: linkData.og_title.slice(0, 2000) } }] };
    if (linkData.og_description)   patch.og_description   = { rich_text: [{ text: { content: linkData.og_description.slice(0, 2000) } }] };
    if (linkData.og_image)         patch.og_image         = { url: linkData.og_image };
    if (linkData.og_site)          patch.og_site          = { rich_text: [{ text: { content: linkData.og_site.slice(0, 200) } }] };
    if (Object.keys(patch).length > 0) await patchEmptyFields(pageId, patch);

    // Reel extraction — runs inside its own serial queue inside reelExtractor
    if (isReelUrl(linkData?.link_kind)) {
      extractReel(linkData.link_url, pageId)
        .catch((err) => logger.error(`reelExtractor failed ${linkData.link_url}: ${err.message}`));
    }

    logger.info(`enrichment[link]: done for ${pageId}`);
  };
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

async function handleUpdate(req, res) {
  // ① ACK FIRST — prevents Telegram 30s retry
  res.sendStatus(200);

  const msg = req.body?.message;
  if (!msg) return;

  const messageId = msg.message_id;
  const chatId    = msg.chat.id;
  const timestamp = new Date(msg.date * 1000).toISOString();

  try {
    // ② Idempotency — skip already-seen messages
    const existing = await findByMessageId(messageId);
    if (existing) {
      logger.info(`Telegram: msg ${messageId} already in DB — skip`);
      return;
    }

    const type = detectMessageType(msg);
    logger.info(`Telegram: msg ${messageId} type=${type}`);

    let rawContent  = msg.text || msg.caption || null;
    let fileUrl     = null;
    let driveFileId = null;
    let buffer      = null;
    let mimeType    = null;
    let title       = rawContent ? rawContent.slice(0, 80) : `${type} – ${timestamp}`;

    // ③ Media download + Drive upload (fast path — needed before createEntry)
    if (['audio', 'voice', 'file', 'image', 'video'].includes(type)) {
      const mediaObj = msg.voice || msg.audio || msg.document || msg.video ||
        (msg.photo && msg.photo[msg.photo.length - 1]);

      const fileId      = mediaObj?.file_id;
      mimeType          = mediaObj?.mime_type || MIME_MAP[type === 'file' ? 'document' : type] || 'application/octet-stream';
      const originalName = mediaObj?.file_name || null;
      const fileName    = buildFileName(type, mimeType, originalName);

      ({ buffer } = await getFileBuffer(fileId));
      const uploaded = await uploadToMasterDump(buffer, fileName, mimeType);
      fileUrl     = uploaded.fileUrl;
      driveFileId = uploaded.fileId;
    }

    // ④ Persist minimal entry to Notion (~500ms)
    const notionPage = await createEntry({
      title, type, timestamp, fileUrl, rawContent, messageId, driveFileId,
    });
    const pageId = notionPage.id;

    // ⑤ All enrichment → queue (fire-and-forget, idempotency-guarded)

    // Audio/voice WITHOUT caption → transcribe first, then AI + link enrich
    if ((type === 'audio' || type === 'voice') && !rawContent && buffer && mimeType) {
      queue.push(`${pageId}:transcribe`, async () => {
        const transcript = await transcribeAudio(buffer, mimeType);
        if (transcript) {
          await patchEmptyFields(pageId, {
            raw_content: { rich_text: [{ text: { content: transcript.slice(0, 2000) } }] },
          });
          // Enqueue AI + link enrichment now that we have text
          queue.push(`${pageId}:ai`, buildAiEnrichJob(pageId, transcript));
          queue.push(`${pageId}:link`, buildLinkEnrichJob(pageId, transcript));
        }
      });
    } else if (rawContent) {
      // Text/link/captioned media → AI + link enrich directly
      queue.push(`${pageId}:ai`,   buildAiEnrichJob(pageId, rawContent));
      if (type === 'link' || type === 'text') {
        queue.push(`${pageId}:link`, buildLinkEnrichJob(pageId, rawContent));
      }
    }

    invalidateIndex(); // rebuild search index in background after new item
    await sendMessage(chatId, `Saved (${type}) ✓`);
    logger.info(`Telegram: msg ${messageId} → Notion ${pageId} — enrichment queued`);

  } catch (err) {
    logger.error(`handleUpdate error msg=${messageId}: ${err.message}`, err);
    try { await sendMessage(chatId, 'Error saving — please retry'); } catch (_) {}
  }
}

module.exports = { handleUpdate };
