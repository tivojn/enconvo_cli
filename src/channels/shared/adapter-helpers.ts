import * as os from 'os';
import * as path from 'path';

/**
 * Build log file paths for a channel adapter.
 */
export function buildLogPaths(
  channel: string,
  instanceName?: string,
): { stdout: string; stderr: string } {
  const suffix = instanceName ?? 'adapter';
  return {
    stdout: path.join(os.homedir(), `Library/Logs/enconvo-${channel}-${suffix}.log`),
    stderr: path.join(os.homedir(), `Library/Logs/enconvo-${channel}-${suffix}-error.log`),
  };
}

/**
 * Build a launchd-style service label for a channel adapter.
 */
export function buildServiceLabel(channel: string, instanceName?: string): string {
  const suffix = instanceName ?? 'adapter';
  return `com.enconvo.${channel}-${suffix}`;
}

/**
 * Format uptime from a start date to a human-readable string.
 */
export function formatUptime(startedAt: Date): string {
  const uptimeMs = Date.now() - startedAt.getTime();
  const secs = Math.floor(uptimeMs / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m ${secs % 60}s`;
}
