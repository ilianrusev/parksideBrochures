import * as cheerio from 'cheerio';
import {
  upsertBrochure,
  insertParksidePage,
  clearBrochurePages,
  cleanupOldBrochures,
} from './db.js';

const LIDL_URL = process.env.BROCHURE_URL;
const KAUFLAND_URL = process.env.KAUFLAND_URL;
const FLYER_API = process.env.FLYER_API;
const PARKSIDE_PATTERN = /parkside/i;

/** Format "2026-03-30" → "30.03.2026" */
function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html',
};

/**
 * Fetch Lidl flyer identifiers from listing page.
 * Each <a class="flyer"> has href like /l/bg/broshura/30-03-05-04/ar/0
 */
async function fetchLidlFlyers() {
  console.log(`[scraper] Fetching Lidl listing: ${LIDL_URL}`);
  const res = await fetch(LIDL_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Lidl listing fetch failed: ${res.status}`);

  const $ = cheerio.load(await res.text());
  const flyers = [];

  $('a.flyer').each((_, el) => {
    const href = $(el).attr('href') || '';
    const name = $(el).find('.flyer__name').text().trim();
    const title = $(el).find('.flyer__title').text().trim();
    const match = href.match(/\/l\/bg\/broshura\/([^/]+)\/ar\//);
    if (match) {
      flyers.push({
        source: 'lidl',
        identifier: match[1],
        regionId: '0',
        name,
        title,
        url: href.startsWith('http') ? href : `https://www.lidl.bg${href}`,
      });
    }
  });

  console.log(`[scraper] Lidl: ${flyers.length} flyers — ${flyers.map(f => f.identifier).join(', ')}`);
  return flyers;
}

/**
 * Fetch Kaufland flyer identifiers from listing page.
 * Each <a class="m-flyer-tile__link"> has href like
 *   leaflets.kaufland.com/bg-BG/{IDENTIFIER}/ar/{REGION}
 */
async function fetchKauflandFlyers() {
  console.log(`[scraper] Fetching Kaufland listing: ${KAUFLAND_URL}`);
  const res = await fetch(KAUFLAND_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`Kaufland listing fetch failed: ${res.status}`);

  const $ = cheerio.load(await res.text());
  const flyers = [];

  $('a.m-flyer-tile__link').each((_, el) => {
    const href = $(el).attr('href') || '';
    const dateText = $(el).find('.m-flyer-tile__validity-date').text().trim();
    const name = $(el).find('.m-flyer-tile__name').text().trim();

    // Extract identifier and region from: leaflets.kaufland.com/bg-BG/{ID}/ar/{REGION}
    const match = href.match(/\/bg-BG\/([^/]+)\/ar\/(\d+)/);
    if (match) {
      flyers.push({
        source: 'kaufland',
        identifier: match[1],
        regionId: match[2],
        name: name || 'Kaufland',
        title: dateText,
        url: href,
      });
    }
  });

  console.log(`[scraper] Kaufland: ${flyers.length} flyers — ${flyers.map(f => f.identifier).join(', ')}`);
  return flyers;
}

/**
 * Call the leaflets API to get all pages for a flyer, with keywords and links.
 */
async function fetchFlyerPages(identifier, regionId = '0') {
  const url = `${FLYER_API}?flyer_identifier=${encodeURIComponent(identifier)}&region_id=${encodeURIComponent(regionId)}`;
  console.log(`[scraper] Fetching flyer API: ${identifier}`);

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Flyer API error for ${identifier}: ${res.status}`);
  }

  const data = await res.json();

  if (!data.success || !data.flyer) {
    throw new Error(`Flyer API returned no data for ${identifier}`);
  }

  return data.flyer;
}

/**
 * Check if a page contains Parkside content by searching keywords and links.
 */
function isParksidePage(page) {
  // Check keywords
  if (page.keyWords && PARKSIDE_PATTERN.test(page.keyWords)) {
    return 'keyword';
  }

  // Check links for parkside brand URLs
  if (page.links && page.links.length > 0) {
    for (const link of page.links) {
      if (link.url && PARKSIDE_PATTERN.test(link.url)) {
        return 'link';
      }
    }
  }

  return null;
}

/**
 * Main scrape function — fetches all brochures from Lidl + Kaufland and finds Parkside pages.
 */
export async function scrape() {
  console.log('[scraper] Starting scrape...');
  const startTime = Date.now();

  try {
    // Fetch from both sources in parallel
    const failedSources = [];
    const [lidlFlyers, kauflandFlyers] = await Promise.all([
      fetchLidlFlyers().catch(err => {
        console.error('[scraper] Lidl fetch failed:', err.message);
        failedSources.push('lidl');
        return [];
      }),
      fetchKauflandFlyers().catch(err => {
        console.error('[scraper] Kaufland fetch failed:', err.message);
        failedSources.push('kaufland');
        return [];
      }),
    ]);

    const allFlyers = [...lidlFlyers, ...kauflandFlyers];
    let totalParksidePages = 0;

    for (const flyer of allFlyers) {
      try {
        const flyerData = await fetchFlyerPages(flyer.identifier, flyer.regionId);
        const offerStart = flyerData.offerStartDate || '';
        const offerEnd = flyerData.offerEndDate || '';
        const period = offerStart && offerEnd
          ? `${formatDate(offerStart)} - ${formatDate(offerEnd)}`
          : flyerData.title || flyer.title;
        const dateRange = `${flyerData.name || flyer.name} - ${period}`;
        const totalPages = flyerData.pages ? flyerData.pages.length : 0;

        const brochureId = upsertBrochure({
          title: period,
          dateRange,
          url: flyer.url,
          source: flyer.source,
          totalPages,
        });

        // Clear old pages for this brochure and re-scan
        clearBrochurePages(brochureId);

        let parksideCount = 0;

        for (const page of flyerData.pages || []) {
          const detectedBy = isParksidePage(page);
          if (detectedBy) {
            insertParksidePage({
              brochureId,
              pageNumber: page.number,
              imageUrl: page.image || page.zoom || page.thumbnail,
              detectedBy,
            });
            parksideCount++;
            console.log(`[scraper]   ✓ Page ${page.number} — Parkside detected (${detectedBy})`);
          }
        }

        console.log(`[scraper] ${flyer.source}/${flyer.identifier}: ${parksideCount}/${totalPages} Parkside pages`);
        totalParksidePages += parksideCount;
      } catch (err) {
        console.error(`[scraper] Error processing ${flyer.source}/${flyer.identifier}:`, err.message);
      }
    }

    // Clean up old brochures
    const maxAge = parseInt(process.env.MAX_BROCHURE_AGE_DAYS || '30', 10);
    cleanupOldBrochures(maxAge);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[scraper] Done in ${elapsed}s — ${totalParksidePages} Parkside pages from ${allFlyers.length} brochures (Lidl: ${lidlFlyers.length}, Kaufland: ${kauflandFlyers.length})`);

    return { flyersProcessed: allFlyers.length, parksidePages: totalParksidePages, failedSources };
  } catch (err) {
    console.error('[scraper] Scrape failed:', err.message);
    throw err;
  }
}
