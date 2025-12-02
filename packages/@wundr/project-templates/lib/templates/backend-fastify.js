"use strict";
/**
 * Backend API Template - Fastify with Prisma
 * High-performance API with OpenAPI documentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendFastifyTemplate = void 0;
exports.backendFastifyTemplate = {
    name: 'backend-fastify',
    type: 'backend',
    framework: 'fastify',
    displayName: 'Fastify Backend API',
    description: 'High-performance Fastify API with Prisma, OpenAPI, and TypeScript',
    dependencies: {
        fastify: '^4.26.1',
        '@fastify/cors': '^9.0.1',
        '@fastify/helmet': '^11.1.1',
        '@fastify/rate-limit': '^9.1.0',
        '@fastify/swagger': '^8.14.0',
        '@fastify/swagger-ui': '^3.0.0',
        '@fastify/jwt': '^8.0.0',
        '@fastify/cookie': '^9.3.1',
        '@fastify/env': '^4.3.0',
        '@fastify/redis': '^6.2.0',
        '@prisma/client': '^5.11.0',
        bcrypt: '^5.1.1',
        bullmq: '^5.4.2',
        winston: '^3.11.0',
        'winston-daily-rotate-file': '^5.0.0',
        zod: '^3.22.4',
        dotenv: '^16.4.5',
    },
    devDependencies: {
        '@types/node': '^20.11.24',
        '@types/bcrypt': '^5.0.2',
        typescript: '^5.3.3',
        tsx: '^4.7.1',
        nodemon: '^3.1.0',
        eslint: '^8.57.0',
        '@typescript-eslint/eslint-plugin': '^7.1.0',
        '@typescript-eslint/parser': '^7.1.0',
        prettier: '^3.2.5',
        prisma: '^5.11.0',
        jest: '^29.7.0',
        '@types/jest': '^29.5.12',
        'ts-jest': '^29.1.2',
        supertest: '^6.3.4',
        '@types/supertest': '^6.0.2',
        husky: '^9.0.11',
        'lint-staged': '^15.2.2',
        '@commitlint/cli': '^19.0.3',
        '@commitlint/config-conventional': '^19.0.3',
    },
    scripts: {
        dev: 'tsx watch src/server.ts',
        build: 'tsc',
        start: 'node dist/server.js',
        lint: 'eslint src --ext .ts',
        typecheck: 'tsc --noEmit',
        format: 'prettier --write "src/**/*.ts"',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:migrate': 'prisma migrate dev',
        'db:seed': 'tsx src/db/seed.ts',
        analyze: 'wundr analyze',
        govern: 'wundr govern check',
        prepare: 'husky install',
    },
    files: [
        {
            path: 'src/server.ts',
            content: `import { buildApp } from './app';
import { logger } from './utils/logger';
import { config } from './config';

const start = async () => {
  try {
    const app = await buildApp();

    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });

    logger.info(\`Server listening on \${config.HOST}:\${config.PORT}\`);
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();`,
        },
        {
            path: 'src/app.ts',
            content: `import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import { config } from './config';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { errorHandler } from './plugins/error-handler';
import { prismaPlugin } from './plugins/prisma';
import { redisPlugin } from './plugins/redis';
import { logger } from './utils/logger';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // Register plugins
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  await app.register(cookie);

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: '{{projectName}} API',
        description: '{{description}}',
        version: '1.0.0',
      },
      servers: [
        {
          url: \`http://localhost:\${config.PORT}\`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Database and cache
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Error handling
  app.setErrorHandler(errorHandler);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(\`Received \${signal}, shutting down gracefully\`);
      await app.close();
      process.exit(0);
    });
  });

  return app;
}`,
            template: true,
        },
        {
            path: 'src/config/index.ts',
            content: `import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string(),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export const config = configSchema.parse(process.env);`,
        },
        {
            path: 'src/routes/health.ts',
            content: `import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };
  });

  fastify.get('/ready', {
    schema: {
      description: 'Readiness check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            database: { type: 'boolean' },
            redis: { type: 'boolean' },
            ready: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Check database connection
      await fastify.prisma.$queryRaw\`SELECT 1\`;
      const dbReady = true;

      // Check Redis connection
      let redisReady = false;
      if (fastify.redis) {
        await fastify.redis.ping();
        redisReady = true;
      }

      return {
        database: dbReady,
        redis: redisReady,
        ready: dbReady,
      };
    } catch (error) {
      reply.code(503);
      return {
        database: false,
        redis: false,
        ready: false,
      };
    }
  });
};`,
        },
        {
            path: 'src/plugins/prisma.ts',
            content: `import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  await prisma.$connect();
  logger.info('Database connected');

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (fastify) => {
    await fastify.prisma.$disconnect();
    logger.info('Database disconnected');
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
});`,
        },
        {
            path: 'src/utils/logger.ts',
            content: `import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
];

if (config.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  );
}

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports,
});`,
        },
        {
            path: 'prisma/schema.prisma',
            content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  USER
  ADMIN
}
`,
        },
        {
            path: '.env.example',
            content: `NODE_ENV=development
PORT=3000
HOST=0.0.0.0

DATABASE_URL=postgresql://user:password@localhost:5432/{{projectNameKebab}}
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=http://localhost:3001

LOG_LEVEL=info`,
            template: true,
        },
        {
            path: 'Dockerfile',
            content: `FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build
RUN npx prisma generate

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "dist/server.js"]`,
        },
    ],
    postInstall: [
        'npx husky install',
        'npx husky add .husky/pre-commit "npm run lint && npm run typecheck"',
        'npx husky add .husky/commit-msg "npx --no -- commitlint --edit $1"',
        'cp .env.example .env',
    ],
};
//# sourceMappingURL=backend-fastify.js.map