import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import brochureRoutes from './routes/brochures.js';
import { getDb } from './db.js';
import { scrape } from './scraper.js';

const app = express();
const PORT = process.env.PORT;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE;

app.use(cors());
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
  } catch (err) {
    console.error('[cron] Scrape failed:', err.message);
  }
});

// Run initial scrape on startup
console.log('[startup] Running initial scrape...');
scrape()
  .then((result) => console.log('[startup] Initial scrape complete:', result))
  .catch((err) => console.error('[startup] Initial scrape failed:', err.message));

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Cron schedule: ${CRON_SCHEDULE}`);
});
