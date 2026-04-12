import assert from "node:assert";
import { sanitizeText } from '../core/redact.ts';

export const tests = [
  {
    name: "sanitizeText redacts OpenAI-style sk- keys",
    run: () => {
      const input = "Use key sk-Abc123Abc123Abc123 for access";
      const output = sanitizeText(input);
      assert.strictEqual(output, "Use key [REDACTED_SECRET] for access");
    },
  },
  {
    name: "sanitizeText redacts GitHub PATs",
    run: () => {
      const input = "My token is ghp_foobarbazqux123";
      const output = sanitizeText(input);
      assert.strictEqual(output, "My token is [REDACTED_SECRET]");
    },
  },
  {
    name: "sanitizeText redacts JWT tokens",
    run: () => {
      const input = "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoyNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const output = sanitizeText(input);
      assert.strictEqual(output, "Authorization: [REDACTED_JWT]");
    },
  },
  {
    name: "sanitizeText redacts Bearer tokens",
    run: () => {
      const input = "Header: Bearer abc.123.def-456";
      const output = sanitizeText(input);
      assert.strictEqual(output, "Header: Bearer [REDACTED]");
    },
  },
  {
    name: "sanitizeText redacts AWS Access Key IDs",
    run: () => {
      const input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
      const output = sanitizeText(input);
      assert.strictEqual(output, "AWS_ACCESS_KEY_ID=[REDACTED_AWS_KEY]");
    },
  },
  {
    name: "sanitizeText redacts PEM Private Key blocks",
    run: () => {
      const input = `Here is the key:
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA75v...
...more...
-----END RSA PRIVATE KEY-----
Keep it safe.`;
      const output = sanitizeText(input);
      assert.ok(output.includes("[REDACTED_PEM_PRIVATE_KEY]"));
      assert.ok(!output.includes("MIIEpQIBAAKCAQEA75v"));
    },
  },
  {
    name: "sanitizeText redacts assignment-style secrets",
    run: () => {
      const input = "password: mypassword123; secret=shhh";
      const output = sanitizeText(input);
      assert.strictEqual(output, "password: [REDACTED]; secret= [REDACTED]");
    },
  },
  {
    name: "sanitizeText redacts Azure keys",
    run: () => {
      const input = "azure_key = abc123def456ghi789jkl012mno345pqr";
      const output = sanitizeText(input);
      assert.strictEqual(output, "azure_key = [REDACTED]");
    },
  },
  {
    name: "sanitizeText redacts Stripe keys",
    run: () => {
      const input = "stripe_key: sk_test_51...abc";
      const output = sanitizeText(input);
      assert.strictEqual(output, "stripe_key: [REDACTED]");
    },
  },
  {
    name: "sanitizeText preserves common non-secret strings",
    run: () => {
      const inputs = [
        "index.js",
        "file:package.json",
        "Bearer of bad news",
        "JWT is a standard",
        "The project status is ok",
        "session-123",
        "taskId: 456",
        "http://localhost:3000"
      ];
      for (const input of inputs) {
        const output = sanitizeText(input);
        assert.strictEqual(output, input, `Failed to preserve: ${input}`);
      }
    },
  },
];
