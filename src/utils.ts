// Utility functions for the Replicate proxy

export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    })
  ]);
};

export const sanitizeForLogs = (data: any, maxLength: number = 100): string => {
  if (typeof data === 'string') {
    return data.length > maxLength ? data.substring(0, maxLength) + '...' : data;
  }
  
  if (typeof data === 'object' && data !== null) {
    try {
      const jsonString = JSON.stringify(data);
      return jsonString.length > maxLength ? jsonString.substring(0, maxLength) + '...' : jsonString;
    } catch {
      return '[Object - could not serialize]';
    }
  }
  
  return String(data);
};

export const generateCorrelationId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const isValidJsonSize = (jsonString: string, maxSizeBytes: number): boolean => {
  return Buffer.byteLength(jsonString, 'utf8') <= maxSizeBytes;
};