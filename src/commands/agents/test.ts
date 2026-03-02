import { Command } from 'commander';
import { loadAgentsRoster } from '../../config/agent-store';
import { loadGlobalConfig } from '../../config/store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse } from '../../services/response-parser';

interface AgentTestResult {
  id: string;
  name: string;
  emoji: string;
  agentPath: string;
  success: boolean;
  responsePreview?: string;
  latencyMs: number;
  error?: string;
}

export function registerTest(parent: Command): void {
  parent
    .command('test')
    .description('Test agent responsiveness via EnConvo API')
    .option('--agent <id>', 'Test a specific agent only')
    .option('--message <text>', 'Custom probe message', 'Hello, please respond briefly.')
    .option('--json', 'Output as JSON')
    .action(async (opts: { agent?: string; message: string; json?: boolean }) => {
      const roster = loadAgentsRoster();
      const config = loadGlobalConfig();

      let targets = roster.members;
      if (opts.agent) {
        const agent = roster.members.find(m => m.id === opts.agent);
        if (!agent) {
          if (opts.json) {
            console.log(JSON.stringify({ error: `Agent "${opts.agent}" not found` }));
          } else {
            console.error(`Agent "${opts.agent}" not found.`);
          }
          process.exit(1);
        }
        targets = [agent];
      }

      if (targets.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ error: 'No agents configured' }));
        } else {
          console.error('No agents configured. Run "enconvo agents add" first.');
        }
        process.exit(1);
      }

      if (!opts.json) console.log(`Testing ${targets.length} agent(s)...\n`);

      const results: AgentTestResult[] = [];
      for (const agent of targets) {
        const start = Date.now();
        try {
          const sessionId = `test-probe-${agent.id}-${Date.now()}`;
          const response = await callEnConvo(opts.message, sessionId, agent.bindings.agentPath, {
            url: config.enconvo.url,
            timeoutMs: Math.min(config.enconvo.timeoutMs, 30000),
          });
          const latencyMs = Date.now() - start;

          // Reuse shared response parser for preview extraction
          const parsed = parseResponse(response);
          const preview = parsed.text;

          results.push({
            id: agent.id,
            name: agent.name,
            emoji: agent.emoji,
            agentPath: agent.bindings.agentPath,
            success: true,
            responsePreview: preview.slice(0, 100) + (preview.length > 100 ? '...' : ''),
            latencyMs,
          });
        } catch (err) {
          results.push({
            id: agent.id,
            name: agent.name,
            emoji: agent.emoji,
            agentPath: agent.bindings.agentPath,
            success: false,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ results }, null, 2));
        return;
      }

      for (const r of results) {
        if (r.success) {
          console.log(`  ${r.emoji} ${r.name} — OK (${r.latencyMs}ms)`);
          if (r.responsePreview) {
            console.log(`    "${r.responsePreview}"`);
          }
        } else {
          console.log(`  ${r.emoji} ${r.name} — FAILED (${r.latencyMs}ms)`);
          console.log(`    Error: ${r.error}`);
        }
      }

      const passed = results.filter(r => r.success).length;
      const failed = results.length - passed;
      console.log(`\n${passed}/${results.length} agents responding${failed > 0 ? ` (${failed} failed)` : ''}`);

      if (failed > 0) process.exit(1);
    });
}
