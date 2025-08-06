import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
    info: jest.fn().mockResolvedValue('test-info'),
    status: 'ready',
  }));
});

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    assignment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    submission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    feedback: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $disconnect: jest.fn(),
    $connect: jest.fn(),
  })),
}));

// Mock AI Services
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');

// Mock Axios for external API calls
jest.mock('axios');

// Global test timeout
jest.setTimeout(30000);