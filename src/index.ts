import { createBot } from './bot';

async function main() {
  console.log('Starting EnConvo Telegram Adapter...');

  const bot = createBot();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start polling
  await bot.start({
    onStart: (info) => {
      console.log(`Bot @${info.username} is running (long polling)`);
    },
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
