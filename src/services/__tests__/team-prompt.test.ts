import { describe, it, expect } from 'vitest';
import { generatePrompt } from '../team-prompt';
import type { AgentMember } from '../../config/agent-store';

function makeAgent(overrides: Partial<AgentMember> = {}): AgentMember {
  return {
    id: 'test-agent',
    name: 'TestAgent',
    emoji: '🧪',
    role: 'Tester',
    specialty: 'Testing',
    isLead: false,
    bindings: {
      agentPath: 'custom_bot/test',
      telegramBot: '@TestBot',
      instanceName: 'test',
    },
    preferenceKey: 'custom_bot|test',
    workspacePath: '/tmp/nonexistent-workspace',
    ...overrides,
  };
}

describe('generatePrompt', () => {
  it('includes agent name and role', () => {
    const agent = makeAgent();
    const prompt = generatePrompt(agent);
    expect(prompt).toContain('You are TestAgent');
    expect(prompt).toContain('Tester');
  });

  it('includes Chinese name when present', () => {
    const agent = makeAgent({ chineseName: '测试员' });
    const prompt = generatePrompt(agent);
    expect(prompt).toContain('(测试员)');
  });

  it('includes telegram bot handle', () => {
    const agent = makeAgent();
    const prompt = generatePrompt(agent);
    expect(prompt).toContain('@TestBot');
  });

  it('includes identity grounding', () => {
    const agent = makeAgent();
    const prompt = generatePrompt(agent);
    expect(prompt).toContain('CRITICAL: You ARE TestAgent');
    expect(prompt).toContain('Never identify as Claude, GPT');
  });

  it('includes Jinja2 time placeholder', () => {
    const agent = makeAgent();
    const prompt = generatePrompt(agent);
    expect(prompt).toContain('{{ now }}');
    expect(prompt).toContain('{{responseLanguage}}');
  });

  it('includes workspace path for refresh', () => {
    const agent = makeAgent();
    const prompt = generatePrompt(agent);
    expect(prompt).toContain(agent.workspacePath);
  });

  it('gracefully handles missing workspace files', () => {
    const agent = makeAgent({ workspacePath: '/tmp/nonexistent-path-12345' });
    // Should not throw
    const prompt = generatePrompt(agent);
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('You are TestAgent');
  });
});
