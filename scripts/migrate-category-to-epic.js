/**
 * Notion Schema Migration: Category → Epic/Wall
 * 
 * Run: node scripts/migrate-category-to-epic.js
 * 
 * Steps:
 * 1. Creates Epic database if not exists
 * 2. Seeds Epic rows from unique Story.category values
 * 3. Adds "epic" relation to Stories database
 * 4. Links each Story to its Epic
 * 5. Creates Chunk database
 * 6. Creates Thread database
 * 7. Migrates existing Master_Dump rows → Chunk rows
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ─── CONFIG ─────────────────────────────────────────────
const STORIES_DB_ID = process.env.NOTION_STORIES_DB_ID;      // your current Stories DB
const MASTER_DB_ID = process.env.NOTION_DATABASE_ID;         // your current Master_Dump DB
const PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;    // where new DBs live

let EPIC_DB_ID = process.env.NOTION_EPIC_DB_ID;
let CHUNK_DB_ID = process.env.NOTION_CHUNK_DB_ID;
let THREAD_DB_ID = process.env.NOTION_THREAD_DB_ID;

// ─── 1. CREATE EPIC DATABASE ────────────────────────────
async function createEpicDb() {
  if (EPIC_DB_ID) {
    console.log('✓ Epic DB already exists:', EPIC_DB_ID);
    return EPIC_DB_ID;
  }

  const db = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Epics' } }],
    properties: {
      name: { title: {} },
      slug: { rich_text: {} },
      category_key: { rich_text: {} },
      description: { rich_text: {} },
    },
    is_inline: false,
  });

  EPIC_DB_ID = db.id;
  console.log('✓ Created Epic DB:', EPIC_DB_ID);
  return EPIC_DB_ID;
}

// ─── 2. SEED EPICS FROM STORY.CATEGORY ──────────────────
async function seedEpicsFromCategories() {
  const stories = await notion.databases.query({
    database_id: STORIES_DB_ID,
    filter: { property: 'category', rich_text: { is_not_empty: true } },
  });

  const uniqueCategories = [...new Set(
    stories.results.map(s => s.properties.category?.rich_text?.[0]?.text?.content).filter(Boolean)
  )];

  console.log(`Found ${uniqueCategories.length} unique categories:`, uniqueCategories);

  const epicMap = {}; // category_key → page_id

  for (const cat of uniqueCategories) {
    const slug = cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if already exists
    const existing = await notion.databases.query({
      database_id: EPIC_DB_ID,
      filter: { property: 'category_key', rich_text: { equals: cat } },
    });

    if (existing.results.length > 0) {
      epicMap[cat] = existing.results[0].id;
      console.log(`  → Epic "${cat}" already exists`);
      continue;
    }

    const page = await notion.pages.create({
      parent: { database_id: EPIC_DB_ID },
      properties: {
        name: { title: [{ text: { content: cat } }] },
        slug: { rich_text: [{ text: { content: slug } }] },
        category_key: { rich_text: [{ text: { content: cat } }] },
      },
    });

    epicMap[cat] = page.id;
    console.log(`  ✓ Created Epic "${cat}" → ${page.id}`);
  }

  return epicMap;
}

// ─── 3. ADD EPIC RELATION TO STORIES DB ─────────────────
async function addEpicRelationToStories() {
  // Notion API doesn't allow adding relations programmatically to existing DBs
  // You must do this manually in Notion UI:
  // 1. Open Stories DB → Add property → Relation → Select "Epics" DB
  // 2. Name it "epic"
  // 3. Add formula property "category" = prop("epic").title()

  console.log(`
⚠️  MANUAL STEP REQUIRED IN NOTION UI:
   1. Open Stories database (${STORIES_DB_ID})
   2. Add property → Relation → Select "Epics" database
   3. Name: "epic"
   4. Add Formula property: "category" = prop("epic").title()
   5. Come back and run: node scripts/link-stories-to-epics.js
  `);
}

// ─── 4. LINK STORIES TO EPICS ───────────────────────────
async function linkStoriesToEpics(epicMap) {
  const stories = await notion.databases.query({
    database_id: STORIES_DB_ID,
    filter: { property: 'category', rich_text: { is_not_empty: true } },
  });

  for (const story of stories.results) {
    const category = story.properties.category?.rich_text?.[0]?.text?.content;
    const epicId = epicMap[category];

    if (!epicId) {
      console.log(`  ✗ No epic found for category "${category}"`);
      continue;
    }

    // Check if already linked
    const currentEpic = story.properties.epic?.relation?.[0]?.id;
    if (currentEpic === epicId) {
      console.log(`  → Story "${story.properties.name?.title?.[0]?.text?.content}" already linked`);
      continue;
    }

    await notion.pages.update({
      page_id: story.id,
      properties: {
        epic: { relation: [{ id: epicId }] },
      },
    });

    console.log(`  ✓ Linked "${story.properties.name?.title?.[0]?.text?.content}" → "${category}"`);
  }
}

// ─── 5. CREATE CHUNK DATABASE ───────────────────────────
async function createChunkDb() {
  if (CHUNK_DB_ID) {
    console.log('✓ Chunk DB already exists:', CHUNK_DB_ID);
    return CHUNK_DB_ID;
  }

  const db = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Chunks' } }],
    properties: {
      name: { title: {} },
      story: { relation: { database_id: STORIES_DB_ID, single_property: {} } },
      epic: { relation: { database_id: EPIC_DB_ID, single_property: {} } },
      source_url: { url: {} },
      source_type: { select: { options: [
        { name: 'reel', color: 'purple' },
        { name: 'video', color: 'red' },
        { name: 'image', color: 'yellow' },
        { name: 'chat', color: 'blue' },
        { name: 'article', color: 'green' },
        { name: 'note', color: 'gray' },
      ]}},
      summary: { rich_text: {} },
      wiki: { rich_text: {} },
      notion_row: { url: {} },
      status: { select: { options: [
        { name: 'raw', color: 'gray' },
        { name: 'summarized', color: 'blue' },
        { name: 'wikified', color: 'green' },
        { name: 'basket', color: 'orange' },
        { name: 'threaded', color: 'purple' },
        { name: 'done', color: 'green' },
      ]}},
      created_at: { created_time: {} },
    },
    is_inline: false,
  });

  CHUNK_DB_ID = db.id;
  console.log('✓ Created Chunk DB:', CHUNK_DB_ID);
  return CHUNK_DB_ID;
}

// ─── 6. CREATE THREAD DATABASE ──────────────────────────
async function createThreadDb() {
  if (THREAD_DB_ID) {
    console.log('✓ Thread DB already exists:', THREAD_DB_ID);
    return THREAD_DB_ID;
  }

  const db = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Threads' } }],
    properties: {
      name: { title: {} },
      chunk: { relation: { database_id: CHUNK_DB_ID, single_property: {} } },
      epic: { relation: { database_id: EPIC_DB_ID, single_property: {} } },
      agent_log: { rich_text: {} },
      output_chunk: { relation: { database_id: CHUNK_DB_ID, single_property: {} } },
      status: { select: { options: [
        { name: 'queued', color: 'gray' },
        { name: 'running', color: 'blue' },
        { name: 'done', color: 'green' },
      ]}},
      created_at: { created_time: {} },
    },
    is_inline: false,
  });

  THREAD_DB_ID = db.id;
  console.log('✓ Created Thread DB:', THREAD_DB_ID);
  return THREAD_DB_ID;
}

// ─── 7. MIGRATE MASTER_DUMP → CHUNKS ────────────────────
async function migrateMasterToChunks() {
  const masterItems = await notion.databases.query({
    database_id: MASTER_DB_ID,
    page_size: 100,
  });

  console.log(`Migrating ${masterItems.results.length} Master_Dump items...`);

  for (const item of masterItems.results) {
    const props = item.properties;

    const title = props.title?.title?.[0]?.text?.content || 'Untitled';
    const type = props.type?.select?.name || 'note';
    const rawContent = props.raw_content?.rich_text?.[0]?.text?.content || '';
    const fileUrl = props.file_url?.url || '';
    const storyRelation = props.story?.relation?.[0]?.id;
    const summary = props.summary?.rich_text?.[0]?.text?.content || '';
    const tags = props.tags?.multi_select?.map(t => t.name) || [];

    // Determine source_type mapping
    const sourceTypeMap = {
      text: 'note',
      audio: 'note',
      image: 'image',
      video: 'video',
      file: 'note',
      link: 'article',
    };

    const chunk = await notion.pages.create({
      parent: { database_id: CHUNK_DB_ID },
      properties: {
        name: { title: [{ text: { content: title } }] },
        story: storyRelation ? { relation: [{ id: storyRelation }] } : undefined,
        source_url: fileUrl ? { url: fileUrl } : undefined,
        source_type: { select: { name: sourceTypeMap[type] || 'note' } },
        summary: summary ? { rich_text: [{ text: { content: summary } }] } : { rich_text: [{ text: { content: rawContent.slice(0, 200) } }] },
        wiki: { rich_text: [{ text: { content: rawContent } }] },
        notion_row: { url: `https://notion.so/${item.id.replace(/-/g, '')}` },
        status: { select: { name: summary ? 'summarized' : 'raw' } },
      },
    });

    console.log(`  ✓ Migrated "${title}" → Chunk ${chunk.id}`);
  }
}

// ─── MAIN ───────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting Category → Epic/Wall Migration\n');

  await createEpicDb();
  const epicMap = await seedEpicsFromCategories();
  await addEpicRelationToStories();

  // After manual step, run linkStoriesToEpics(epicMap)
  // await linkStoriesToEpics(epicMap);

  await createChunkDb();
  await createThreadDb();
  // await migrateMasterToChunks(); // Run after linking stories

  console.log('\n📋 ENV VARS TO ADD:');
  console.log(`NOTION_EPIC_DB_ID=${EPIC_DB_ID}`);
  console.log(`NOTION_CHUNK_DB_ID=${CHUNK_DB_ID}`);
  console.log(`NOTION_THREAD_DB_ID=${THREAD_DB_ID}`);
}

main().catch(console.error);