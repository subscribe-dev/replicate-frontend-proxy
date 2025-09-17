import { describe, test, expect } from 'bun:test';
import { withTimeout, sanitizeForLogs, generateCorrelationId, isValidJsonSize } from '../src/utils';

describe('Utility Functions', () => {
  describe('withTimeout', () => {
    test('resolves when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    test('rejects when timeout is exceeded', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        await withTimeout(promise, 100, 'Custom timeout message');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Custom timeout message');
      }
    });

    test('uses default timeout message', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        await withTimeout(promise, 100);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Operation timed out');
      }
    });
  });

  describe('sanitizeForLogs', () => {
    test('returns string as-is if under max length', () => {
      const input = 'short string';
      expect(sanitizeForLogs(input, 100)).toBe(input);
    });

    test('truncates long strings', () => {
      const longString = 'a'.repeat(200);
      const result = sanitizeForLogs(longString, 100);
      expect(result).toBe('a'.repeat(100) + '...');
    });

    test('serializes objects to JSON', () => {
      const obj = { key: 'value', number: 42 };
      const result = sanitizeForLogs(obj);
      expect(result).toBe('{"key":"value","number":42}');
    });

    test('truncates long JSON strings', () => {
      const largeObj = { data: 'a'.repeat(200) };
      const result = sanitizeForLogs(largeObj, 50);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    test('handles circular references gracefully', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference
      
      const result = sanitizeForLogs(obj);
      expect(result).toBe('[Object - could not serialize]');
    });

    test('converts non-string primitives to string', () => {
      expect(sanitizeForLogs(123)).toBe('123');
      expect(sanitizeForLogs(true)).toBe('true');
      expect(sanitizeForLogs(null)).toBe('null');
    });
  });

  describe('generateCorrelationId', () => {
    test('generates unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });

    test('generates alphanumeric IDs', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('isValidJsonSize', () => {
    test('accepts small JSON strings', () => {
      const smallJson = JSON.stringify({ key: 'value' });
      expect(isValidJsonSize(smallJson, 1000)).toBe(true);
    });

    test('rejects large JSON strings', () => {
      const largeJson = JSON.stringify({ data: 'a'.repeat(2000) });
      expect(isValidJsonSize(largeJson, 1000)).toBe(false);
    });

    test('handles empty strings', () => {
      expect(isValidJsonSize('', 100)).toBe(true);
    });

    test('handles unicode characters correctly', () => {
      const unicodeString = '{"emoji": "🚀🌟💫"}';
      const size = Buffer.byteLength(unicodeString, 'utf8');
      
      expect(isValidJsonSize(unicodeString, size)).toBe(true);
      expect(isValidJsonSize(unicodeString, size - 1)).toBe(false);
    });
  });
});