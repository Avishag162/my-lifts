/** A file from src/web/public ("/icon-192.png"), with the site's base path (the GitHub Pages version lives under /my-lifts/). */
export function asset<T extends string | null | undefined>(path: T): T {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  return (import.meta.env.BASE_URL + path.slice(1)) as T;
}
