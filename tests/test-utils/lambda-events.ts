import { APIGatewayProxyEvent, Context } from 'aws-lambda';

interface CreateEventOptions {
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
  path?: string;
  body?: string | null;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string> | null;
}

export function createAPIGatewayEvent(options: CreateEventOptions = {}): APIGatewayProxyEvent {
  const {
    httpMethod = 'GET',
    path = '/',
    body = null,
    headers = {},
    queryStringParameters = null
  } = options;

  return {
    httpMethod,
    path,
    resource: path,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test-account',
      apiId: 'test-api',
      authorizer: {},
      protocol: 'HTTP/1.1',
      httpMethod,
      path,
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: path,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
        clientCert: null
      }
    }
  };
}

export function createLambdaContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id-' + Math.random().toString(36).substr(2, 9),
    logGroupName: '/aws/lambda/test-function',
    logStreamName: new Date().toISOString(),
    getRemainingTimeInMillis: () => 30000
  } as Context;
}

export function createReplicatePostEvent(model: string, input: any, apiKey: string): APIGatewayProxyEvent {
  return createAPIGatewayEvent({
    httpMethod: 'POST',
    path: '/api/replicate',
    body: JSON.stringify({ model, input, apiKey })
  });
}