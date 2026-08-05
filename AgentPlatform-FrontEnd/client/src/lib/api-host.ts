/**
 * Blank in development: Vite proxies /api to the backend, so requests stay
 * same-origin and no CORS preflight happens. Set VITE_API_HOST to an absolute
 * origin when the API lives on another host.
 */
export const API_HOST = import.meta.env.VITE_API_HOST ?? '';

export const apiUrl = (path: string): string => `${API_HOST}${path}`;
