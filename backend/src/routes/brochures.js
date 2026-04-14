import { Router } from 'express';
import {
  getAllParksidePages,
  getBrochuresWithParksidePages,
  getParksidePagesByBrochure,
} from '../db.js';
import { scrape } from '../scraper.js';

const router = Router();

// Simple in-memory cache (TTL in ms)
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cache = new Map();

function cached(key, fetchFn) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) {
    return entry.data;
  }
  const data = fetchFn();
  cache.set(key, { data, time: Date.now() });
  return data;
}

export function clearCache() {
  cache.clear();
}

// GET /api/pages — all current Parkside pages (flat list for the mobile app)
router.get('/pages', (req, res) => {
  const pages = cached('pages', getAllParksidePages);
  res.json(pages);
});

// GET /api/brochures — brochures that have Parkside pages
router.get('/brochures', (req, res) => {
  const brochures = cached('brochures', getBrochuresWithParksidePages);
  res.json(brochures);
});

// GET /api/brochures/:id/pages — Parkside pages for a specific brochure
router.get('/brochures/:id/pages', (req, res) => {
  const pages = cached(`brochure-${req.params.id}`, () => getParksidePagesByBrochure(req.params.id));
  res.json(pages);
});

// POST /api/scrape — trigger a manual scrape
router.post('/scrape', async (req, res) => {
  try {
    const result = await scrape();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
