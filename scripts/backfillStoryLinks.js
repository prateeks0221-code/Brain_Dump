/**
 * backfillStoryLinks.js
 *
 * One-shot script: reads every Story page, parses URLs from the `Link` text field,
 * and creates a LUCA_Dump row for each URL — with the Story relation pre-set
 * and `wall` populated from Story.category.
 *
 * The poller will also pick up newly created rows and may re-sync wall,
 * but we write it here too so it's set immediately.
 *
 * Usage:
 *   node scripts/backfillStoryLinks.js
 *   node scripts/backfillStoryLinks.js --dry-run   # logs only, no writes
 *
 * Env vars needed (same as main app):
 *   NOTION_TOKEN
 *   NOTION_DATABASE_ID        (LUCA_Dump DB)
 *   NOTION_STORIES_DB_ID      (Stories DB — add to .env if not present)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('@notionhq/client');

const DRY_RUN = process.argv.includes('--dry-run');

const notion    = new Client({ auth: process.env.NOTION_TOKEN });
const LUCA_DB   = process.env.NOTION_DATABASE_ID;
const STORIES_DB = process.env.NOTION_STORIES_DB_ID;

if (!LUCA_DB)     throw new Error('NOTION_DATABASE_ID missing from .env');
if (!STORIES_DB)  throw new Error('NOTION_STORIES_DB_ID missing from .env — add it');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all http(s) URLs from a Notion rich_text array */
function extractUrls(richTextArr) {
  if (!richTextArr || richTextArr.length === 0) return [];
  const full = richTextArr.map((t) => t.plain_text).join('\n');
  const urlRegex = /https?:\/\/[^\s,\n\]")]+/g;
  return [...new Set(full.match(urlRegex) || [])];
}

/** Derive a short title from a URL (last path segment, max 80 chars) */
function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const slug = parts[parts.length - 1] || u.hostname;
    return decodeURIComponent(slug).slice(0, 80);
  } catch {
    return url.slice(0, 80);
  }
}

/** Fetch all pages from a Notion DB (handles pagination) */
async function queryAll(database_id) {
  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/** Idempotency: check if LUCA_Dump already has a row with this link_url */
async function rowExistsForUrl(url) {
  const res = await notion.databases.query({
    database_id: LUCA_DB,
    filter: { property: 'link_url', url: { equals: url } },
    page_size: 1,
  });
  return res.results.length > 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🔍  Fetching all Story pages…`);
  const stories = await queryAll(STORIES_DB);
  console.log(`   Found ${stories.length} stories.\n`);

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  for (const story of stories) {
    const storyId    = story.id;
    const storyTitle =
      story.properties?.Name?.title?.[0]?.plain_text ||
      story.properties?.title?.title?.[0]?.plain_text ||
      storyId;
    const category   = story.properties?.category?.select?.name || null;
    const linkText   = story.properties?.Link?.rich_text || [];

    const urls = extractUrls(linkText);
    if (urls.length === 0) {
      console.log(`  ⏭   "${storyTitle}" — no URLs, skipping`);
      continue;
    }

    console.log(`  📖  "${storyTitle}" (wall="${category || '—'}") — ${urls.length} URL(s)`);

    for (const url of urls) {
      try {
        if (await rowExistsForUrl(url)) {
          console.log(`       ↳ exists  : ${url}`);
          skipped++;
          continue;
        }

        const title = titleFromUrl(url);

        const props = {
          title:     { title: [{ text: { content: title } }] },
          type:      { select: { name: 'link' } },
          link_url:  { url },
          Story:     { relation: [{ id: storyId }] },
          processed: { checkbox: false },
          timestamp: { date: { start: new Date().toISOString() } },
        };

        if (category) {
          props.wall = { select: { name: category } };
        }

        if (DRY_RUN) {
          console.log(`       ↳ [dry-run]: "${title}" wall="${category || '—'}"`);
        } else {
          await notion.pages.create({
            parent: { database_id: LUCA_DB },
            properties: props,
          });
          console.log(`       ↳ ✅ created : "${title}" wall="${category || '—'}"`);
        }

        created++;
        // Stay under Notion rate limit (3 req/s)
        await new Promise((r) => setTimeout(r, 400));

      } catch (err) {
        console.error(`       ↳ ❌ error   : ${url} — ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  ${DRY_RUN ? '[DRY RUN] ' : ''}Complete.`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}  (already existed)`);
  console.log(`  Errors  : ${errors}`);
  console.log(`─────────────────────────────────────────\n`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
