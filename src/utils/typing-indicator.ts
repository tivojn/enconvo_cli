/**
 * Generic typing indicator loop.
 * Calls `sendFn` repeatedly at `intervalMs` until stopped.
 */
export function createTypingIndicator(
  sendFn: () => Promise<unknown>,
  intervalMs: number,
): { stop: () => void } {
  let running = true;

  const loop = async () => {
    while (running) {
      try {
        await sendFn();
      } catch {
        running = false;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  };

  loop();

  return {
    stop: () => { running = false; },
  };
}
