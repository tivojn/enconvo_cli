import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

interface Config {
  botToken: string;
  enconvo: {
    url: string;
    timeoutMs: number;
  };
  telegram: {
    allowedUserIds: number[];
  };
}

function loadConfig(): Config {
  const configPath = path.join(__dirname, '..', 'config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error('BOT_TOKEN is required in .env');
    process.exit(1);
  }

  return {
    botToken,
    enconvo: {
      url: raw.enconvo?.url ?? 'http://localhost:54535',
      timeoutMs: raw.enconvo?.timeoutMs ?? 120000,
    },
    telegram: {
      allowedUserIds: raw.telegram?.allowedUserIds ?? [],
    },
  };
}

export const config = loadConfig();
