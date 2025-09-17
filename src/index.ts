// Main entry point for @subscribe.dev/replicate-frontend-proxy
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { universalHandler, fromApiGateway, fromDirectLambda } from './universal-handler';

// Single universal handler with event extraction functions
export const handler = async (event: any, context: Context): Promise<any> => {
  // Auto-detect event type and extract universal request
  let universalRequest;
  
  if (event.httpMethod && event.path && event.headers) {
    // API Gateway format
    universalRequest = fromApiGateway(event);
  } else {
    // Direct Lambda or other format
    universalRequest = fromDirectLambda(event);
  }
  
  return universalHandler(universalRequest, context);
};

// Export extraction functions for manual use
export { fromApiGateway, fromDirectLambda, universalHandler } from './universal-handler';

// Export types for consumers
export type {
  ReplicateRequest,
  HealthResponse,
  ApiInstructionsResponse,
  ErrorResponse
} from './types';

export type {
  UniversalRequest,
  UniversalResponse
} from './universal-handler';

// Export validation functions
export {
  isValidApiKey,
  isValidModelName,
  validateReplicateRequest
} from './types';

// Export configuration types and utilities
export type { ProxyConfig } from './config';
export { getConfig } from './config';

// Export utility functions
export {
  withTimeout,
  sanitizeForLogs,
  isValidJsonSize
} from './utils';

// Export response helpers from universal handler
export {
  ok,
  badRequest,
  unauthorized,
  notFound,
  internalServerError,
  corsPreflightResponse,
  customError
} from './universal-handler';