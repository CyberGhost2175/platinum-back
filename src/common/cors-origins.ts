import { Response } from 'express';

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) =>
      origin
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\/$/, ''),
    )
    .filter(Boolean);
}

export function applyCorsHeaders(
  response: Response,
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): void {
  if (!origin || !allowedOrigins.has(origin)) {
    return;
  }
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Vary', 'Origin');
}
