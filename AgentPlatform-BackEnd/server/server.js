import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import agentRoutes from './routes/agentRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import toolRoutes from './routes/toolRoutes.js';
import { HttpError, ok } from './utils/status.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => ok(res, { status: 'ok', mode: 'mock' }));
  app.use('/api/agents', agentRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/tools', toolRoutes);

  app.use((req, _res, next) => {
    next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
  });

  // Four parameters are required for Express to treat this as an error handler.
  app.use((err, _req, res, _next) => {
    const parserType =
      typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
        ? err.type
        : null;
    const isMalformedJson = parserType === 'entity.parse.failed';
    const isOversizedBody = parserType === 'entity.too.large';
    const status = err instanceof HttpError ? err.status : isMalformedJson ? 400 : isOversizedBody ? 413 : 500;
    const code = err instanceof HttpError
      ? err.code
      : isMalformedJson
        ? 'bad_request'
        : isOversizedBody
          ? 'payload_too_large'
          : 'internal_error';
    const message = err instanceof HttpError
      ? err.message
      : isMalformedJson
        ? 'Malformed JSON body.'
        : isOversizedBody
          ? 'Request body is too large.'
          : 'Something went wrong on the server.';
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
