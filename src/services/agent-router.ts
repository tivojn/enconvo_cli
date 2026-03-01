import { callEnConvo } from './enconvo-client';
import { parseResponse, DelegationDirective, ParsedResponse } from './response-parser';
import { loadAgentsRoster } from '../config/agent-store';

export interface RoutingContext {
  chatId: string;
  channel: string;
  instanceId?: string;
}

/**
 * Route a delegation directive to the target agent via EnConvo API.
 * Looks up the target agent in the roster, calls their agentPath,
 * and returns the parsed response.
 */
export async function routeToAgent(
  fromAgentName: string,
  delegation: DelegationDirective,
  context: RoutingContext,
): Promise<ParsedResponse | null> {
  const roster = loadAgentsRoster();
  const target = roster.members.find(m => m.id === delegation.targetAgentId);
  if (!target) {
    console.warn(`[agent-router] Target agent "${delegation.targetAgentId}" not found in roster`);
    return null;
  }

  // Build a shared session so the target agent has context
  const sessionId = `${context.channel}-${context.chatId}-team`;

  // Prepend context so the target agent knows who's asking
  const message = `[From ${fromAgentName}]: ${delegation.message}`;

  try {
    const response = await callEnConvo(message, sessionId, target.bindings.agentPath);
    return parseResponse(response);
  } catch (err) {
    console.error(`[agent-router] Failed to route to ${target.name}:`, err);
    return null;
  }
}
