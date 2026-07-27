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
  {
    name: "sanitizeText preserves prose that merely mentions a secret keyword",
    run: () => {
      // Redacting every word after "token:" silently destroyed checkpoint text.
      const inputs = [
        "Decide on the loopback auth token: needs a Vite proxy for the dashboard",
        "password: required before the next step",
        "secret: the design doc explains why",
        "api key: must be rotated by ops",
        "token = well-defined behavior",
        "Rotate the access key: ask the platform team",
      ];
      for (const input of inputs) {
        const output = sanitizeText(input);
        assert.strictEqual(output, input, `Failed to preserve prose: ${input}`);
      }
    },
  },
  {
    name: "sanitizeText still redacts secret-shaped and quoted assigned values",
    run: () => {
      // Quoted values may contain spaces, which the bare-value rule cannot span.
      assert.strictEqual(
        sanitizeText('password = "hunter2 with spaces"'),
        "password = [REDACTED]",
      );
      assert.strictEqual(
        sanitizeText("api_key: A1b2C3d4e5f6"),
        "api_key: [REDACTED]",
      );
      // Long values are redacted even without digits.
      assert.strictEqual(
        sanitizeText("token: abcdefghijklmnopqrstuvwxyz"),
        "token: [REDACTED]",
      );
      // Tight config-style assignment stays redacted even when short.
      assert.strictEqual(sanitizeText("secret=shhh"), "secret= [REDACTED]");
    },
  },
  {
    name: "sanitizeText redacts Slack and npm tokens",
    run: () => {
      assert.strictEqual(
        sanitizeText("slack xoxb-1234567890-abcdefghij"),
        "slack [REDACTED_SLACK_TOKEN]",
      );
      assert.strictEqual(
        sanitizeText(`npm ${"npm_"}${"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8"}`),
        "npm [REDACTED_NPM_TOKEN]",
      );
    },
  },
];
