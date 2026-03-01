import { config } from '../config';

interface EnConvoContentItem {
  type: string;
  text?: string;
  id?: string;
}

interface EnConvoMessage {
  id?: string;
  role: string;
  content: EnConvoContentItem[];
}

export interface EnConvoResponse {
  type?: string;
  messages?: EnConvoMessage[];
  result?: string;
}

export async function callEnConvo(inputText: string, sessionId: string, agentPath: string = 'chat_with_ai/chat'): Promise<EnConvoResponse> {
  const url = `${config.enconvo.url}/command/call/${agentPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.enconvo.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_text: inputText, sessionId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`EnConvo API returned ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as EnConvoResponse;
  } finally {
    clearTimeout(timeout);
  }
}
