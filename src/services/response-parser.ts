import * as fs from 'fs';
import { EnConvoResponse } from './enconvo-client';

export interface ParsedResponse {
  text: string;
  filePaths: string[];
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

function isImagePath(str: string): boolean {
  if (!str.startsWith('/')) return false;
  const lower = str.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  // Match absolute file paths in the text
  const regex = /(?:^|\s)(\/[\w./-]+\.(?:png|jpg|jpeg|gif|webp|bmp))(?:\s|$|[.,)}\]])/gim;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const p = match[1];
    if (fs.existsSync(p)) {
      paths.push(p);
    }
  }
  return paths;
}

export function parseResponse(response: EnConvoResponse): ParsedResponse {
  const textParts: string[] = [];
  const filePaths: string[] = [];

  for (const msg of response.messages) {
    if (msg.role !== 'assistant') continue;

    for (const item of msg.content) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);

        // Check for file paths embedded in the text
        const paths = extractFilePaths(item.text);
        filePaths.push(...paths);
      }
    }
  }

  // Also check if any text chunk is itself just a file path
  for (const part of textParts) {
    const trimmed = part.trim();
    if (isImagePath(trimmed) && fs.existsSync(trimmed) && !filePaths.includes(trimmed)) {
      filePaths.push(trimmed);
    }
  }

  return {
    text: textParts.join('\n\n'),
    filePaths: [...new Set(filePaths)],
  };
}
