import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { handler } from './proxy';
import { ReplicateMock } from './test-utils/replicate-mock';
import { createAPIGatewayEvent, createReplicatePostEvent, createLambdaContext } from './test-utils/lambda-events';

describe('Lambda Proxy Handler', () => {
  let replicateMock: ReplicateMock;

  beforeEach(() => {
    replicateMock = new ReplicateMock();
  });

  afterEach(() => {
    replicateMock.restore();
  });

  test('ReplicateMock reset functionality', () => {
    replicateMock.queueSuccessResponse(['test result']);
    
    // Verify initial state
    expect(replicateMock.getCallCount()).toBe(0);
    
    // Reset and verify cleared state
    replicateMock.reset();
    expect(replicateMock.getCallCount()).toBe(0);
    expect(replicateMock.getLastCall()).toBeUndefined();
  });

  test('successfully proxies POST request to Replicate API', async () => {
    const mockOutput = [
      "https://replicate.delivery/pbxt/example-output.png"
    ];
    replicateMock.queueSuccessResponse(mockOutput);

    const event = createReplicatePostEvent(
      'black-forest-labs/flux-schnell',
      { 
        prompt: 'a cute cat wearing a hat',
        num_outputs: 1 
      },
      'test-api-key-123'
    );
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toEqual(mockOutput);

    expect(replicateMock.getCallCount()).toBe(1);
    const lastCall = replicateMock.getLastCall();
    expect(lastCall?.model).toBe('black-forest-labs/flux-schnell');
    expect(lastCall?.options.input).toEqual({
      prompt: 'a cute cat wearing a hat',
      num_outputs: 1
    });
  });

  test('GET /health returns health status', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.status).toBe('ok');
    expect(responseBody.message).toBe('Replicate proxy server is running');
    expect(responseBody.timestamp).toBeDefined();
    expect(responseBody.requestId).toBeDefined();
  });

  test('GET /api/replicate returns API instructions', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/api/replicate'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Replicate API Proxy');
    expect(responseBody.instructions).toMatchObject({
      method: 'POST',
      endpoint: '/api/replicate',
      body: {
        model: 'black-forest-labs/flux-schnell',
        input: '{ your model input parameters }',
        apiKey: 'your-replicate-api-key'
      }
    });
  });

  test('OPTIONS /api/replicate returns CORS headers', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'OPTIONS',
      path: '/api/replicate'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    expect(result.body).toBe('');
  });

  test('POST /api/replicate rejects invalid JSON body', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: 'invalid json{'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Invalid JSON in request body');
  });

  test('POST /api/replicate rejects request without model parameter', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        input: { prompt: 'test' },
        apiKey: 'test-key'
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Model name is required and must be in format "owner/model"');
  });

  test('POST /api/replicate rejects request without API key', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'owner/model',
        input: { prompt: 'test' }
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Valid API key is required (8-200 characters)');
  });

  test('handles Replicate API error with status code', async () => {
    replicateMock.queueErrorResponse({
      message: 'Model not found',
      status: 404,
      detail: 'The requested model does not exist'
    });

    const event = createReplicatePostEvent(
      'non-existent/model',
      { prompt: 'test' },
      'test-api-key'
    );
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(404);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Model not found');
    expect(responseBody.details).toBe('The requested model does not exist');
  });

  test('returns 404 for unmatched routes', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/unknown-route'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(404);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Route GET:/unknown-route not found');
    expect(responseBody.error).toBe('Not Found');
    expect(responseBody.statusCode).toBe(404);
  });

  test('handles unexpected Lambda handler errors', async () => {
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {
      throw new Error('Console logging failed unexpectedly');
    });

    const event = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(500);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Internal server error');
    expect(responseBody.details).toBe('Console logging failed unexpectedly');
    expect(responseBody.stack).toBeDefined();

    consoleSpy.mockRestore();
  });

  test('POST /api/replicate handles empty request body', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: ''
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Model name is required and must be in format "owner/model"');
  });

  test('POST /api/replicate handles null request body', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: null
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Model name is required and must be in format "owner/model"');
  });

  test('POST /api/replicate handles empty model string', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: '',
        input: { prompt: 'test' },
        apiKey: 'test-key'
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Model name is required and must be in format "owner/model"');
  });

  test('POST /api/replicate handles empty apiKey string', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'owner/model',
        input: { prompt: 'test' },
        apiKey: ''
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Valid API key is required (8-200 characters)');
  });

  test('PUT /api/replicate returns 404', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'PUT',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'owner/model',
        input: { prompt: 'test' },
        apiKey: 'test-key'
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(404);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Route PUT:/api/replicate not found');
    expect(responseBody.error).toBe('Not Found');
  });

  test('DELETE /health returns 404', async () => {
    const event = createAPIGatewayEvent({
      httpMethod: 'DELETE',
      path: '/health'
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(404);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.message).toBe('Route DELETE:/health not found');
  });

  test('handles Replicate API error without status code', async () => {
    replicateMock.queueErrorResponse({
      message: 'Network error'
    });

    const event = createReplicatePostEvent(
      'some/model',
      { prompt: 'test' },
      'test-api-key'
    );
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(500);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toBe('Network error');
    expect(responseBody.details).toBe('Network error');
  });

  test('POST /api/replicate with missing input parameter still works', async () => {
    const mockOutput = ["https://replicate.delivery/pbxt/test.png"];
    replicateMock.queueSuccessResponse(mockOutput);

    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'test/model',
        apiKey: 'test-key'
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toEqual(mockOutput);

    const lastCall = replicateMock.getLastCall();
    expect(lastCall?.options.input).toEqual({});
  });

  test('POST /api/replicate rejects oversized requests', async () => {
    // Create a very large JSON payload that exceeds the default 1MB limit
    const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB of data
    const event = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'owner/model',
        input: { largeData },
        apiKey: 'test12345678'
      })
    });
    const context = createLambdaContext();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.error).toContain('Request body too large');
  });

  describe('CORS Headers', () => {
    test('all responses include proper CORS headers', async () => {
      const testCases = [
        { method: 'GET', path: '/health', expectedStatus: 200 },
        { method: 'GET', path: '/api/replicate', expectedStatus: 200 },
        { method: 'OPTIONS', path: '/api/replicate', expectedStatus: 200 },
        { method: 'GET', path: '/unknown', expectedStatus: 404 },
        { method: 'POST', path: '/unknown', expectedStatus: 404 }
      ];

      for (const testCase of testCases) {
        const event = createAPIGatewayEvent({
          httpMethod: testCase.method as any,
          path: testCase.path
        });
        const context = createLambdaContext();

        const result = await handler(event, context);

        expect(result.statusCode).toBe(testCase.expectedStatus);
        expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
        expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
        expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
        expect(result.headers?.['Content-Type']).toBe('application/json');
      }
    });

    test('error responses maintain CORS headers', async () => {
      const errorTestCases = [
        {
          description: 'Invalid JSON',
          event: createAPIGatewayEvent({
            httpMethod: 'POST',
            path: '/api/replicate',
            body: 'invalid json{'
          }),
          expectedStatus: 400
        },
        {
          description: 'Missing model',
          event: createAPIGatewayEvent({
            httpMethod: 'POST',
            path: '/api/replicate',
            body: JSON.stringify({ apiKey: 'test' })
          }),
          expectedStatus: 400
        },
        {
          description: 'Missing API key',
          event: createAPIGatewayEvent({
            httpMethod: 'POST',
            path: '/api/replicate',
            body: JSON.stringify({ model: 'owner/model' })
          }),
          expectedStatus: 400
        }
      ];

      for (const testCase of errorTestCases) {
        const context = createLambdaContext();
        const result = await handler(testCase.event, context);

        expect(result.statusCode).toBe(testCase.expectedStatus);
        expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
        expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
        expect(result.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
        expect(result.headers?.['Content-Type']).toBe('application/json');
      }
    });
  });
});