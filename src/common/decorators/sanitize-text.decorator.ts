import { Transform } from 'class-transformer';
import { sanitizeText } from '../sanitize-text';

/** Strips HTML/script fragments from user-facing text (names, comments). */
export function SanitizeText() {
  return Transform(({ value }) => sanitizeText(value));
}
