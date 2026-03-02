import * as fs from 'fs';
import { EnConvoResponse } from './enconvo-client';

/**
 * Strip serialized thinking JSON blocks from text content.
 * Some models embed {"type":"thinking",...} as text strings instead of typed content items.
 * Uses brace-depth counting to handle nested braces in content.
 */
function stripThinkingJson(text: string): string {
  if (!text.includes('"type":"thinking"')) return text;

  let result = text;
  let searchFrom = 0;
  while (true) {
    const marker = result.indexOf('"type":"thinking"', searchFrom);
    if (marker === -1) break;
    // Walk backwards to find the opening brace
    let start = marker - 1;
    while (start >= 0 && result[start] !== '{') start--;
    if (start < 0) { searchFrom = marker + 1; continue; }
    // Walk forwards counting braces to find the matching close
    let depth = 0;
    let end = start;
    for (let i = start; i < result.length; i++) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') depth--;
      if (depth === 0) { end = i + 1; break; }
    }
    if (depth !== 0) { searchFrom = marker + 1; continue; }
    result = result.slice(0, start) + result.slice(end);
    searchFrom = start;
  }
  return result.trim();
}

export interface DelegationDirective {
  targetAgentId: string;
  message: string;
}

export interface ParsedResponse {
  text: string;
  filePaths: string[];
  delegations: DelegationDirective[];
}

/** Extensions to EXCLUDE — config/code/system files that should never be delivered */
const EXCLUDED_EXTENSIONS = new Set([
  '.ts', '.js', '.mjs', '.cjs', '.jsx', '.tsx',
  '.py', '.rb', '.rs', '.go', '.java', '.c', '.cpp', '.h',
  '.sh', '.bash', '.zsh',
  '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
  '.env', '.lock', '.log',
  '.md',
  '.plist', '.dmg', '.app',
  '.gitignore', '.eslintrc', '.prettierrc',
]);

export function hasKnownExtension(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  // Must have an extension, must contain a letter (not .13, .14 etc), and not be code/config
  return ext.length > 1 && /[a-z]/.test(ext) && !EXCLUDED_EXTENSIONS.has(ext);
}

/** Extract absolute file paths from any string */
export function extractAbsolutePaths(text: string): string[] {
  const paths: string[] = [];
  // Match absolute paths with file extensions
  const regex = /(\/[\w .~\-/]+\.[\w]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const p = match[1];
    if (hasKnownExtension(p) && fs.existsSync(p) && fs.statSync(p).isFile()) {
      paths.push(p);
    }
  }
  return paths;
}

export function extractDeliverableFiles(flowParams: string): string[] {
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

/**
 * Detect @agent mentions in response text against a known roster.
 * Matches both agent IDs (e.g. @elena) and bot handles (e.g. @Enconvo_Elena_Content_Dept_bot).
 * handleMap maps lowercase bot handles to agent IDs for resolution.
 */
export function detectDelegations(
  text: string,
  rosterIds?: string[],
  handleMap?: Record<string, string>,
): DelegationDirective[] {
  if (!rosterIds || rosterIds.length === 0) return [];

  const delegations: DelegationDirective[] = [];

  // Build combined patterns: agent IDs + bot handles
  const allPatterns = [...rosterIds];
  const handleToId: Record<string, string> = {};
  if (handleMap) {
    for (const [handle, agentId] of Object.entries(handleMap)) {
      // Strip leading @ from handle for matching
      const clean = handle.replace(/^@/, '');
      allPatterns.push(clean);
      handleToId[clean.toLowerCase()] = agentId;
    }
  }

  const pattern = new RegExp(`(?:@|→\\s*)(?:@)?(${allPatterns.join('|')})\\b`, 'gi');
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const matched = match[1].toLowerCase();
    // Resolve to agent ID (either direct match or via handle map)
    const targetId = handleToId[matched] ?? matched;

    // Skip self-mentions or unknown IDs
    if (!rosterIds.includes(targetId)) continue;

    // Use full remaining text after the mention as delegation context (up to 1000 chars)
    const afterMention = text.slice(match.index + match[0].length).trim();
    const message = afterMention.slice(0, 1000).trim();
    if (message && !delegations.find(d => d.targetAgentId === targetId)) {
      delegations.push({ targetAgentId: targetId, message });
    }
  }
  return delegations;
}

export function parseResponse(
  response: EnConvoResponse,
  rosterIds?: string[],
  handleMap?: Record<string, string>,
): ParsedResponse {
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
      if (item.type === 'thinking') continue;
      if (item.type === 'text' && item.text) {
        // Strip serialized thinking JSON that some models embed in text content
        const cleaned = stripThinkingJson(item.text);
        if (cleaned) {
          textParts.push(cleaned);
          filePaths.push(...extractAbsolutePaths(cleaned));
        }
      }

      if (item.type === 'flow_step') {
        // Extract generated files from flowResults (images, documents, etc.)
        if (item.flowResults) {
          for (const result of item.flowResults) {
            if (!result.content) continue;
            for (const c of result.content) {
              if (c.type === 'image_url' && c.image_url?.url && fs.existsSync(c.image_url.url) && fs.statSync(c.image_url.url).isFile()) {
                filePaths.push(c.image_url.url);
              }
              if (c.type === 'text' && c.text) {
                filePaths.push(...extractAbsolutePaths(c.text));
              }
            }
          }
        }

        // Only Deliverable flow_steps have output files in flowParams.
        // All other flow_steps (code_runner, image_to_image, etc.) have INPUT files
        // in flowParams — those are references, not deliverables.
        if (item.flowParams && item.flowName === 'Deliverable') {
          filePaths.push(...extractDeliverableFiles(item.flowParams));
        }
      }
    }
  }

  const fullText = textParts.join('\n\n');
  const delegations = detectDelegations(fullText, rosterIds, handleMap);

  return {
    text: fullText,
    filePaths: [...new Set(filePaths)],
    delegations,
  };
}
