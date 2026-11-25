import { requestFocusWithRetry } from "./requestFocusWithRetry";

describe("requestFocusWithRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns on first success", async () => {
    const requestOnce = jest.fn().mockResolvedValue(true);
    const p = requestFocusWithRetry(requestOnce, { tries: 3, gapMs: 500 });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: true, attempts: 1 });
    expect(requestOnce).toHaveBeenCalledTimes(1);
  });

  it("retries then fails", async () => {
    const requestOnce = jest.fn().mockResolvedValue(false);
    const p = requestFocusWithRetry(requestOnce, { tries: 3, gapMs: 500 });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: false, attempts: 3 });
    expect(requestOnce).toHaveBeenCalledTimes(3);
  });
});
