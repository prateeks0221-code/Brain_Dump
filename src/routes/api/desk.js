const express = require('express');
const { getNotion } = require('../../services/notion/notionClient');
const { getDrive } = require('../../services/drive/driveClient');
const config = require('../../config');
const { enrichLink } = require('../../services/link/linkService');
const { patchEmptyFields } = require('../../services/notion/notionService');
const { generateL2Context } = require('../../services/ai/aiService');

// In-memory L2 cache — keyed by item ID
const l2Cache = new Map();
const logger = require('../../utils/logger');

const router = express.Router();

function prop(page, key, type) {
  const p = page.properties[key];
  if (!p) return null;
  switch (type || p.type) {
    case 'title': return p.title?.[0]?.plain_text || null;
    case 'rich_text': return p.rich_text?.[0]?.plain_text || null;
    case 'select': return p.select?.name || null;
    case 'multi_select': return p.multi_select?.map((s) => s.name) || [];
    case 'checkbox': return p.checkbox ?? false;
    case 'date': return p.date?.start || null;
    case 'url': return p.url || null;
    default: return null;
  }
}

function normalizeItem(page) {
  const storyRel = page.properties?.Story?.relation || page.properties?.story?.relation || [];
  return {
    id: page.id,
    title: prop(page, 'Title', 'title') || prop(page, 'title', 'title'),
    type: prop(page, 'type', 'select'),
    timestamp: prop(page, 'timestamp', 'date'),
    processed: prop(page, 'processed', 'checkbox'),
    raw_content: prop(page, 'raw_content', 'rich_text'),
    summary: prop(page, 'summary', 'rich_text'),
    tags: prop(page, 'tags', 'multi_select'),
    file_url: prop(page, 'file_url', 'url'),
    drive_file_id: prop(page, 'drive_file_id', 'rich_text'),
    link_kind: prop(page, 'link_kind', 'select'),
    link_url: prop(page, 'link_url', 'url'),
    og_title: prop(page, 'og_title', 'rich_text'),
    og_description: prop(page, 'og_description', 'rich_text'),
    og_image: prop(page, 'og_image', 'url'),
    og_site: prop(page, 'og_site', 'rich_text'),
    reel_links: (() => { try { return JSON.parse(prop(page, 'reel_links', 'rich_text') || '[]'); } catch { return []; } })(),
    story_id: storyRel[0]?.id || null,
    notion_url: page.url,
    last_edited: page.last_edited_time,
  };
}

// GET /api/desk/items?processed=false&limit=100&today=true
router.get('/items', async (req, res) => {
  try {
    const notion = getNotion();
    const showProcessed = req.query.processed === 'true';
    const todayOnly = req.query.today === 'true';
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);

    const filters = [];

    if (!showProcessed && !todayOnly) {
      filters.push({ property: 'processed', checkbox: { equals: false } });
    }

    if (todayOnly) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      filters.push({ property: 'timestamp', date: { on_or_after: d.toISOString() } });
    }

    const filter = filters.length > 1
      ? { and: filters }
      : filters[0];

    const response = await notion.databases.query({
      database_id: config.notion.databaseId,
      ...(filter ? { filter } : {}),
      sorts: [{ property: 'timestamp', direction: 'descending' }],
      page_size: limit,
    });

    const items = response.results.map(normalizeItem);
    res.json({ items, total: items.length });
  } catch (err) {
    logger.error(`GET /api/desk/items error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/desk/items/:id
router.patch('/items/:id', async (req, res) => {
  try {
    const notion = getNotion();
    const { processed, tags, wall, position_x, position_y } = req.body;
    const patch = {};

    if (typeof processed === 'boolean') patch.processed = { checkbox: processed };
    if (Array.isArray(tags)) patch.tags = { multi_select: tags.map((t) => ({ name: t })) };
    if (wall !== undefined) patch.wall = { select: wall ? { name: wall } : null };
    if (position_x !== undefined) patch.position_x = { number: position_x };
    if (position_y !== undefined) patch.position_y = { number: position_y };

    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to patch' });

    await notion.pages.update({ page_id: req.params.id, properties: patch });
    res.json({ ok: true });
  } catch (err) {
    logger.error(`PATCH /api/desk/items/${req.params.id} error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/desk/items/:id/unfurl — retry OG unfurl
router.post('/items/:id/unfurl', async (req, res) => {
  try {
    const { raw_content } = req.body;
    if (!raw_content) return res.status(400).json({ error: 'raw_content required' });

    const linkData = await enrichLink(raw_content);
    if (!linkData) return res.json({ ok: false, reason: 'no url or unfurl failed' });

    const linkPatch = {};
    if (linkData.link_kind) linkPatch.link_kind = { select: { name: linkData.link_kind } };
    if (linkData.link_url) linkPatch.link_url = { url: linkData.link_url };
    if (linkData.og_title) linkPatch.og_title = { rich_text: [{ text: { content: linkData.og_title.slice(0, 2000) } }] };
    if (linkData.og_description) linkPatch.og_description = { rich_text: [{ text: { content: linkData.og_description.slice(0, 2000) } }] };
    if (linkData.og_image) linkPatch.og_image = { url: linkData.og_image };
    if (linkData.og_site) linkPatch.og_site = { rich_text: [{ text: { content: linkData.og_site.slice(0, 200) } }] };

    await patchEmptyFields(req.params.id, linkPatch);
    res.json({ ok: true, linkData });
  } catch (err) {
    logger.error(`POST unfurl error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/desk/items/:id/l2 — generate L2 context from og_description via Gemini
router.post('/items/:id/l2', async (req, res) => {
  try {
    const { id } = req.params;
    const { og_description } = req.body;

    if (!og_description) return res.status(400).json({ error: 'og_description required' });

    // Serve cached result immediately
    if (l2Cache.has(id)) return res.json({ insights: l2Cache.get(id), cached: true });

    const insights = await generateL2Context(og_description);
    if (!insights) return res.json({ insights: null, error: 'Gemini unavailable or quota exceeded' });

    l2Cache.set(id, insights);
    // Evict cache entries when map grows large
    if (l2Cache.size > 1000) {
      const firstKey = l2Cache.keys().next().value;
      l2Cache.delete(firstKey);
    }

    res.json({ insights });
  } catch (err) {
    logger.error(`POST /api/desk/items/${req.params.id}/l2 error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/desk/proxy/:fileId — stream Drive file through backend (service account auth)
router.get('/proxy/:fileId', async (req, res) => {
  try {
    const drive = getDrive();
    const { fileId } = req.params;

    // Fetch file metadata first to get mime type, name, size
    // supportsAllDrives required — files live in a Shared Drive
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType,name,size',
      supportsAllDrives: true,
    });

    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const fileName = (meta.data.name || 'file').replace(/"/g, '\\"');
    const size = parseInt(meta.data.size || '0', 10);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    if (size) res.setHeader('Content-Length', size);

    // Handle Range requests so audio/video seeking works
    const rangeHeader = req.headers.range;
    if (rangeHeader && size) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : size - 1;
      const chunkSize = end - start + 1;

      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', chunkSize);

      const stream = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
      );
      stream.data.pipe(res);
    } else {
      const stream = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      stream.data.pipe(res);
    }
  } catch (err) {
    logger.error(`GET /proxy/${req.params.fileId}: ${err.message}`);
    if (!res.headersSent) res.status(404).json({ error: 'File not found or inaccessible' });
  }
});

module.exports = router;
