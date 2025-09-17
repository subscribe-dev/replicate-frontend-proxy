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
  const origin = event.headers?.['origin'] || event.headers?.['Origin'];

  try {
    // Extract path and method using CloudFront/Lambda Function URL format
    const path = event.rawPath || event.requestContext?.http?.path || '/';
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
    
    console.log(`[${requestId}] Received ${method} request at ${timestamp}`);
    console.log(`[${requestId}] Path: ${path}`);
    console.log(`[${requestId}] Event structure:`, JSON.stringify(event, null, 2));
    
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
        if (event.body && !isValidJsonSize(event.body, config.maxRequestSize)) {
          console.warn(`[${requestId}] Request body too large: ${Buffer.byteLength(event.body, 'utf8')} bytes`);
          return badRequest(`Request body too large. Maximum size: ${config.maxRequestSize} bytes`);
        }

        let body: any;
        try {
          body = JSON.parse(event.body || '{}');
        } catch (e) {
          console.error(`[${requestId}] Failed to parse request body:`, sanitizeForLogs(e));
          return badRequest('Invalid JSON in request body');
        }

        // Validate request using proper validation
        const validation = validateReplicateRequest(body);
        if (!validation.isValid) {
          console.warn(`[${requestId}] Request validation failed: ${validation.error}`);
          return badRequest(validation.error!);
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
          return ok(result);

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

