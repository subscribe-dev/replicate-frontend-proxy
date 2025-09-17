// Configuration and constants for the Replicate proxy

export interface ProxyConfig {
  maxRequestSize: number;
  replicateTimeout: number;
  corsAllowedOrigins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableStackTraces: boolean;
}

export const getConfig = (): ProxyConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '1048576'), // 1MB default
    replicateTimeout: parseInt(process.env.REPLICATE_TIMEOUT || '300000'), // 5 minutes default
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['*'],
    logLevel: (process.env.LOG_LEVEL as ProxyConfig['logLevel']) || (isProduction ? 'warn' : 'debug'),
    enableStackTraces: process.env.ENABLE_STACK_TRACES === 'true' || (process.env.ENABLE_STACK_TRACES !== 'false' && !isProduction)
  };
};

export const CONSTANTS = {
  REQUEST_TIMEOUT: 300000, // 5 minutes
  MAX_MODEL_NAME_LENGTH: 100,
  MIN_API_KEY_LENGTH: 8,
  MAX_API_KEY_LENGTH: 200,
  SUPPORTED_HTTP_METHODS: ['GET', 'POST', 'OPTIONS'] as const,
} as const;