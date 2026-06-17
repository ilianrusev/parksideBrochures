import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'brochures.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS brochures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date_range TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'lidl',
      total_pages INTEGER DEFAULT 0,
      is_current INTEGER DEFAULT 1,
      scraped_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parkside_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brochure_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      detected_by TEXT NOT NULL CHECK(detected_by IN ('keyword', 'link')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (brochure_id) REFERENCES brochures(id) ON DELETE CASCADE,
      UNIQUE(brochure_id, page_number)
    );
  `);

  // Add is_current column if missing (migration for existing DBs)
  const cols = db.prepare("PRAGMA table_info(brochures)").all();
  if (!cols.find(c => c.name === 'is_current')) {
    db.exec('ALTER TABLE brochures ADD COLUMN is_current INTEGER DEFAULT 1');
  }

  return db;
}

export function upsertBrochure({ title, dateRange, url, source, totalPages }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO brochures (title, date_range, url, source, total_pages, scraped_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      total_pages = excluded.total_pages,
      scraped_at = datetime('now')
    RETURNING id
  `);
  return stmt.get(title, dateRange, url, source, totalPages).id;
}

export function insertParksidePage({ brochureId, pageNumber, imageUrl, detectedBy }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO parkside_pages (brochure_id, page_number, image_url, detected_by)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(brochureId, pageNumber, imageUrl, detectedBy);
}

export function clearBrochurePages(brochureId) {
  const db = getDb();
  db.prepare('DELETE FROM parkside_pages WHERE brochure_id = ?').run(brochureId);
}

export function getAllParksidePages() {
  const db = getDb();
  return db.prepare(`
    SELECT
      pp.id, pp.page_number, pp.image_url, pp.detected_by, pp.created_at,
      b.id AS brochure_id, b.title, b.date_range, b.url AS brochure_url, b.source
    FROM parkside_pages pp
    JOIN brochures b ON b.id = pp.brochure_id
    WHERE b.is_current = 1
    ORDER BY b.scraped_at DESC, pp.page_number ASC
  `).all();
}

export function getArchivedParksidePages() {
  const db = getDb();
  return db.prepare(`
    SELECT
      pp.id, pp.page_number, pp.image_url, pp.detected_by, pp.created_at,
      b.id AS brochure_id, b.title, b.date_range, b.url AS brochure_url, b.source
    FROM parkside_pages pp
    JOIN brochures b ON b.id = pp.brochure_id
    WHERE b.is_current = 0
    ORDER BY b.scraped_at DESC, pp.page_number ASC
  `).all();
}

export function getBrochuresWithParksidePages() {
  const db = getDb();
  return db.prepare(`
    SELECT b.*, COUNT(pp.id) AS parkside_page_count
    FROM brochures b
    JOIN parkside_pages pp ON pp.brochure_id = b.id
    GROUP BY b.id
    ORDER BY b.source ASC, b.scraped_at DESC
  `).all();
}

export function getParksidePagesByBrochure(brochureId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM parkside_pages WHERE brochure_id = ? ORDER BY page_number ASC
  `).all(brochureId);
}

export function markUnlistedBrochures(source, currentUrls) {
  const db = getDb();
  if (!currentUrls.length) return { changes: 0 };
  const placeholders = currentUrls.map(() => '?').join(',');
  // Mark currently listed brochures as current
  db.prepare(`
    UPDATE brochures SET is_current = 1
    WHERE source = ? AND url IN (${placeholders})
  `).run(source, ...currentUrls);
  // Mark unlisted brochures as archived
  return db.prepare(`
    UPDATE brochures SET is_current = 0
    WHERE source = ? AND url NOT IN (${placeholders})
  `).run(source, ...currentUrls);
}

export function cleanupOldBrochures(maxAgeDays = 30) {
  const db = getDb();
  return db.prepare(`
    DELETE FROM brochures
    WHERE scraped_at < datetime('now', ? || ' days')
  `).run(-maxAgeDays);
}
