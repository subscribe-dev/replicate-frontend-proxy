import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import Replicate from 'replicate';
import { ok, badRequest, unauthorized, notFound, internalServerError, corsPreflightResponse, customError } from './responses';
import { ReplicateRequest, HealthResponse, ApiInstructionsResponse, validateReplicateRequest } from './types';
import { getConfig } from './config';
import { withTimeout, sanitizeForLogs, isValidJsonSize } from './utils';

// Lambda handler for Replicate API proxy
export const handler = async (event: any, context: Context): Promise<APIGatewayProxyResult> => {
  const config = getConfig();
  const requestId = context.awsRequestId;
  const timestamp = new Date().toISOString();

  try {
    // Extract path, method, headers, and body from different AWS Lambda event types
    let path: string;
    let method: string;
    let eventType: string;
    let headers: Record<string, string>;
    let body: string | null;

    // CloudFront OAC events (following auth service pattern)
    if (event.Records && event.Records[0]?.cf?.request) {
      const cfRequest = event.Records[0].cf.request;
      path = cfRequest.uri || '/';
      method = cfRequest.method || 'GET';
      eventType = 'CloudFront OAC';
      
      // Convert CloudFront headers format to standard format
      headers = Object.fromEntries(
        Object.entries(cfRequest.headers || {}).map(([key, values]: [string, any]) => [
          key, 
          Array.isArray(values) ? values[0].value : values
        ])
      );
      
      // Extract body from CloudFront request (base64 encoded if present)
      body = cfRequest.body?.data ? Buffer.from(cfRequest.body.data, 'base64').toString() : null;
    }
    // API Gateway v2 (HTTP API) events
    else if (event.requestContext?.http) {
      path = event.rawPath || event.requestContext.http.path || '/';
      method = event.requestContext.http.method || 'GET';
      eventType = 'API Gateway v2';
      headers = event.headers || {};
      body = event.body;
    }
    // API Gateway v1 (REST API) events
    else if (event.requestContext && event.httpMethod) {
      path = event.path || event.requestContext.path || '/';
      method = event.httpMethod || 'GET';
      eventType = 'API Gateway v1';
      headers = event.headers || {};
      body = event.body;
    }
    // Lambda Function URL events
    else if (event.rawPath) {
      path = event.rawPath || '/';
      method = event.requestContext?.http?.method || 'GET';
      eventType = 'Function URL';
      headers = event.headers || {};
      body = event.body;
    }
    // Fallback
    else {
      path = '/';
      method = 'GET';
      eventType = 'Unknown';
      headers = event.headers || {};
      body = event.body || null;
    }

    // Extract origin from headers for CORS
    const requestOrigin = headers?.['origin'] || headers?.['Origin'];
    
    console.log(`[${requestId}] Received ${method} request at ${timestamp}`);
    console.log(`[${requestId}] Path: ${path}`);
    console.log(`[${requestId}] Event Type: ${eventType}`);
    console.log(`[${requestId}] Full Event Object:`, JSON.stringify(event, null, 2));
    
    // Health check endpoint
    if (path === '/health' && method === 'GET') {
      const healthResponse: HealthResponse = {
        status: 'ok',
        message: 'Replicate proxy server is running',
        timestamp,
        requestId
      };
      return ok(healthResponse);
    }

    // Main proxy endpoint
    if (path === '/api/replicate') {
      // Handle OPTIONS requests for CORS
      if (method === 'OPTIONS') {
        return corsPreflightResponse();
      }

      // Handle GET requests (return instructions)
      if (method === 'GET') {
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
        return ok(instructions);
      }

      // Handle POST requests
      if (method === 'POST') {
        // Check request size
        if (body && !isValidJsonSize(body, config.maxRequestSize)) {
          console.warn(`[${requestId}] Request body too large: ${Buffer.byteLength(body, 'utf8')} bytes`);
          return badRequest(`Request body too large. Maximum size: ${config.maxRequestSize} bytes`);
        }

        let parsedBody: any;
        try {
          parsedBody = JSON.parse(body || '{}');
        } catch (e) {
          console.error(`[${requestId}] Failed to parse request body:`, sanitizeForLogs(e));
          return badRequest('Invalid JSON in request body');
        }

        // Validate request using proper validation
        const validation = validateReplicateRequest(parsedBody);
        if (!validation.isValid) {
          console.warn(`[${requestId}] Request validation failed: ${validation.error}`);
          return badRequest(validation.error!);
        }

        const { model, input, apiKey } = parsedBody as ReplicateRequest;

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
          
          // Convert file objects to URLs for JSON serialization
          let processedResult = result;
          if (Array.isArray(result)) {
            processedResult = await Promise.all(
              result.map(async (item) => {
                if (item && typeof item === 'object' && typeof item.url === 'function') {
                  return await item.url();
                }
                return item;
              })
            );
          } else if (result && typeof result === 'object' && typeof result.url === 'function') {
            processedResult = await result.url();
          }
          
          console.log(`[${requestId}] Processed result:`, JSON.stringify(processedResult));
          return ok(processedResult);

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

          return customError(statusCode, errorMessage, details);
        }
      }
    }

    // Catch-all for unmatched routes
    console.log(`[${requestId}] Route not found: ${method}:${path}`);
    return notFound(`Route ${method}:${path} not found`);

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
      config.enableStackTraces ? error?.stack : undefined
    );
  }
};

