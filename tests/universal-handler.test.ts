import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { universalHandler, fromApiGateway, fromDirectLambda } from '../src/universal-handler';
import { createLambdaContext } from './test-utils/lambda-events';
import { ReplicateMock } from './test-utils/replicate-mock';

describe('Universal Handler', () => {
  let replicateMock: ReplicateMock;

  beforeEach(() => {
    replicateMock = new ReplicateMock();
  });

  afterEach(() => {
    replicateMock.restore();
  });

  describe('fromApiGateway', () => {
    test('converts API Gateway event to universal format', () => {
      const apiGatewayEvent = {
        httpMethod: 'POST',
        path: '/api/replicate',
        headers: {
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        body: '{"model":"owner/model","apiKey":"test12345678"}',
        queryStringParameters: { test: 'value' }
      };

      const universal = fromApiGateway(apiGatewayEvent);

      expect(universal.httpMethod).toBe('POST');
      expect(universal.path).toBe('/api/replicate');
      expect(universal.headers).toEqual({
        'content-type': 'application/json',
        'origin': 'https://example.com'
      });
      expect(universal.body).toBe('{"model":"owner/model","apiKey":"test12345678"}');
      expect(universal.queryStringParameters).toEqual({ test: 'value' });
    });
  });

  describe('fromDirectLambda', () => {
    test('converts direct lambda event to universal format', () => {
      const directEvent = {
        method: 'POST',
        uri: '/api/replicate',
        headers: {
          'content-type': 'application/json',
          'origin': 'https://example.com'
        },
        body: '{"model":"owner/model","apiKey":"test12345678"}',
        query: { test: 'value' }
      };

      const universal = fromDirectLambda(directEvent);

      expect(universal.httpMethod).toBe('POST');
      expect(universal.path).toBe('/api/replicate');
      expect(universal.headers).toEqual({
        'content-type': 'application/json',
        'origin': 'https://example.com'
      });
      expect(universal.body).toBe('{"model":"owner/model","apiKey":"test12345678"}');
      expect(universal.queryStringParameters).toEqual({ test: 'value' });
    });

    test('handles Lambda@Edge format', () => {
      const lambdaEdgeEvent = {
        Records: [{
          cf: {
            request: {
              method: 'POST',
              uri: '/api/replicate',
              headers: {
                'content-type': [{ value: 'application/json' }],
                'origin': [{ value: 'https://example.com' }]
              },
              body: {
                data: Buffer.from('{"model":"owner/model","apiKey":"test12345678"}').toString('base64')
              },
              querystring: 'test=value'
            }
          }
        }]
      };

      const universal = fromDirectLambda(lambdaEdgeEvent);

      expect(universal.httpMethod).toBe('POST');
      expect(universal.path).toBe('/api/replicate');
      expect(universal.headers).toEqual({
        'content-type': 'application/json',
        'origin': 'https://example.com'
      });
      expect(universal.body).toBe('{"model":"owner/model","apiKey":"test12345678"}');
      expect(universal.queryStringParameters).toEqual({ test: 'value' });
    });

    test('handles minimal direct event', () => {
      const minimalEvent = {
        httpMethod: 'GET',
        path: '/health'
      };

      const universal = fromDirectLambda(minimalEvent);

      expect(universal.httpMethod).toBe('GET');
      expect(universal.path).toBe('/health');
      expect(universal.headers).toEqual({});
      expect(universal.body).toBe(null);
      expect(universal.queryStringParameters).toBe(null);
    });

    test('handles event with object body', () => {
      const eventWithObjectBody = {
        httpMethod: 'POST',
        path: '/api/replicate',
        body: { model: 'owner/model', apiKey: 'test12345678' }
      };

      const universal = fromDirectLambda(eventWithObjectBody);

      expect(universal.httpMethod).toBe('POST');
      expect(universal.body).toBe('{"model":"owner/model","apiKey":"test12345678"}');
    });
  });

  describe('universalHandler', () => {
    test('handles health check request', async () => {
      const request = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        body: null
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.message).toBe('Replicate proxy server is running');
      expect(body.timestamp).toBeDefined();
      expect(body.requestId).toBeDefined();
    });

    test('handles API instructions request', async () => {
      const request = {
        httpMethod: 'GET',
        path: '/api/replicate',
        headers: {},
        body: null
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Replicate API Proxy');
      expect(body.instructions).toBeDefined();
    });

    test('handles CORS preflight request', async () => {
      const request = {
        httpMethod: 'OPTIONS',
        path: '/api/replicate',
        headers: { 'Origin': 'https://example.com' },
        body: null
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    });

    test('handles valid Replicate request', async () => {
      const mockOutput = ['https://replicate.delivery/pbxt/test.png'];
      replicateMock.queueSuccessResponse(mockOutput);

      const request = {
        httpMethod: 'POST',
        path: '/api/replicate',
        headers: {},
        body: JSON.stringify({
          model: 'owner/model',
          input: { prompt: 'test' },
          apiKey: 'test12345678'
        })
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockOutput);
    });

    test('handles validation errors', async () => {
      const request = {
        httpMethod: 'POST',
        path: '/api/replicate',
        headers: {},
        body: JSON.stringify({
          model: 'invalid',
          apiKey: 'short'
        })
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Model name is required');
    });

    test('handles oversized requests', async () => {
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const request = {
        httpMethod: 'POST',
        path: '/api/replicate',
        headers: {},
        body: JSON.stringify({
          model: 'owner/model',
          input: { largeData },
          apiKey: 'test12345678'
        })
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Request body too large');
    });

    test('handles unknown routes', async () => {
      const request = {
        httpMethod: 'GET',
        path: '/unknown',
        headers: {},
        body: null
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Route GET:/unknown not found');
    });
  });

  describe('Edge Cases and Coverage', () => {
    test('handles Lambda@Edge with no body data', () => {
      const lambdaEdgeEvent = {
        Records: [{
          cf: {
            request: {
              method: 'GET',
              uri: '/health',
              headers: {},
              querystring: 'test=value'
            }
          }
        }]
      };

      const universal = fromDirectLambda(lambdaEdgeEvent);

      expect(universal.httpMethod).toBe('GET');
      expect(universal.path).toBe('/health');
      expect(universal.body).toBe(null);
    });

    test('handles direct lambda with minimal data', () => {
      const minimalEvent = {};

      const universal = fromDirectLambda(minimalEvent);

      expect(universal.httpMethod).toBe('GET');
      expect(universal.path).toBe('/');
      expect(universal.headers).toEqual({});
      expect(universal.queryStringParameters).toBe(null);
    });

    test('handles restricted CORS origins', async () => {
      const originalEnv = process.env.CORS_ALLOWED_ORIGINS;
      process.env.CORS_ALLOWED_ORIGINS = 'https://app1.com,https://app2.com';
      
      try {
        const request = {
          httpMethod: 'GET',
          path: '/health',
          headers: { 'Origin': 'https://evil.com' },
          body: null
        };
        const context = createLambdaContext();

        const response = await universalHandler(request, context);

        expect(response.statusCode).toBe(200);
        expect(response.headers['Access-Control-Allow-Origin']).toBe('https://app1.com');
      } finally {
        if (originalEnv) {
          process.env.CORS_ALLOWED_ORIGINS = originalEnv;
        } else {
          delete process.env.CORS_ALLOWED_ORIGINS;
        }
      }
    });

    test('handles JSON parsing errors', async () => {
      const request = {
        httpMethod: 'POST',
        path: '/api/replicate',
        headers: {},
        body: 'invalid json{'
      };
      const context = createLambdaContext();

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid JSON in request body');
    });

    test('handles unexpected handler errors', async () => {
      const request = {
        httpMethod: 'POST',
        path: '/api/replicate',
        headers: {},
        body: JSON.stringify({
          model: 'owner/model',
          input: { prompt: 'test' },
          apiKey: 'test12345678'
        })
      };
      const context = {
        awsRequestId: null  // This will cause an error
      } as any;

      const response = await universalHandler(request, context);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });
  });
});