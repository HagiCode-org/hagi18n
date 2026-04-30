const LOCALE_ALIAS_MAP = new Map([
  ["zh", "zh-CN"],
  ["zh-cn", "zh-CN"],
  ["en", "en-US"],
  ["en-us", "en-US"]
]);

export function normalizeLocaleName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const aliasedLocale = LOCALE_ALIAS_MAP.get(trimmed.toLowerCase());
  if (aliasedLocale) {
    return aliasedLocale;
  }

  try {
    return new Intl.Locale(trimmed).toString();
  } catch {
    return trimmed;
  }
}
