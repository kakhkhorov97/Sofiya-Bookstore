import { retryDelayMs } from './indexer';

describe('retryDelayMs', () => {
  it('reads the wait time from a Gemini 429', () => {
    expect(
      retryDelayMs(
        new Error('{"code":429} Quota exceeded. Please retry in 4.96s.'),
      ),
    ).toBe(5960);
  });

  it('waits 30s when no delay is given', () => {
    expect(retryDelayMs(new Error('RESOURCE_EXHAUSTED'))).toBe(31000);
  });

  it('does not retry other errors', () => {
    expect(retryDelayMs(new Error('API key not valid'))).toBeNull();
  });
});
