import { describe, it, expect } from 'vitest';
import { parseResponse, detectDelegations } from '../response-parser';
import type { EnConvoResponse } from '../enconvo-client';

describe('parseResponse', () => {
  it('parses simple result format', () => {
    const response: EnConvoResponse = { result: 'Hello world' };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Hello world');
    expect(parsed.filePaths).toEqual([]);
    expect(parsed.delegations).toEqual([]);
  });

  it('returns empty for no messages', () => {
    const parsed = parseResponse({});
    expect(parsed.text).toBe('');
    expect(parsed.filePaths).toEqual([]);
    expect(parsed.delegations).toEqual([]);
  });

  it('returns empty for empty messages array', () => {
    const parsed = parseResponse({ messages: [] });
    expect(parsed.text).toBe('');
    expect(parsed.delegations).toEqual([]);
  });

  it('extracts text from assistant messages', () => {
    const response: EnConvoResponse = {
      type: 'messages',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'ignored' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hello from assistant' }] },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Hello from assistant');
  });

  it('concatenates multiple text items', () => {
    const response: EnConvoResponse = {
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Part one' },
            { type: 'text', text: 'Part two' },
          ],
        },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Part one\n\nPart two');
  });

  it('ignores non-assistant messages', () => {
    const response: EnConvoResponse = {
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'system msg' }] },
        { role: 'user', content: [{ type: 'text', text: 'user msg' }] },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('');
  });

  it('detects delegations when roster provided', () => {
    const response: EnConvoResponse = {
      messages: [
        { role: 'assistant', content: [{ type: 'text', text: 'Ask @elena about content.' }] },
      ],
    };
    const parsed = parseResponse(response, ['mavis', 'elena', 'vivienne']);
    expect(parsed.delegations).toHaveLength(1);
    expect(parsed.delegations[0].targetAgentId).toBe('elena');
  });

  it('returns no delegations without roster', () => {
    const response: EnConvoResponse = {
      messages: [
        { role: 'assistant', content: [{ type: 'text', text: 'Ask @elena about content.' }] },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.delegations).toEqual([]);
  });
});

describe('detectDelegations', () => {
  const roster = ['mavis', 'elena', 'vivienne', 'timothy'];

  it('detects @agentId mentions', () => {
    const result = detectDelegations('Let me ask @elena about this.', roster);
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('elena');
    expect(result[0].message).toBe('about this.');
  });

  it('detects arrow delegations', () => {
    const result = detectDelegations('Finance question → vivienne can help.', roster);
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('vivienne');
  });

  it('is case insensitive', () => {
    const result = detectDelegations('@Elena should handle this.', roster);
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('elena');
  });

  it('returns empty for no mentions', () => {
    const result = detectDelegations('Just a normal response.', roster);
    expect(result).toEqual([]);
  });

  it('returns empty without roster', () => {
    const result = detectDelegations('@elena should handle this.');
    expect(result).toEqual([]);
  });

  it('detects multiple delegations', () => {
    const result = detectDelegations('Ask @elena for copy and @timothy for code.', roster);
    expect(result).toHaveLength(2);
    expect(result[0].targetAgentId).toBe('elena');
    expect(result[1].targetAgentId).toBe('timothy');
  });

  it('deduplicates same agent mentions', () => {
    const result = detectDelegations('@elena will do this. @elena is the best.', roster);
    expect(result).toHaveLength(1);
  });

  it('detects bot handle mentions via handleMap', () => {
    const handleMap = {
      '@Enconvo_Elena_Content_Dept_bot': 'elena',
      '@EnConvo_Timothy_Dev_bot': 'timothy',
    };
    const result = detectDelegations(
      'Go to @Enconvo_Elena_Content_Dept_bot for content.',
      roster,
      handleMap,
    );
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('elena');
  });

  it('handles mixed agentId and bot handle mentions', () => {
    const handleMap = {
      '@Enconvo_Elena_Content_Dept_bot': 'elena',
    };
    const result = detectDelegations(
      '@timothy for code, @Enconvo_Elena_Content_Dept_bot for copy.',
      roster,
      handleMap,
    );
    expect(result).toHaveLength(2);
  });

  it('extracts sentence after mention as message', () => {
    const result = detectDelegations('Ask @vivienne about the Q3 budget report.', roster);
    expect(result[0].message).toBe('about the Q3 budget report.');
  });

  it('caps message at 200 chars if no sentence end', () => {
    const longText = '@elena ' + 'a'.repeat(300);
    const result = detectDelegations(longText, roster);
    expect(result[0].message.length).toBeLessThanOrEqual(200);
  });
});
