export type CustomFetchOptions = RequestInit & {
  responseType?: 'json' | 'text' | 'blob' | 'auto';
  accessToken?: string | null;
  apiKey?: string | null;
};

export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;
export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = 'application/json, application/problem+json';

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, '') : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== 'undefined' && input instanceof URL;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return 'GET';
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  if (!url.startsWith('/')) return input;
  const absolute = `${_baseUrl}${url}`;
  if (typeof input === 'string') return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function getMediaType(headers: Headers): string | null {
  const value = headers.get('content-type');
  return value ? value.split(';', 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === 'application/json' || Boolean(mediaType?.endsWith('+json'));
}

function hasNoBody(response: Response, method: string): boolean {
  if (method === 'HEAD') return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get('content-length') === '0') return true;
  return response.body === null;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;
  if (typeof data === 'string') {
    const text = data.trim();
    return text ? `${prefix}: ${text}` : prefix;
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const detail =
      (typeof record.detail === 'string' && record.detail) ||
      (typeof record.message === 'string' && record.message) ||
      (typeof record.error === 'string' && record.error) ||
      '';
    return detail ? `${prefix}: ${detail}` : prefix;
  }
  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = 'ApiError';
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(response: Response, data: T | null, requestInfo: { method: string; url: string }) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

async function parseJsonBody(
  response: Response,
  requestInfo: { method: string; url: string }
): Promise<unknown> {
  const raw = await response.text();
  const normalized = stripBom(raw);
  if (normalized.trim() === '') return null;
  return JSON.parse(normalized);
}

async function parseResponseBody(
  response: Response,
  requestInfo: { method: string; url: string },
  responseType: CustomFetchOptions['responseType']
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) return null;
  if (responseType === 'blob') return response.blob();
  if (responseType === 'text') return response.text();
  if (responseType === 'json') return parseJsonBody(response, requestInfo);
  const mediaType = getMediaType(response.headers);
  if (isJsonMediaType(mediaType)) return parseJsonBody(response, requestInfo);
  return response.text();
}

export async function customFetch<TResponse = unknown>(
  input: RequestInfo | URL,
  init?: CustomFetchOptions
): Promise<TResponse> {
  const requestInfo = {
    method: resolveMethod(input, init?.method),
    url: resolveUrl(input),
  };
  const target = applyBaseUrl(input);
  const authToken = init?.accessToken ?? (await _authTokenGetter?.()) ?? null;
  const headers = mergeHeaders(
    { Accept: DEFAULT_JSON_ACCEPT },
    isRequest(target) ? target.headers : undefined,
    init?.headers
  );

  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (init?.apiKey) headers.set('apikey', init.apiKey);

  const response = await fetch(target, {
    ...init,
    headers,
  });
  const data = await parseResponseBody(response, requestInfo, init?.responseType ?? 'auto');
  if (!response.ok) {
    throw new ApiError(response, data, requestInfo);
  }
  return data as TResponse;
}
