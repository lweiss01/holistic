const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk[-_][A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SECRET]"],
  [/\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]+\b/g, "[REDACTED_SECRET]"],
  [/\bAIza[0-9A-Za-z\-_]{16,}\b/g, "[REDACTED_SECRET]"],
  [/\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]*\b/g, "[REDACTED_JWT]"],
  [/\bBearer\s+[A-Za-z0-9-_.]{8,}\b/gi, "Bearer [REDACTED]"],
  [/\bAKIA[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]"],
  [/-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+)?PRIVATE KEY-----/g, "[REDACTED_PEM_PRIVATE_KEY]"],
  [/\b(api[_ -]?key|token|secret|password|access[_ -]?key|azure[_ -]?key|stripe[_ -]?key)(\s*)([:=])\s*[^\s,;]+/gi, "$1$2$3 [REDACTED]"],
];

export function sanitizeText(value: string): string {
  return secretPatterns.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), value.trim());
}

export function sanitizeList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => sanitizeText(value)).filter(Boolean);
}
