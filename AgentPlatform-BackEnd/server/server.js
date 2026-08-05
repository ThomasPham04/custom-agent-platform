import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import agentRoutes from './routes/agentRoutes.js';
import toolRoutes from './routes/toolRoutes.js';
import { HttpError, ok } from './utils/status.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => ok(res, { status: 'ok', mode: 'mock' }));
  app.use('/api/agents', agentRoutes);
  app.use('/api/tools', toolRoutes);

  app.use((req, _res, next) => {
    next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
  });

  // Four parameters are required for Express to treat this as an error handler.
  app.use((err, _req, res, _next) => {
    const status = err instanceof HttpError ? err.status : 500;
    const code = err instanceof HttpError ? err.code : 'internal_error';
    const message = status === 500 ? 'Something went wrong on the server.' : err.message;
    if (status === 500) console.error(err);
    res.status(status).json({ error: { code, message } });
  });

  return app;
};

const isEntryModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryModule) {
  const port = Number(process.env.PORT ?? 4000);
  createApp().listen(port, () =>
    console.log(`agent platform api listening on :${port} (mock mode)`),
  );
}
