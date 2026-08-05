export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const notFound = (message) => new HttpError(404, 'not_found', message);
export const badRequest = (message) => new HttpError(400, 'bad_request', message);

export const ok = (res, body) => res.status(200).json(body);
export const created = (res, body) => res.status(201).json(body);
export const noContent = (res) => res.status(204).end();
