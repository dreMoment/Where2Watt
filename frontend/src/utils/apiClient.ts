export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type MaybeJsonError = {
    detail?: string | Array<{ loc?: Array<string | number>; msg?: string; type?: string }>;
    message?: string;
    error?: string;
};

type RequestOptions = RequestInit & {
    errorMessage?: string;
};

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

export async function parseNormalizedError(res: Response, fallbackMessage: string): Promise<Error> {
    try {
        const data = (await res.json()) as MaybeJsonError;

        if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
            return new Error(data.detail);
        }

        const validationMessage = formatFastApiValidationDetail(data?.detail);
        if (validationMessage) {
            return new Error(validationMessage);
        }

        const message = data?.message ?? data?.error;
        if (typeof message === "string" && message.trim().length > 0) {
            return new Error(message);
        }
    } catch {
        // ignore JSON parsing errors
    }
    return new Error(fallbackMessage);
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
