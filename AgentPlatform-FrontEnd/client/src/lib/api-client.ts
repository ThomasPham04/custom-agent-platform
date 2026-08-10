import { apiUrl } from './api-host';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isErrorEnvelope = (value: unknown): value is { error: { code: string; message: string } } => {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => undefined);
  if (isErrorEnvelope(body)) {
    return new ApiError(response.status, body.error.code, body.error.message);
  }
  return new ApiError(
    response.status,
    `http_${response.status}`,
    `The server returned ${response.status}. Try again in a moment.`,
  );
};

const request = async (path: string, init?: RequestInit): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(0, 'network_error', "Can't reach the server. Check that the API is running.");
  }
  if (!response.ok) throw await toApiError(response);
  return response;
};

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const apiGet = async <T>(path: string): Promise<T> =>
  (await request(path)).json() as Promise<T>;

export const apiPost = async <T>(path: string, body?: unknown): Promise<T> =>
  (await request(path, jsonInit('POST', body))).json() as Promise<T>;

export const apiPatch = async <T>(path: string, body: unknown): Promise<T> =>
  (await request(path, jsonInit('PATCH', body))).json() as Promise<T>;

export const apiDelete = async (path: string): Promise<void> => {
  await request(path, { method: 'DELETE' });
};
