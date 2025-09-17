import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getConfig, CONSTANTS } from './config';

describe('Configuration', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    test('returns default configuration', () => {
      delete process.env.NODE_ENV;
      delete process.env.MAX_REQUEST_SIZE;
      delete process.env.REPLICATE_TIMEOUT;
      delete process.env.CORS_ALLOWED_ORIGINS;
      delete process.env.LOG_LEVEL;
      delete process.env.ENABLE_STACK_TRACES;

      const config = getConfig();

      expect(config.maxRequestSize).toBe(1048576); // 1MB
      expect(config.replicateTimeout).toBe(300000); // 5 minutes
      expect(config.corsAllowedOrigins).toEqual(['*']);
      expect(config.logLevel).toBe('debug'); // non-production default
      expect(config.enableStackTraces).toBe(true); // non-production default
    });

    test('uses production defaults', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_STACK_TRACES;
      delete process.env.LOG_LEVEL;

      const config = getConfig();

      expect(config.logLevel).toBe('warn');
      expect(config.enableStackTraces).toBe(false);
    });

    test('respects environment variable overrides', () => {
      process.env.MAX_REQUEST_SIZE = '2097152'; // 2MB
      process.env.REPLICATE_TIMEOUT = '600000'; // 10 minutes
      process.env.CORS_ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
      process.env.LOG_LEVEL = 'error';
      process.env.ENABLE_STACK_TRACES = 'true';

      const config = getConfig();

      expect(config.maxRequestSize).toBe(2097152);
      expect(config.replicateTimeout).toBe(600000);
      expect(config.corsAllowedOrigins).toEqual(['https://example.com', 'https://app.example.com']);
      expect(config.logLevel).toBe('error');
      expect(config.enableStackTraces).toBe(true);
    });

    test('handles invalid numbers gracefully', () => {
      process.env.MAX_REQUEST_SIZE = 'invalid';
      process.env.REPLICATE_TIMEOUT = 'also-invalid';

      const config = getConfig();

      expect(config.maxRequestSize).toBeNaN();
      expect(config.replicateTimeout).toBeNaN();
    });

    test('handles empty CORS origins', () => {
      process.env.CORS_ALLOWED_ORIGINS = '';

      const config = getConfig();

      expect(config.corsAllowedOrigins).toEqual(['']);
    });

    test('handles ENABLE_STACK_TRACES as string false', () => {
      process.env.ENABLE_STACK_TRACES = 'false';

      const config = getConfig();

      expect(config.enableStackTraces).toBe(false);
    });
  });

  describe('CONSTANTS', () => {
    test('has expected constant values', () => {
      expect(CONSTANTS.REQUEST_TIMEOUT).toBe(300000);
      expect(CONSTANTS.MAX_MODEL_NAME_LENGTH).toBe(100);
      expect(CONSTANTS.MIN_API_KEY_LENGTH).toBe(8);
      expect(CONSTANTS.MAX_API_KEY_LENGTH).toBe(200);
      expect(CONSTANTS.SUPPORTED_HTTP_METHODS).toEqual(['GET', 'POST', 'OPTIONS']);
    });

    test('constants exist and have correct types', () => {
      expect(typeof CONSTANTS.REQUEST_TIMEOUT).toBe('number');
      expect(typeof CONSTANTS.MAX_MODEL_NAME_LENGTH).toBe('number');
      expect(typeof CONSTANTS.MIN_API_KEY_LENGTH).toBe('number');
      expect(typeof CONSTANTS.MAX_API_KEY_LENGTH).toBe('number');
      expect(Array.isArray(CONSTANTS.SUPPORTED_HTTP_METHODS)).toBe(true);
    });
  });
});