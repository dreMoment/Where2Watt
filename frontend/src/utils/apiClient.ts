function normalizeApiBaseUrl(value: string | undefined): string {
    const normalized = value?.trim().replace(/\/+$/, "");
    return normalized || "/api";
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

type MaybeJsonError = {
    detail?: string | Array<{ loc?: Array<string | number>; msg?: string; type?: string }>;
    message?: string;
    error?: string;
};

type RequestOptions = RequestInit & {
    errorMessage?: string;
};

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

function mergeHeaders(...headerSets: Array<HeadersInit | undefined>): Headers {
    const merged = new Headers();
    for (const headers of headerSets) {
        if (!headers) {
            continue;
        }
        new Headers(headers).forEach((value, key) => {
            merged.set(key, value);
        });
    }
    return merged;
}

export function withBearerAuth(token: string, headers?: HeadersInit): Headers {
    return mergeHeaders(headers, { Authorization: `Bearer ${token}` });
}

function formatFastApiLocation(loc: Array<string | number> | undefined): string {
    if (!Array.isArray(loc) || loc.length === 0) {
        return "field";
    }

    const normalized = loc
        .map((part) => String(part))
        .filter((part) => part !== "body" && part !== "query" && part !== "path" && part !== "header");

    if (normalized.length === 0) {
        return "field";
    }

    return normalized.join(".");
}

function formatFastApiValidationDetail(detail: MaybeJsonError["detail"]): string | null {
    if (!Array.isArray(detail) || detail.length === 0) {
        return null;
    }

    const normalizedItems = detail
        .map((item) => {
            const message = typeof item?.msg === "string" ? item.msg.trim() : "";
            if (!message) {
                return null;
            }

            const field = formatFastApiLocation(item?.loc);
            return `${field}: ${message}`;
        })
        .filter((item): item is string => Boolean(item));

    if (normalizedItems.length === 0) {
        return null;
    }

    return normalizedItems.join("; ");
}

export async function parseNormalizedError(res: Response, fallbackMessage: string): Promise<ApiError> {
    let message = fallbackMessage;
    try {
        const data = (await res.json()) as MaybeJsonError;

        if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
            message = data.detail;
        } else {
            const validationMessage = formatFastApiValidationDetail(data?.detail);
            const responseMessage = data?.message ?? data?.error;
            if (validationMessage) {
                message = validationMessage;
            } else if (typeof responseMessage === "string" && responseMessage.trim().length > 0) {
                message = responseMessage;
            }
        }
    } catch {
        // ignore JSON parsing errors
    }
    return new ApiError(message, res.status);
}

export async function request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
    const { errorMessage = "Request failed", headers, ...rest } = options;

    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers,
    });

    if (!res.ok) {
        throw await parseNormalizedError(res, errorMessage);
    }

    if (res.status === 204) {
        return undefined as T;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        return undefined as T;
    }

    return (await res.json()) as T;
}
