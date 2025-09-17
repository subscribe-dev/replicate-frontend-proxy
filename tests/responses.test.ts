import { describe, test, expect } from 'bun:test';
import { 
  ok, 
  badRequest, 
  unauthorized, 
  notFound, 
  internalServerError, 
  corsPreflightResponse, 
  customError,
  createResponse 
} from '../src/responses';

describe('Response Helpers', () => {
  test('createResponse creates proper response structure', () => {
    const response = createResponse(200, { message: 'test' });
    
    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(response.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    expect(response.headers?.['Content-Type']).toBe('application/json');
    expect(response.body).toBe('{"message":"test"}');
  });

  test('createResponse handles string body', () => {
    const response = createResponse(200, 'plain text');
    
    expect(response.body).toBe('plain text');
  });

  test('createResponse merges additional headers', () => {
    const response = createResponse(200, { test: true }, { 'X-Custom': 'header' });
    
    expect(response.headers?.['X-Custom']).toBe('header');
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
  });

  test('ok creates 200 response', () => {
    const data = { success: true };
    const response = ok(data);
    
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(data);
  });

  test('badRequest creates 400 response with error only', () => {
    const response = badRequest('Invalid input');
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid input');
    expect(body.details).toBeUndefined();
  });

  test('badRequest creates 400 response with details', () => {
    const response = badRequest('Invalid input', 'Field "name" is required');
    
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid input');
    expect(body.details).toBe('Field "name" is required');
  });

  test('unauthorized creates 401 response with default message', () => {
    const response = unauthorized();
    
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('API key is required');
  });

  test('unauthorized creates 401 response with custom message', () => {
    const response = unauthorized('Invalid credentials');
    
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid credentials');
  });

  test('notFound creates 404 response', () => {
    const response = notFound('Route not found');
    
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Route not found');
    expect(body.error).toBe('Not Found');
    expect(body.statusCode).toBe(404);
  });

  test('internalServerError creates 500 response with error only', () => {
    const response = internalServerError('Server error');
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Server error');
    expect(body.details).toBeUndefined();
    expect(body.stack).toBeUndefined();
  });

  test('internalServerError creates 500 response with details', () => {
    const response = internalServerError('Server error', 'Database connection failed');
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Server error');
    expect(body.details).toBe('Database connection failed');
    expect(body.stack).toBeUndefined();
  });

  test('internalServerError creates 500 response with stack trace', () => {
    const stackTrace = 'Error: Test error\n    at test (/path/to/file.js:10:5)';
    const response = internalServerError('Server error', 'Database connection failed', stackTrace);
    
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Server error');
    expect(body.details).toBe('Database connection failed');
    expect(body.stack).toBe(stackTrace);
  });

  test('corsPreflightResponse creates 200 response with empty body', () => {
    const response = corsPreflightResponse();
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(response.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
  });

  test('customError creates response with custom status code', () => {
    const response = customError(422, 'Unprocessable Entity');
    
    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unprocessable Entity');
    expect(body.details).toBeUndefined();
  });

  test('customError creates response with custom status code and details', () => {
    const response = customError(429, 'Too Many Requests', 'Rate limit exceeded');
    
    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Too Many Requests');
    expect(body.details).toBe('Rate limit exceeded');
  });

  test('createResponse handles restricted CORS origins', () => {
    // Set up environment with restricted CORS origins
    const originalEnv = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS = 'https://app1.com,https://app2.com';
    
    try {
      // Test with allowed origin
      const response1 = createResponse(200, { test: true }, {}, 'https://app1.com');
      expect(response1.headers?.['Access-Control-Allow-Origin']).toBe('https://app1.com');
      
      // Test with disallowed origin - should fall back to first allowed origin
      const response2 = createResponse(200, { test: true }, {}, 'https://evil.com');
      expect(response2.headers?.['Access-Control-Allow-Origin']).toBe('https://app1.com');
      
      // Test with no origin - should default to wildcard
      const response3 = createResponse(200, { test: true });
      expect(response3.headers?.['Access-Control-Allow-Origin']).toBe('*');
    } finally {
      // Restore original environment
      if (originalEnv) {
        process.env.CORS_ALLOWED_ORIGINS = originalEnv;
      } else {
        delete process.env.CORS_ALLOWED_ORIGINS;
      }
    }
  });
});