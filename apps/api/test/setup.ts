import { PrismaClient } from '@finnit/database';

// Mock external services
jest.mock('nodemailer');
jest.mock('aws-sdk');
jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
    verify: jest.fn(),
  })),
  JwtModule: {
    register: jest.fn().mockReturnValue({
      module: class MockJwtModule {},
      providers: [],
      exports: [],
    }),
  },
}));

// Global test configuration
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/finnit_test';
process.env.JWT_SECRET = 'test-secret-key';

// Global timeout for all tests
jest.setTimeout(30000);