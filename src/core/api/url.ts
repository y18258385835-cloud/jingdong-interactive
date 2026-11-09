import { API_BASE_URL } from '../auth/types';

/** Build an absolute URL for API calls in both the browser and the Store app. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path) return API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
