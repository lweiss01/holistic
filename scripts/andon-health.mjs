import path from "node:path";
import process from "node:process";

const baseUrl = process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health/andon`);
if (!response.ok) {
  process.stderr.write(`Andon health request failed: HTTP ${response.status}\n`);
  process.exit(1);
}

const payload = await response.json();
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

const localEnvPath = process.env.ANDON_DB_PATH?.trim();
if (localEnvPath && payload.databasePath) {
  const resolvedEnv = path.resolve(localEnvPath);
  const resolvedApi = path.resolve(String(payload.databasePath));
  if (resolvedEnv !== resolvedApi) {
    process.stderr.write(
      `[andon:health] This shell's ANDON_DB_PATH (${resolvedEnv}) does not match the API's open database (${resolvedApi}).\n`
    );
    process.exitCode = 2;
  }
}
