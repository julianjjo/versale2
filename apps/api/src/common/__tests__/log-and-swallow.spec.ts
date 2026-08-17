import { Logger } from '@nestjs/common';
import { logAndSwallow } from '../log-and-swallow';

describe('logAndSwallow', () => {
  const mockLogger = { error: jest.fn() };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('logs the error through the given logger with the given message', () => {
    const error = new Error('boom');

    logAndSwallow(mockLogger as unknown as Logger, 'Something failed')(error);

    expect(mockLogger.error).toHaveBeenCalledWith('Something failed', error);
  });

  it('discards the error instead of throwing it', () => {
    expect(() =>
      logAndSwallow(
        mockLogger as unknown as Logger,
        'Something failed',
      )('not an Error'),
    ).not.toThrow();
  });

  it('can be used directly as a Promise.catch handler', async () => {
    await expect(
      Promise.reject(new Error('rejected')).catch(
        logAndSwallow(mockLogger as unknown as Logger, 'Something failed'),
      ),
    ).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Something failed',
      expect.any(Error),
    );
  });
});
