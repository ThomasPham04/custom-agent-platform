import { randomBytes } from 'node:crypto';

export const createId = (prefix) =>
  `${prefix}_${randomBytes(6).toString('base64url').toLowerCase().slice(0, 8)}`;
