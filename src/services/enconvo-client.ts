import { loadGlobalConfig } from '../config/store';

interface EnConvoContentItem {
  type: string;
  text?: string;
  id?: string;
  // flow_step fields
  flowName?: string;
  flowParams?: string;
  flowRunStatus?: string;
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

export interface CallEnConvoOptions {
  url?: string;
  timeoutMs?: number;
}

export async function callEnConvo(
  inputText: string,
  sessionId: string,
  agentPath: string = 'chat_with_ai/chat',
  options?: CallEnConvoOptions,
): Promise<EnConvoResponse> {
  const globalConfig = loadGlobalConfig();
  const baseUrl = options?.url ?? globalConfig.enconvo.url;
  const timeout = options?.timeoutMs ?? globalConfig.enconvo.timeoutMs;

  const url = `${baseUrl}/command/call/${agentPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

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
    clearTimeout(timer);
  }
}
