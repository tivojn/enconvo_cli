import { Command } from 'commander';

export function registerCompletionsCommand(program: Command): void {
  program
    .command('completions')
    .description('Generate shell completions (bash, zsh, fish)')
    .argument('<shell>', 'Shell type: bash, zsh, or fish')
    .action((shell: string) => {
      switch (shell.toLowerCase()) {
        case 'bash':
          console.log(generateBash());
          break;
        case 'zsh':
          console.log(generateZsh());
          break;
        case 'fish':
          console.log(generateFish());
          break;
        default:
          console.error(`Unknown shell: ${shell}. Use: bash, zsh, or fish`);
          process.exit(1);
      }
    });
}

const TOP_LEVEL = [
  'channels', 'agents', 'config', 'message',
  'status', 'doctor', 'health', 'sessions',
  'logs', 'info', 'configure', 'export', 'import',
  'version', 'reset', 'completions',
];

const CHANNELS_SUBS = ['list', 'status', 'add', 'remove', 'login', 'logout', 'capabilities', 'resolve', 'logs', 'send', 'groups'];
const AGENTS_SUBS = ['list', 'add', 'delete', 'set-identity', 'sync', 'bindings', 'bind', 'unbind', 'refresh', 'check'];
const CONFIG_SUBS = ['get', 'set', 'unset', 'path'];
const MESSAGE_SUBS = ['send', 'broadcast'];

function generateBash(): string {
  return `# enconvo bash completion
_enconvo() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  case "\${prev}" in
    enconvo)
      COMPREPLY=( $(compgen -W "${TOP_LEVEL.join(' ')}" -- "\${cur}") )
      return 0
      ;;
    channels)
      COMPREPLY=( $(compgen -W "${CHANNELS_SUBS.join(' ')}" -- "\${cur}") )
      return 0
      ;;
    agents)
      COMPREPLY=( $(compgen -W "${AGENTS_SUBS.join(' ')}" -- "\${cur}") )
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "${CONFIG_SUBS.join(' ')}" -- "\${cur}") )
      return 0
      ;;
    message)
      COMPREPLY=( $(compgen -W "${MESSAGE_SUBS.join(' ')}" -- "\${cur}") )
      return 0
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
  esac
}
complete -F _enconvo enconvo
`;
}

function generateZsh(): string {
  return `# enconvo zsh completion
#compdef enconvo

_enconvo() {
  local -a commands channels_subs agents_subs config_subs message_subs

  commands=(
    ${TOP_LEVEL.map(c => `'${c}:${c} command'`).join('\n    ')}
  )

  channels_subs=(${CHANNELS_SUBS.join(' ')})
  agents_subs=(${AGENTS_SUBS.join(' ')})
  config_subs=(${CONFIG_SUBS.join(' ')})
  message_subs=(${MESSAGE_SUBS.join(' ')})

  _arguments -C \\
    '1:command:->command' \\
    '2:subcommand:->subcommand' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    subcommand)
      case $words[2] in
        channels) _values 'subcommand' $channels_subs ;;
        agents) _values 'subcommand' $agents_subs ;;
        config) _values 'subcommand' $config_subs ;;
        message) _values 'subcommand' $message_subs ;;
        completions) _values 'shell' bash zsh fish ;;
      esac
      ;;
  esac
}

_enconvo "$@"
`;
}

function generateFish(): string {
  const lines = [
    '# enconvo fish completion',
    `complete -c enconvo -n '__fish_use_subcommand' -a '${TOP_LEVEL.join(' ')}'`,
  ];

  for (const sub of CHANNELS_SUBS) {
    lines.push(`complete -c enconvo -n '__fish_seen_subcommand_from channels' -a '${sub}'`);
  }
  for (const sub of AGENTS_SUBS) {
    lines.push(`complete -c enconvo -n '__fish_seen_subcommand_from agents' -a '${sub}'`);
  }
  for (const sub of CONFIG_SUBS) {
    lines.push(`complete -c enconvo -n '__fish_seen_subcommand_from config' -a '${sub}'`);
  }
  for (const sub of MESSAGE_SUBS) {
    lines.push(`complete -c enconvo -n '__fish_seen_subcommand_from message' -a '${sub}'`);
  }
  lines.push(`complete -c enconvo -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish'`);

  return lines.join('\n') + '\n';
}
