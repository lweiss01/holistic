/**
 * Test environment guard. Import this FIRST from any test entrypoint.
 *
 * The suite drives real CLI, checkpoint, and handoff paths, and those emit
 * Andon lifecycle events. With emission defaulting to the live API on
 * 127.0.0.1:4318, every full run wrote fixture sessions into the operator's
 * real dashboard database. Setting these before the other imports evaluate
 * keeps the suite off the live board no matter which module emits first.
 *
 * Tests that assert on dispatch behavior itself opt back in with
 * ANDON_ALLOW_TEST_EMIT=1 and a throwaway loopback port.
 */
process.env.ANDON_DISABLED = "true";
process.env.HOLISTIC_TEST_MODE = "1";

export const testEnvReady = true;
