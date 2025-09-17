import { APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from './config';

// Generate CORS headers based on configuration
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

export const createResponse = (
  statusCode: number,
  body: object | string,
  headers: Record<string, string> = {},
  origin?: string
): APIGatewayProxyResult => {
  const corsHeaders = getCorsHeaders(origin);
  return {
    statusCode,
    headers: { ...corsHeaders, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
};

export const ok = (body: object, origin?: string): APIGatewayProxyResult => 
  createResponse(200, body, {}, origin);

export const badRequest = (error: string, details?: string, origin?: string): APIGatewayProxyResult => 
  createResponse(400, { error, ...(details && { details }) }, {}, origin);

export const unauthorized = (error: string = 'API key is required', origin?: string): APIGatewayProxyResult => 
  createResponse(401, { error }, {}, origin);

export const notFound = (message: string, origin?: string): APIGatewayProxyResult => 
  createResponse(404, { message, error: 'Not Found', statusCode: 404 }, {}, origin);

export const internalServerError = (error: string, details?: string, stack?: string, origin?: string): APIGatewayProxyResult => 
  createResponse(500, { 
    error, 
    ...(details && { details }),
    ...(stack && { stack })
  }, {}, origin);

export const corsPreflightResponse = (origin?: string): APIGatewayProxyResult => 
  createResponse(200, '', {}, origin);

export const customError = (statusCode: number, error: string, details?: string, origin?: string): APIGatewayProxyResult => 
  createResponse(statusCode, { error, ...(details && { details }) }, {}, origin);