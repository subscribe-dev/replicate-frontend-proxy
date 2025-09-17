// Request/Response types for the Replicate proxy API

export interface ReplicateRequest {
  model: string;
  input?: Record<string, any>;
  apiKey: string;
}

export interface HealthResponse {
  status: 'ok';
  message: string;
  timestamp?: string;
  requestId?: string;
}

export interface ApiInstructionsResponse {
  message: string;
  instructions: {
    method: string;
    endpoint: string;
    body: {
      model: string;
      input: string;
      apiKey: string;
    };
  };
}

export interface ErrorResponse {
  error: string;
  details?: string;
  statusCode?: number;
  requestId?: string;
  timestamp?: string;
  stack?: string;
}

// Input validation functions
export const isValidApiKey = (apiKey: string): boolean => {
  return typeof apiKey === 'string' && 
         apiKey.length >= 8 && 
         apiKey.length <= 200 && 
         apiKey.trim() === apiKey;
};

export const isValidModelName = (model: string): boolean => {
  return typeof model === 'string' && 
         model.length > 0 && 
         /^[a-zA-Z0-9][a-zA-Z0-9-_]*\/[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(model) &&
         model.length <= 100;
};

export const validateReplicateRequest = (body: any): { isValid: boolean; error?: string } => {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Request body must be a valid JSON object' };
  }

  if (!body.model || !isValidModelName(body.model)) {
    return { isValid: false, error: 'Model name is required and must be in format "owner/model"' };
  }

  if (!body.apiKey || !isValidApiKey(body.apiKey)) {
    return { isValid: false, error: 'Valid API key is required (8-200 characters)' };
  }

  if (body.input !== undefined && (typeof body.input !== 'object' || body.input === null)) {
    return { isValid: false, error: 'Input must be an object if provided' };
  }

  return { isValid: true };
};