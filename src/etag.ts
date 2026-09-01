export function etagFor(latest: string | null): string {
  return `"${latest ?? 'empty'}"`;
}

export function notModified(req: Request, etag: string): boolean {
  return req.headers.get('If-None-Match') === etag;
}
