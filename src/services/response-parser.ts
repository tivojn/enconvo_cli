import * as fs from 'fs';
import { EnConvoResponse } from './enconvo-client';

export interface DelegationDirective {
  targetAgentId: string;
  message: string;
}

export interface ParsedResponse {
  text: string;
  filePaths: string[];
  delegations: DelegationDirective[];
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const ALL_FILE_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  '.txt', '.pdf', '.doc', '.docx', '.csv', '.json', '.xml',
  '.mp3', '.mp4', '.wav', '.mov', '.zip', '.tar', '.gz',
]);

function hasKnownExtension(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return ALL_FILE_EXTENSIONS.has(ext);
}

// Extract absolute file paths from any string
function extractAbsolutePaths(text: string): string[] {
  const paths: string[] = [];
  // Match absolute paths with file extensions
  const regex = /(\/[\w .~\-/]+\.[\w]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const p = match[1];
    if (hasKnownExtension(p) && fs.existsSync(p)) {
      paths.push(p);
    }
  }
  return paths;
}

function extractDeliverableFiles(flowParams: string): string[] {
  try {
    const params = JSON.parse(flowParams);
    if (!Array.isArray(params.deliverables)) return [];
    return params.deliverables
      .filter((d: any) => d.type === 'file' && d.url && fs.existsSync(d.url))
      .map((d: any) => d.url as string);
  } catch {
    return [];
  }
}

// Extract file paths from any flow_step's flowParams
function extractFlowParamsPaths(flowParams: string): string[] {
  return extractAbsolutePaths(flowParams);
}

/**
 * Detect @agent mentions in response text against a known roster.
 * Roster is optional — if not provided, returns empty array.
 */
export function detectDelegations(text: string, rosterIds?: string[]): DelegationDirective[] {
  if (!rosterIds || rosterIds.length === 0) return [];

  const delegations: DelegationDirective[] = [];
  // Match @agentId patterns (case-insensitive)
  const pattern = new RegExp(`(?:@|→\\s*)(?:@)?(${rosterIds.join('|')})\\b`, 'gi');
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const targetId = match[1].toLowerCase();
    // Use remaining text after the mention as delegation context
    const afterMention = text.slice(match.index + match[0].length).trim();
    // Take the sentence or up to 200 chars as the delegation message
    const sentenceEnd = afterMention.search(/[.!?\n]/);
    const message = sentenceEnd > 0 ? afterMention.slice(0, sentenceEnd + 1).trim() : afterMention.slice(0, 200).trim();
    if (message && !delegations.find(d => d.targetAgentId === targetId)) {
      delegations.push({ targetAgentId: targetId, message });
    }
  }
  return delegations;
}

export function parseResponse(response: EnConvoResponse, rosterIds?: string[]): ParsedResponse {
  const textParts: string[] = [];
  const filePaths: string[] = [];

  // Handle simple { "result": "..." } format (e.g. Translator)
  if (response.result) {
    return { text: response.result, filePaths: [], delegations: [] };
  }

  if (!response.messages) {
    return { text: '', filePaths: [], delegations: [] };
  }

  for (const msg of response.messages) {
    if (msg.role !== 'assistant') continue;

    for (const item of msg.content) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);
        filePaths.push(...extractAbsolutePaths(item.text));
      }

      if (item.type === 'flow_step' && item.flowParams) {
        // Deliverable tool has structured file references
        if (item.flowName === 'Deliverable') {
          filePaths.push(...extractDeliverableFiles(item.flowParams));
        }
        // Also scan any flow_step params for file paths (e.g. file_system--read_file)
        filePaths.push(...extractFlowParamsPaths(item.flowParams));
      }
    }
  }

  const fullText = textParts.join('\n\n');
  const delegations = detectDelegations(fullText, rosterIds);

  return {
    text: fullText,
    filePaths: [...new Set(filePaths)],
    delegations,
  };
}
