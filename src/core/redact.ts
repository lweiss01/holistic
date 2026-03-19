const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SECRET]"],
  [/\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]+\b/g, "[REDACTED_SECRET]"],
  [/\bAIza[0-9A-Za-z\-_]{16,}\b/g, "[REDACTED_SECRET]"],
  [/\b(api[_ -]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1: [REDACTED]"],
];

export function sanitizeText(value: string): string {
  return secretPatterns.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), value.trim());
}

export function sanitizeList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => sanitizeText(value)).filter(Boolean);
}
