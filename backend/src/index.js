import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import brochureRoutes, { clearCache } from './routes/brochures.js';
import { getDb } from './db.js';
import { scrape } from './scraper.js';
import { startKeepAlive } from './keep-alive.js';

const app = express();
const PORT = process.env.PORT;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/+$/, ''))
  : ['http://localhost:8081', 'http://localhost:19006'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[cors] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(express.json());
app.use('/api', brochureRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize DB
getDb();

// Schedule cron job
const RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

async function scrapeWithRetry(label) {
  try {
    console.log(`[${label}] Running scrape...`);
    const result = await scrape();
    clearCache();
    console.log(`[${label}] Scrape complete:`, result);

    if (result.failedSources && result.failedSources.length > 0) {
      console.log(`[${label}] Sources failed: ${result.failedSources.join(', ')} — retrying in 30 min`);
      setTimeout(() => scrapeWithRetry(`${label}-retry`), RETRY_DELAY_MS);
    }
  } catch (err) {
    console.error(`[${label}] Scrape failed:`, err.message, '— retrying in 30 min');
    setTimeout(() => scrapeWithRetry(`${label}-retry`), RETRY_DELAY_MS);
  }
}

cron.schedule(CRON_SCHEDULE, () => {
  scrapeWithRetry('cron');
});

// Keep-alive
startKeepAlive();

// Run initial scrape on startup
scrapeWithRetry('startup');

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Cron schedule: ${CRON_SCHEDULE}`);
});
