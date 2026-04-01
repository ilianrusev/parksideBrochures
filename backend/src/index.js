import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import brochureRoutes, { clearCache, setInitialScrapeReady } from './routes/brochures.js';
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
cron.schedule(CRON_SCHEDULE, async () => {
  console.log(`[cron] Scheduled scrape triggered at ${new Date().toISOString()}`);
  try {
    await scrape();
    clearCache();
  } catch (err) {
    console.error('[cron] Scrape failed:', err.message);
  }
});

// Keep-alive
startKeepAlive();

// Run initial scrape on startup
console.log('[startup] Running initial scrape...');
const initialScrape = scrape()
  .then((result) => {
    clearCache();
    console.log('[startup] Initial scrape complete:', result);
  })
  .catch((err) => console.error('[startup] Initial scrape failed:', err.message));
setInitialScrapeReady(initialScrape);

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Cron schedule: ${CRON_SCHEDULE}`);
});
