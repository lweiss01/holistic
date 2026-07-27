type Replacement = string | ((...args: string[]) => string);

const SECRET_ASSIGNMENT_KEYS =
  "api[_ -]?key|token|secret|password|passwd|access[_ -]?key|azure[_ -]?key|stripe[_ -]?key|client[_ -]?secret|auth[_ -]?token";

/**
 * key <sep> value, where the value is either a quoted string (which may contain
 * spaces) or a bare run of non-delimiter characters.
 */
const SECRET_ASSIGNMENT = new RegExp(
  `\\b(${SECRET_ASSIGNMENT_KEYS})(\\s*)([:=])(\\s*)("[^"]*"|'[^']*'|[^\\s,;]+)`,
  "gi",
);

function isQuoted(value: string): boolean {
  return (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
    || (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
}

/**
 * Whether a bare assigned value looks like credential material rather than
 * ordinary prose. Length alone is a poor signal, because "password: changeme"
 * and "token: needs a proxy" are the same shape; the useful signals are digits,
 * base64 punctuation, and unusual length.
 */
function looksLikeSecretValue(value: string): boolean {
  if (value.length >= 20) {
    return true;
  }
  if (value.length >= 6 && /\d/.test(value)) {
    return true;
  }
  if (value.length >= 12 && /[/+=]/.test(value)) {
    return true;
  }
  return false;
}

/**
 * A tight `key=value` with no surrounding whitespace is config or env syntax,
 * where even a short value is a real secret. A spaced `key: value` is how the
 * same words appear in a sentence, so there the value must look like a secret
 * before it is destroyed. Redacting every word after "token:" silently ate
 * legitimate prose out of checkpoints.
 */
function shouldRedactAssignedValue(
  preSpace: string,
  postSpace: string,
  value: string,
): boolean {
  if (isQuoted(value)) {
    return true;
  }
  if (preSpace.length === 0 && postSpace.length === 0) {
    return true;
  }
  return looksLikeSecretValue(value);
}

const secretPatterns: Array<[RegExp, Replacement]> = [
  [/\bsk[-_][A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SECRET]"],
  [/\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]+\b/g, "[REDACTED_SECRET]"],
  [/\bAIza[0-9A-Za-z\-_]{16,}\b/g, "[REDACTED_SECRET]"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_SLACK_TOKEN]"],
  [/\bnpm_[A-Za-z0-9]{36}\b/g, "[REDACTED_NPM_TOKEN]"],
  [/\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]*\b/g, "[REDACTED_JWT]"],
  [/\bBearer\s+[A-Za-z0-9-_.]{8,}\b/gi, "Bearer [REDACTED]"],
  [/\bAKIA[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]"],
  [/-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+)?PRIVATE KEY-----/g, "[REDACTED_PEM_PRIVATE_KEY]"],
  [
    SECRET_ASSIGNMENT,
    (match: string, key: string, preSpace: string, separator: string, postSpace: string, value: string): string =>
      shouldRedactAssignedValue(preSpace, postSpace, value)
        ? `${key}${preSpace}${separator} [REDACTED]`
        : match,
  ],
];

export function sanitizeText(value: string): string {
  return secretPatterns.reduce<string>(
    (acc, [pattern, replacement]) =>
      typeof replacement === "string"
        ? acc.replace(pattern, replacement)
        : acc.replace(pattern, replacement as (substring: string, ...args: unknown[]) => string),
    value.trim(),
  );
}

export function sanitizeList(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => sanitizeText(value)).filter(Boolean);
}
