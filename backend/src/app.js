import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import { dbState } from './config/db.js';
import routes from './routes/index.js';
import { register, metricsMiddleware } from './metrics/metrics.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(
  cors({
    // In Docker the frontend proxies /api through nginx (same origin), so CORS only matters for local dev.
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:8080', 'http://localhost'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(metricsMiddleware);

// Liveness/readiness probe used by Docker healthcheck, CI smoke test and Prometheus blackbox-style checks.
app.get('/api/health', (_req, res) => {
  const db = dbState();
  res.status(db === 'connected' ? 200 : 503).json({
    success: db === 'connected',
    status: db === 'connected' ? 'UP' : 'DEGRADED',
    database: db,
    uptimeSeconds: Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Prometheus scrape endpoint.
app.get('/api/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
