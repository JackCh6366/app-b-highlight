import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import parseDocHandler from './api/parse-doc';
import parsePdfHandler from './api/parse-pdf';
import summarizeHandler from './api/summarize';
import summarizeLongHandler from './api/summarize-long';
import chatHandler from './api/chat';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API endpoints delegating to Vercel Serverless handlers for local dev
app.post('/api/parse-doc', (req, res) => parseDocHandler(req as any, res as any));
app.post('/api/parse-pdf', (req, res) => parsePdfHandler(req as any, res as any));
app.post('/api/summarize', (req, res) => summarizeHandler(req as any, res as any));
app.post('/api/summarize-long', (req, res) => summarizeLongHandler(req as any, res as any));
app.post('/api/chat', (req, res) => chatHandler(req as any, res as any));

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DocMind Local Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
