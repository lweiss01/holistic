import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "..");
const dashboardRoot = resolve(repoRoot, "apps", "andon-dashboard");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const windowsShell = process.platform === "win32"
  ? (process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe")
  : null;
const apiUrl = process.env.ANDON_API_BASE_URL ?? "http://127.0.0.1:4318";
const dashboardPreferredPort = Number(process.env.ANDON_DASHBOARD_PORT ?? "5173");
const runtimePreferredPort = Number(process.env.RUNTIME_SERVICE_PORT ?? "4320");
const defaultAndonDbPath = process.env.ANDON_DB_PATH ?? join(repoRoot, "services", "andon-api", "data", "andon.sqlite");

function parseApiPort(urlString) {
  try {
    const parsed = new URL(urlString);
    return Number(parsed.port || (parsed.protocol === "https:" ? "443" : "80"));
  } catch {
    return 4318;
  }
}

function prefixStream(stream, label, onLine) {
  stream?.on("data", (chunk) => {
    const text = String(chunk);
    for (const line of text.split(/\r?\n/)) {
      if (line.length > 0) {
        process.stdout.write(`[${label}] ${line}\n`);
        onLine?.(line);
      }
    }
  });
}

function spawnLogged(command, args, options, label, onLine) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  prefixStream(child.stdout, label, onLine);
  prefixStream(child.stderr, label, onLine);
  return child;
}

function spawnNpmLogged(args, options, label, onLine) {
  if (process.platform === "win32") {
    return spawnLogged(
      windowsShell,
      ["/d", "/s", "/c", `${npmCommand} ${args.join(" ")}`],
      options,
      label,
      onLine
    );
  }

  return spawnLogged(npmCommand, args, options, label, onLine);
}

function waitForExit(child, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function isApiHealthy(url) {
  try {
    const response = await fetch(`${url}/health`);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.ok === true && payload?.service === "andon-api";
  } catch {
    return false;
  }
}

async function isRuntimeServiceHealthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.ok === true && payload?.service === "runtime-service";
  } catch {
    return false;
  }
}

async function runMigrate(env) {
  const migrate = spawnLogged(process.execPath, ["scripts/andon-migrate.mjs"], { env }, "migrate");
  await waitForExit(migrate, "andon:db:migrate");
}

function unique(values) {
  return [...new Set(values)];
}

function runPowerShell(command) {
  const candidates = process.platform === "win32" ? ["pwsh", "powershell"] : [];
  for (const bin of candidates) {
    const result = spawnSync(bin, ["-NoProfile", "-Command", command], { encoding: "utf8" });
    if (result.status === 0) {
      return result.stdout || "";
    }
  }
  return "";
}

function getListeningPidsOnPort(port) {
  if (process.platform === "win32") {
    const script = [
      `$rows = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue;`,
      "if ($rows) {",
      "  $rows | Select-Object -ExpandProperty OwningProcess -Unique",
      "}"
    ].join(" ");
    const output = runPowerShell(script);
    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  const result = spawnSync("sh", ["-lc", `lsof -ti tcp:${port} || true`], { encoding: "utf8" });
  if (result.status !== 0) {
    return [];
  }
  return (result.stdout || "")
    .split(/\r?\n/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function getAndonCommandPids() {
  if (process.platform === "win32") {
    const script = [
      "$rows = Get-CimInstance Win32_Process | Where-Object {",
      "  $_.CommandLine -and (",
      "    $_.CommandLine -match 'services[\\\\/]andon-api[\\\\/]src[\\\\/]server\\\\.ts' -or",
      "    $_.CommandLine -match 'services[\\\\/]runtime-service[\\\\/]src[\\\\/]server\\\\.ts' -or",
      "    $_.CommandLine -match 'scripts[\\\\/]andon-runtime-writer\\\\.mjs' -or",
      "    $_.CommandLine -match 'apps[\\\\/]andon-dashboard' -or",
      "    $_.CommandLine -match 'scripts[\\\\/]andon-dev\\\\.mjs'",
      "  )",
      "};",
      "if ($rows) { $rows | Select-Object -ExpandProperty ProcessId -Unique }"
    ].join(" ");
    const output = runPowerShell(script);
    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  const result = spawnSync("sh", ["-lc", "ps -ax -o pid=,command= | rg \"andon-api/src/server.ts|runtime-service/src/server.ts|scripts/andon-runtime-writer.mjs|apps/andon-dashboard|scripts/andon-dev.mjs\""], { encoding: "utf8" });
  if (result.status !== 0) {
    return [];
  }
  return (result.stdout || "")
    .split(/\r?\n/)
    .map((line) => Number(line.trim().split(/\s+/)[0]))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function terminatePid(pid) {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function isPortFree(port) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
  return await new Promise((resolvePromise) => {
    const probe = createServer()
      .once("error", () => resolvePromise(false))
      .once("listening", () => {
        probe.close(() => resolvePromise(true));
      })
      .listen(port, "127.0.0.1");
  });
}

async function preflightCleanup(apiPort, dashboardPort, runtimePort) {
  const apiFreeBefore = await isPortFree(apiPort);
  const dashboardFreeBefore = await isPortFree(dashboardPort);
  const runtimeFreeBefore = await isPortFree(runtimePort);
  if (!apiFreeBefore) {
    console.log(`[preflight] Port ${apiPort} is already occupied.`);
  }
  if (!dashboardFreeBefore) {
    console.log(`[preflight] Port ${dashboardPort} is already occupied.`);
  }
  if (!runtimeFreeBefore) {
    console.log(`[preflight] Port ${runtimePort} is already occupied.`);
  }

  const candidatePids = unique([
    ...getListeningPidsOnPort(apiPort),
    ...getListeningPidsOnPort(dashboardPort),
    ...getListeningPidsOnPort(runtimePort),
    ...getAndonCommandPids()
  ]).filter((pid) => pid !== process.pid);

  if (candidatePids.length === 0) {
    console.log("[preflight] No existing Andon processes detected.");
    return;
  }

  console.log(`[preflight] Found existing process(es): ${candidatePids.join(", ")}`);
  const blocked = [];
  for (const pid of candidatePids) {
    const attempted = terminatePid(pid);
    if (!attempted) {
      blocked.push(pid);
    }
  }

  await sleep(400);
  const stillAlive = candidatePids.filter((pid) => isProcessAlive(pid));
  const unresolved = unique([...blocked, ...stillAlive]);
  if (unresolved.length > 0) {
    console.warn(`[preflight] Could not stop PID(s): ${unresolved.join(", ")} (likely permission denied).`);
  } else {
    console.log("[preflight] Cleaned up existing Andon processes.");
  }

  const apiFreeAfter = await isPortFree(apiPort);
  const dashboardFreeAfter = await isPortFree(dashboardPort);
  const runtimeFreeAfter = await isPortFree(runtimePort);
  if (!apiFreeAfter || !dashboardFreeAfter || !runtimeFreeAfter) {
    const blockedPorts = [
      !apiFreeAfter ? apiPort : null,
      !dashboardFreeAfter ? dashboardPort : null,
      !runtimeFreeAfter ? runtimePort : null
    ].filter(Boolean);
    console.warn(`[preflight] Port(s) still occupied after cleanup: ${blockedPorts.join(", ")}.`);
  }
}

async function main() {
  const apiPort = parseApiPort(apiUrl);
  const sharedAndonEnv = {
    ...process.env,
    HOLISTIC_REPO: process.env.HOLISTIC_REPO ?? repoRoot,
    ANDON_DB_PATH: defaultAndonDbPath,
  };

  console.log("Andon dev startup");
  console.log(`Repo root      : ${repoRoot}`);
  console.log(`API base URL   : ${apiUrl}`);
  console.log(`API port       : ${apiPort}`);
  console.log(`Runtime port   : ${runtimePreferredPort}`);
  console.log(`ANDON_DB_PATH  : ${defaultAndonDbPath}`);
  console.log(`Dashboard port : ${dashboardPreferredPort}`);
  console.log("");

  await preflightCleanup(apiPort, dashboardPreferredPort, runtimePreferredPort);
  await runMigrate(sharedAndonEnv);

  const managedChildren = [];
  const stopAll = () => {
    for (const { proc } of managedChildren) {
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    }
  };

  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);

  const apiAlreadyRunning = await isApiHealthy(apiUrl);
  if (apiAlreadyRunning) {
    console.log(`[api] Reusing existing Andon API at ${apiUrl}`);
  } else {
    const api = spawnLogged(
      process.execPath,
      ["--experimental-strip-types", "services/andon-api/src/server.ts"],
      {
        env: sharedAndonEnv,
      },
      "api"
    );
    managedChildren.push({ proc: api, label: "api" });
  }

  const runtimeAlreadyRunning = await isRuntimeServiceHealthy(runtimePreferredPort);
  if (runtimeAlreadyRunning) {
    console.log(`[runtime] Reusing existing runtime service on port ${runtimePreferredPort}`);
  } else {
    const runtime = spawnLogged(
      process.execPath,
      ["--experimental-strip-types", "services/runtime-service/src/server.ts"],
      {
        env: sharedAndonEnv,
      },
      "runtime"
    );
    managedChildren.push({ proc: runtime, label: "runtime" });
  }

  const runtimeWriter = spawnLogged(
    process.execPath,
    ["scripts/andon-runtime-writer.mjs"],
    {
      env: sharedAndonEnv,
    },
    "runtime-writer"
  );
  managedChildren.push({ proc: runtimeWriter, label: "runtime-writer" });

  let resolvedDashboardUrl = null;
  const dashboard = spawnLogged(
    process.platform === "win32" ? windowsShell : npmCommand,
    process.platform === "win32"
      ? ["/d", "/s", "/c", `${npmCommand} run dev`]
      : ["run", "dev"],
    {
      cwd: dashboardRoot,
      env: {
        ...sharedAndonEnv,
        VITE_ANDON_API_BASE_URL: process.env.VITE_ANDON_API_BASE_URL ?? apiUrl,
      },
    },
    "dashboard",
    (line) => {
      const match = line.match(/Local:\s+(https?:\/\/\S+)/i);
      if (match && !resolvedDashboardUrl) {
        resolvedDashboardUrl = match[1];
        console.log(`Dashboard UI   : ${resolvedDashboardUrl}`);
      }
    }
  );
  managedChildren.push({ proc: dashboard, label: "dashboard" });

  console.log("");
  console.log("Dashboard UI   : waiting for Vite local URL...");
  console.log(`Backend health : ${apiUrl}/health`);
  console.log(`Runtime health : http://127.0.0.1:${runtimePreferredPort}/health`);
  console.log(`Runtime writer : holistic active-session observer`);
  console.log(`Andon DB health: ${apiUrl}/health/andon`);
  console.log("");

  await Promise.race(managedChildren.map(({ proc, label }) => waitForExit(proc, label)));
  stopAll();
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
