import { act, renderHook } from "@testing-library/react";
import { usePreferenceSync } from "@/hooks/usePreferenceSync";
import { ApiError } from "@/utils/apiClient";

type Props = { payload: { weight: number } };

describe("usePreferenceSync", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function renderSync(persist: jest.Mock) {
    return renderHook(
      ({ payload }: Props) => usePreferenceSync({ enabled: true, token: "token-1", payload, persist }),
      { initialProps: { payload: { weight: 70 } } }
    );
  }

  it("debounces changes before saving", () => {
    const persist = jest.fn().mockResolvedValue(undefined);
    renderSync(persist);

    act(() => jest.advanceTimersByTime(1199));
    expect(persist).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("token-1", { weight: 70 });
  });

  it("sends nothing during the cooldown after a 429", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const persist = jest.fn().mockRejectedValueOnce(new ApiError("Too many requests", 429)).mockResolvedValue(undefined);
    const { rerender } = renderSync(persist);

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });
    expect(persist).toHaveBeenCalledTimes(1);

    rerender({ payload: { weight: 71 } });
    act(() => jest.advanceTimersByTime(59_999));
    expect(persist).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(1));
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith("token-1", { weight: 71 });
  });
});
