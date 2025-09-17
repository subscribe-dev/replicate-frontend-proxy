import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { handler } from '../src/index';
import { createLambdaContext, createAPIGatewayEvent } from './test-utils/lambda-events';
import { ReplicateMock } from './test-utils/replicate-mock';

describe('Main Handler Auto-Detection', () => {
  let replicateMock: ReplicateMock;

  beforeEach(() => {
    replicateMock = new ReplicateMock();
  });

  afterEach(() => {
    replicateMock.restore();
  });

  test('auto-detects API Gateway event format', async () => {
    const apiGatewayEvent = createAPIGatewayEvent({
      httpMethod: 'GET',
      path: '/health'
    });
    const context = createLambdaContext();

    const result = await handler(apiGatewayEvent, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.status).toBe('ok');
    expect(responseBody.message).toBe('Replicate proxy server is running');
  });

  test('auto-detects direct Lambda event format', async () => {
    const directLambdaEvent = {
      method: 'GET',
      uri: '/health',
      headers: {}
    };
    const context = createLambdaContext();

    const result = await handler(directLambdaEvent, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    
    const responseBody = JSON.parse(result.body);
    expect(responseBody.status).toBe('ok');
    expect(responseBody.message).toBe('Replicate proxy server is running');
  });

  test('handles Lambda@Edge format', async () => {
    const lambdaEdgeEvent = {
      Records: [{
        cf: {
          request: {
            method: 'GET',
            uri: '/health',
            headers: {},
            querystring: ''
          }
        }
      }]
    };
    const context = createLambdaContext();

    const result = await handler(lambdaEdgeEvent, context);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody.status).toBe('ok');
  });

  test('handles POST request with API Gateway format', async () => {
    const mockOutput = ['https://replicate.delivery/pbxt/test.png'];
    replicateMock.queueSuccessResponse(mockOutput);

    const apiGatewayEvent = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'owner/model',
        input: { prompt: 'test' },
        apiKey: 'test12345678'
      })
    });
    const context = createLambdaContext();

    const result = await handler(apiGatewayEvent, context);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toEqual(mockOutput);
  });

  test('handles POST request with direct Lambda format', async () => {
    const mockOutput = ['https://replicate.delivery/pbxt/test.png'];
    replicateMock.queueSuccessResponse(mockOutput);

    const directEvent = {
      method: 'POST',
      uri: '/api/replicate',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'owner/model',
        input: { prompt: 'test' },
        apiKey: 'test12345678'
      })
    };
    const context = createLambdaContext();

    const result = await handler(directEvent, context);

    expect(result.statusCode).toBe(200);
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toEqual(mockOutput);
  });

  test('maintains consistent error handling across formats', async () => {
    // Test with API Gateway format
    const apiGatewayEvent = createAPIGatewayEvent({
      httpMethod: 'POST',
      path: '/api/replicate',
      body: JSON.stringify({
        model: 'invalid',
        apiKey: 'short'
      })
    });
    const context1 = createLambdaContext();

    const result1 = await handler(apiGatewayEvent, context1);

    expect(result1.statusCode).toBe(400);
    
    // Test with direct Lambda format
    const directEvent = {
      method: 'POST',
      uri: '/api/replicate',
      body: JSON.stringify({
        model: 'invalid',
        apiKey: 'short'
      })
    };
    const context2 = createLambdaContext();

    const result2 = await handler(directEvent, context2);

    expect(result2.statusCode).toBe(400);
    
    // Both should have the same error response structure
    const body1 = JSON.parse(result1.body);
    const body2 = JSON.parse(result2.body);
    expect(body1.error).toBe(body2.error);
  });
});