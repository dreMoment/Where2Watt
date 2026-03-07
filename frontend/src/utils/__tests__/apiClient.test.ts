import { parseNormalizedError, request, withBearerAuth } from "@/utils/apiClient";

const makeResponse = (
  body: unknown,
  options: { status: number; headers?: HeadersInit; throwOnJson?: boolean }
) => {
  const ok = options.status >= 200 && options.status < 300;
  const headers = new Headers(options.headers);
  return {
    status: options.status,
    headers,
    ok,
    async json() {
      if (options.throwOnJson) {
        throw new Error("Invalid JSON");
      }
      return body;
    },
    async text() {
      if (typeof body === "string") {
        return body;
      }
      return JSON.stringify(body);
    },
  };
};

describe("apiClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("withBearerAuth merges authorization with existing headers", () => {
    const headers = withBearerAuth("token-1", { "Content-Type": "application/json" });
    expect(headers.get("Authorization")).toBe("Bearer token-1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("parseNormalizedError uses API detail message when available", async () => {
    const error = await parseNormalizedError(
      makeResponse({ detail: "No access" }, { status: 403, headers: { "Content-Type": "application/json" } }),
      "fallback"
    );
    expect(error.message).toBe("No access");
  });

  it("parseNormalizedError formats FastAPI validation detail arrays", async () => {
    const error = await parseNormalizedError(
      makeResponse(
        {
          detail: [
            {
              loc: ["body", "traffic_level"],
              msg: "Input should be less than or equal to 3",
              type: "less_than_equal",
            },
            {
              loc: ["body", "overall_quality"],
              msg: "Input should be greater than or equal to 1",
              type: "greater_than_equal",
            },
          ],
        },
        { status: 422, headers: { "Content-Type": "application/json" } }
      ),
      "fallback"
    );
    expect(error.message).toBe(
      "traffic_level: Input should be less than or equal to 3; overall_quality: Input should be greater than or equal to 1"
    );
  });

  it("parseNormalizedError falls back when body is not JSON", async () => {
    const error = await parseNormalizedError(
      makeResponse("not-json", { status: 500, throwOnJson: true }),
      "fallback"
    );
    expect(error.message).toBe("fallback");
  });

  it("request throws normalized error when response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({ message: "Auth failed" }, {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    ) as jest.Mock;

    await expect(request("/auth/me")).rejects.toThrow("Auth failed");
  });

  it("request returns undefined for 204 and for non-json responses", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(null, { status: 204 }))
      .mockResolvedValueOnce(
        makeResponse("ok", { status: 200, headers: { "Content-Type": "text/plain" } })
      ) as jest.Mock;

    await expect(request("/one")).resolves.toBeUndefined();
    await expect(request("/two")).resolves.toBeUndefined();
  });

  it("request parses JSON payloads", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({ a: 1 }, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ) as jest.Mock;

    await expect(request<{ a: number }>("/ok")).resolves.toEqual({ a: 1 });
  });
});
