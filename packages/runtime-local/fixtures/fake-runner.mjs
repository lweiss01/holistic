const fail = process.env.HOLISTIC_FAKE_FAIL === "1";
const malformed = process.env.HOLISTIC_FAKE_MALFORMED === "1";

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

emit({
  type: "phase.changed",
  timestamp: new Date().toISOString(),
  message: "Planning implementation",
  activity: "planning",
  payload: { phase: "plan" }
});

setTimeout(() => {
  emit({
    type: "file.changed",
    timestamp: new Date().toISOString(),
    message: "Updated runtime-service server",
    activity: "editing",
    payload: { path: "services/runtime-service/src/server.ts" }
  });
}, 20);

setTimeout(() => {
  emit({
    type: "test.completed",
    timestamp: new Date().toISOString(),
    message: "Runtime checks passed",
    activity: "running_tests",
    payload: { suite: "runtime-local" }
  });
}, 40);

setTimeout(() => {
  if (malformed) {
    process.stdout.write("this is not valid json\n");
  }

  if (fail) {
    emit({
      type: "session.failed",
      timestamp: new Date().toISOString(),
      message: "Fake runner forced failure",
      activity: "idle",
      severity: "error",
      payload: { reason: "HOLISTIC_FAKE_FAIL=1" }
    });
    process.exit(1);
    return;
  }

  emit({
    type: "session.completed",
    timestamp: new Date().toISOString(),
    message: "Fake runner completed",
    activity: "idle",
    severity: "success"
  });
  process.exit(0);
}, 70);
