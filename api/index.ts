/**
 * Vercel serverless entry point.
 * Wraps the Express app; all routes (including /api/health and /api/docs)
 * are served through this single function via the rewrite in vercel.json.
 */
import { createApp } from '../src/app';

const app = createApp();

export default app;
