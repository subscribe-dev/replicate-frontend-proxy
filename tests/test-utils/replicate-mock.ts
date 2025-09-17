import { spyOn } from 'bun:test';
import Replicate from 'replicate';

interface MockResponse {
  success: boolean;
  data?: any;
  error?: any;
}

class ReplicateMock {
  private responseQueue: MockResponse[] = [];
  private runSpy: any;

  constructor() {
    this.setupMock();
  }

  private setupMock() {
    this.runSpy = spyOn(Replicate.prototype, 'run').mockImplementation(
      async (model: string, options: { input: any }) => {
        if (this.responseQueue.length === 0) {
          throw new Error(
            'ReplicateMock: No response queued. Call queueResponse() before running test.'
          );
        }

        const response = this.responseQueue.shift()!;
        
        if (!response.success) {
          const error = new Error(response.error?.message || 'Mocked Replicate error');
          (error as any).status = response.error?.status || 500;
          (error as any).detail = response.error?.detail;
          throw error;
        }

        return response.data;
      }
    );
  }

  queueSuccessResponse(data: any) {
    this.responseQueue.push({ success: true, data });
  }

  queueErrorResponse(error: { message?: string; status?: number; detail?: string }) {
    this.responseQueue.push({ success: false, error });
  }

  getCallCount(): number {
    return this.runSpy.mock.calls.length;
  }

  getLastCall(): { model: string; options: { input: any } } | undefined {
    const calls = this.runSpy.mock.calls;
    if (calls.length === 0) return undefined;
    const lastCall = calls[calls.length - 1];
    return { model: lastCall[0], options: lastCall[1] };
  }

  reset() {
    this.responseQueue = [];
    this.runSpy.mockClear();
  }

  restore() {
    this.runSpy.mockRestore();
  }
}

export { ReplicateMock };