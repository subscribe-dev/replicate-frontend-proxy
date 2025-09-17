import { describe, test, expect } from 'bun:test';
import { 
  isValidApiKey, 
  isValidModelName, 
  validateReplicateRequest 
} from '../src/types';

describe('Type Validation Functions', () => {
  describe('isValidApiKey', () => {
    test('accepts valid API keys', () => {
      expect(isValidApiKey('r8_test1234567890abcdef')).toBe(true);
      expect(isValidApiKey('12345678')).toBe(true);
      expect(isValidApiKey('a'.repeat(50))).toBe(true);
    });

    test('rejects invalid API keys', () => {
      expect(isValidApiKey('')).toBe(false);
      expect(isValidApiKey('1234567')).toBe(false); // too short
      expect(isValidApiKey(' test1234567890 ')).toBe(false); // whitespace
      expect(isValidApiKey('a'.repeat(201))).toBe(false); // too long
      expect(isValidApiKey('123' as any)).toBe(false); // not string
    });
  });

  describe('isValidModelName', () => {
    test('accepts valid model names', () => {
      expect(isValidModelName('owner/model')).toBe(true);
      expect(isValidModelName('black-forest-labs/flux-schnell')).toBe(true);
      expect(isValidModelName('user123/model_name-v2')).toBe(true);
    });

    test('rejects invalid model names', () => {
      expect(isValidModelName('')).toBe(false);
      expect(isValidModelName('model')).toBe(false); // no slash
      expect(isValidModelName('/model')).toBe(false); // starts with slash
      expect(isValidModelName('owner/')).toBe(false); // ends with slash
      expect(isValidModelName('owner/model/')).toBe(false); // ends with slash
      expect(isValidModelName('owner/-model')).toBe(false); // starts with dash
      expect(isValidModelName('owner/model-')).toBe(true); // dashes are allowed at end
      expect(isValidModelName('a'.repeat(101))).toBe(false); // too long
    });
  });

  describe('validateReplicateRequest', () => {
    test('accepts valid requests', () => {
      const valid = {
        model: 'owner/model',
        input: { prompt: 'test' },
        apiKey: 'test12345678'
      };
      
      const result = validateReplicateRequest(valid);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('accepts requests without input', () => {
      const valid = {
        model: 'owner/model',
        apiKey: 'test12345678'
      };
      
      const result = validateReplicateRequest(valid);
      expect(result.isValid).toBe(true);
    });

    test('rejects non-object bodies', () => {
      expect(validateReplicateRequest(null).isValid).toBe(false);
      expect(validateReplicateRequest('string').isValid).toBe(false);
      expect(validateReplicateRequest(123).isValid).toBe(false);
    });

    test('returns specific error for non-object bodies', () => {
      const result = validateReplicateRequest(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request body must be a valid JSON object');
    });

    test('rejects invalid model names', () => {
      const invalid = {
        model: 'invalid',
        apiKey: 'test12345678'
      };
      
      const result = validateReplicateRequest(invalid);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('owner/model');
    });

    test('rejects invalid API keys', () => {
      const invalid = {
        model: 'owner/model',
        apiKey: '123'
      };
      
      const result = validateReplicateRequest(invalid);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('API key');
    });

    test('rejects invalid input types', () => {
      const invalid = {
        model: 'owner/model',
        input: 'not an object',
        apiKey: 'test12345678'
      };
      
      const result = validateReplicateRequest(invalid);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Input must be an object');
    });

    test('accepts null input', () => {
      const valid = {
        model: 'owner/model',
        input: null,
        apiKey: 'test12345678'
      };
      
      const result = validateReplicateRequest(valid);
      expect(result.isValid).toBe(false); // null input should be rejected
      expect(result.error).toContain('Input must be an object');
    });
  });
});