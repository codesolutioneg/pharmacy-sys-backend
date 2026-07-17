import path from 'path';
import fs from 'fs';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { v1Router } from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Required behind reverse proxies (Vercel, nginx) so express-rate-limit
  // reads the real client IP from X-Forwarded-For instead of throwing.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(hpp());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: !config.isTest,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      // Tests exercise hundreds of endpoints against a single in-process app instance
      // within the same 15-minute window; keep the limit realistic in production while
      // giving the QA/OpenAPI-coverage suites enough headroom to avoid flaky 429s.
      max: config.isTest ? 5000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: config.appName,
        timestamp: new Date().toISOString(),
      },
    });
  });

  const openApiCandidates = [
    path.join(process.cwd(), 'openapi', 'openapi.yaml'),
    path.join(__dirname, '..', 'openapi', 'openapi.yaml'),
  ];
  const openApiPath = openApiCandidates.find((p) => fs.existsSync(p));
  if (openApiPath) {
    const document = YAML.parse(fs.readFileSync(openApiPath, 'utf8')) as object;
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document));
    app.get('/api/docs.json', (_req, res) => {
      res.json(document);
    });
  }

  app.use('/api/v1', v1Router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
