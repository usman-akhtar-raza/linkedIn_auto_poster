// Guards against storing attacker-influenced URLs (from LLM output / web
// research) that could become stored-XSS or open-redirect sinks when later
// rendered. Only explicit, safe schemes are allowed through.

/**
 * Returns the value only if it is an http(s) URL; otherwise undefined.
 * Use for link fields such as research topic URLs.
 */
export function sanitizeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the value only if it is an https URL or a `data:image/*` URL;
 * otherwise undefined. Use for image sources coming back from the model.
 */
export function sanitizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  if (/^data:image\/[a-z0-9.+-]+;/i.test(value)) {
    return value;
  }
  try {
    return new URL(value).protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}
