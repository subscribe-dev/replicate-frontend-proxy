import { Context } from 'aws-lambda';
import { getConfig } from './config';
import { withTimeout, sanitizeForLogs, isValidJsonSize } from './utils';
import { ReplicateRequest, HealthResponse, ApiInstructionsResponse, validateReplicateRequest } from './types';
import Replicate from 'replicate';

// Universal request interface that works with both API Gateway and direct invocation
export interface UniversalRequest {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
  queryStringParameters?: Record<string, string> | null;
}

// Universal response interface
export interface UniversalResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// Convert API Gateway event to universal format
export const fromApiGateway = (event: any): UniversalRequest => ({
  httpMethod: event.httpMethod,
  path: event.path,
  headers: event.headers || {},
  body: event.body,
  queryStringParameters: event.queryStringParameters
});

// Convert CloudFront/Direct Lambda event to universal format
export const fromDirectLambda = (event: any): UniversalRequest => {
  // Handle different direct invocation formats
  if (event.Records && event.Records[0] && event.Records[0].cf) {
    // Lambda@Edge format
    const request = event.Records[0].cf.request;
    return {
      httpMethod: request.method,
      path: request.uri,
      headers: Object.fromEntries(
        Object.entries(request.headers).map(([key, values]: [string, any]) => [
          key, 
          Array.isArray(values) ? values[0].value : values
        ])
      ),
      body: request.body?.data ? Buffer.from(request.body.data, 'base64').toString() : null,
      queryStringParameters: request.querystring ? 
        Object.fromEntries(new URLSearchParams(request.querystring)) : null
    };
  }
  
  // Custom direct invocation format
  return {
    httpMethod: event.httpMethod || event.method || 'GET',
    path: event.path || event.uri || '/',
    headers: event.headers || {},
    body: typeof event.body === 'string' ? event.body : 
          event.body ? JSON.stringify(event.body) : null,
    queryStringParameters: event.queryStringParameters || event.query || null
  };
};

// Generate CORS headers
const getCorsHeaders = (origin?: string) => {
  const config = getConfig();
  const allowedOrigins = config.corsAllowedOrigins;
  
  let corsOrigin = '*';
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes('*')) {
    corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  }
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
};

// Create universal response
const createResponse = (
  statusCode: number,
  body: object | string,
  headers: Record<string, string> = {},
  origin?: string
): UniversalResponse => {
  const corsHeaders = getCorsHeaders(origin);
  return {
    statusCode,
    headers: { ...corsHeaders, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
};

// Response helpers
export const ok = (body: object, origin?: string): UniversalResponse => 
  createResponse(200, body, {}, origin);

export const badRequest = (error: string, details?: string, origin?: string): UniversalResponse => 
  createResponse(400, { error, ...(details && { details }) }, {}, origin);

export const unauthorized = (error: string = 'API key is required', origin?: string): UniversalResponse => 
  createResponse(401, { error }, {}, origin);

export const notFound = (message: string, origin?: string): UniversalResponse => 
  createResponse(404, { message, error: 'Not Found', statusCode: 404 }, {}, origin);

export const internalServerError = (error: string, details?: string, stack?: string, origin?: string): UniversalResponse => 
  createResponse(500, { 
    error, 
    ...(details && { details }),
    ...(stack && { stack })
  }, {}, origin);

export const corsPreflightResponse = (origin?: string): UniversalResponse => 
  createResponse(200, '', {}, origin);

export const customError = (statusCode: number, error: string, details?: string, origin?: string): UniversalResponse => 
  createResponse(statusCode, { error, ...(details && { details }) }, {}, origin);

// Universal handler that works with any event format
export const universalHandler = async (request: UniversalRequest, context: Context): Promise<UniversalResponse> => {
  const config = getConfig();
  const requestId = context.awsRequestId;
  const timestamp = new Date().toISOString();
  const origin = request.headers?.['origin'] || request.headers?.['Origin'];

  try {
    console.log(`[${requestId}] Received ${request.httpMethod} request at ${timestamp}`);
    console.log(`[${requestId}] Path: ${request.path}`);

    const path = request.path || '/';

    // Health check endpoint
    if (path === '/health' && request.httpMethod === 'GET') {
      const healthResponse: HealthResponse = {
        status: 'ok',
        message: 'Replicate proxy server is running',
        timestamp,
        requestId
      };
      return ok(healthResponse, origin);
    }

    // Main proxy endpoint
    if (path === '/api/replicate') {
      // Handle OPTIONS requests for CORS
      if (request.httpMethod === 'OPTIONS') {
        return corsPreflightResponse(origin);
      }

      // Handle GET requests (return instructions)
      if (request.httpMethod === 'GET') {
        const instructions: ApiInstructionsResponse = {
          message: 'Replicate API Proxy',
          instructions: {
            method: 'POST',
            endpoint: '/api/replicate',
            body: {
              model: 'black-forest-labs/flux-schnell',
              input: '{ your model input parameters }',
              apiKey: 'your-replicate-api-key'
            }
          }
        };
        return ok(instructions, origin);
      }

      // Handle POST requests
      if (request.httpMethod === 'POST') {
        // Check request size
        if (request.body && !isValidJsonSize(request.body, config.maxRequestSize)) {
          console.warn(`[${requestId}] Request body too large: ${Buffer.byteLength(request.body, 'utf8')} bytes`);
          return badRequest(`Request body too large. Maximum size: ${config.maxRequestSize} bytes`, undefined, origin);
        }

        let body: any;
        try {
          body = JSON.parse(request.body || '{}');
        } catch (e) {
          console.error(`[${requestId}] Failed to parse request body:`, sanitizeForLogs(e));
          return badRequest('Invalid JSON in request body', undefined, origin);
        }

        // Validate request
        const validation = validateReplicateRequest(body);
        if (!validation.isValid) {
          console.warn(`[${requestId}] Request validation failed: ${validation.error}`);
          return badRequest(validation.error!, undefined, origin);
        }

        const { model, input, apiKey } = body as ReplicateRequest;

        console.log(`[${requestId}] Proxying request to Replicate for model: ${model}`);
        console.log(`[${requestId}] Input parameters provided: ${input ? Object.keys(input).length : 0} keys`);
        console.log(`[${requestId}] API key format: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

        try {
          const replicate = new Replicate({ auth: apiKey });
          
          // Add timeout to Replicate API call
          const replicateCall = replicate.run(
            model as `${string}/${string}` | `${string}/${string}:${string}`,
            { input: input || {} }
          );
          const result = await withTimeout(
            replicateCall,
            config.replicateTimeout,
            `Replicate API call timed out after ${config.replicateTimeout}ms`
          );
          
          console.log(`[${requestId}] Replicate API call completed successfully`);
          return ok(result, origin);

        } catch (replicateError: any) {
          console.error(`[${requestId}] Replicate API error:`, replicateError.message);
          console.error(`[${requestId}] Error status:`, replicateError.status || 'none');
          
          // Only log stack trace if enabled
          if (config.enableStackTraces) {
            console.error(`[${requestId}] Error stack:`, replicateError.stack);
          }

          // Handle specific Replicate API errors
          const statusCode = replicateError.status || 500;
          const errorMessage = replicateError.message || 'Failed to call Replicate API';
          const details = replicateError.detail || errorMessage;

          return customError(statusCode, errorMessage, details, origin);
        }
      }
    }

    // Catch-all for unmatched routes
    console.log(`[${requestId}] Route not found: ${request.httpMethod}:${path}`);
    return notFound(`Route ${request.httpMethod}:${path} not found`, origin);

  } catch (error: any) {
    console.error(`[${requestId}] Lambda handler error:`, error?.message);
    
    // Only log stack trace and full error if enabled
    if (config.enableStackTraces) {
      console.error(`[${requestId}] Error stack:`, error?.stack);
      console.error(`[${requestId}] Full error object:`, sanitizeForLogs(error));
    }

    return internalServerError(
      'Internal server error',
      error?.message || 'Unknown error',
      config.enableStackTraces ? error?.stack : undefined,
      origin
    );
  }
};