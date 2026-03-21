/**
 * ASCII splash screen for Holistic CLI commands.
 * Provides visual identity and communicates value proposition.
 */

export interface SplashOptions {
  message?: string;
  showStatus?: boolean;
  statusItems?: string[];
}

const HOLISTIC_ASCII = `
██╗  ██╗ ██████╗ ██╗     ██╗███████╗████████╗██╗ ██████╗
██║  ██║██╔═══██╗██║     ██║██╔════╝╚══██╔══╝██║██╔════╝
███████║██║   ██║██║     ██║███████╗   ██║   ██║██║     
██╔══██║██║   ██║██║     ██║╚════██║   ██║   ██║██║     
██║  ██║╚██████╔╝███████╗██║███████║   ██║   ██║╚██████╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝
`;

const TAGLINE = "Your repo remembers, so your next agent doesn't have to guess.";
const SUBTITLE = "Shared memory for AI agents, built into your repo.";

/**
 * Render the Holistic splash screen with optional status items.
 */
export function renderSplash(options: SplashOptions = {}): string {
  const lines: string[] = [];

  // ASCII art
  lines.push(HOLISTIC_ASCII);

  // Message (e.g., "initializing shared memory layer...")
  if (options.message) {
    lines.push(`   ${options.message}`);
    lines.push("");
  }

  // Status items with checkmarks
  if (options.showStatus && options.statusItems && options.statusItems.length > 0) {
    for (const item of options.statusItems) {
      lines.push(`   ✔ ${item}`);
    }
    lines.push("");
  }

  // Tagline and subtitle
  lines.push(`   ${TAGLINE}`);
  lines.push(`   ${SUBTITLE}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Print splash screen to stdout.
 */
export function printSplash(options: SplashOptions = {}): void {
  process.stdout.write(renderSplash(options));
}
