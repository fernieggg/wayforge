import { parseArgs } from 'node:util';
import { MIN_NODE, nodeTooOld } from './node-version';
import { runValidate } from './validate';

const USAGE = `wayforge <command> [options]

Commands:
  validate <journey.json> [--strict]           check a journey against the schema and integrity rules
  build <journey.json> [-o out.html] [--strict] build one self-contained HTML file
  dev <journey.json> [--port 5173]             serve the journey and rebuild on change
  snapshot <journey.json> [--lens id] [--theme light|dark] [-o dir]
                                               PNG of every scene in every lens
`;

const COMMANDS: Record<string, (args: string[]) => Promise<number> | number> = {
  validate: runValidate,
  build: async (args) => (await import('./build')).runBuild(args),
  dev: async (args) => (await import('./dev')).runDev(args),
  snapshot: async (args) => (await import('./snapshot')).runSnapshot(args),
};

async function main(argv: string[]): Promise<number> {
  // Fail clearly up front rather than deep inside the build tooling.
  if (nodeTooOld(process.versions.node)) {
    console.error(`wayforge needs Node ${MIN_NODE} or later (you have ${process.versions.node}). Install the current LTS from https://nodejs.org.`);
    return 1;
  }
  const { positionals } = parseArgs({ args: argv.slice(0, 1), allowPositionals: true, strict: false });
  const name = positionals[0];
  const command = name ? COMMANDS[name] : undefined;
  if (!command) {
    process.stderr.write(USAGE);
    return name && name !== 'help' && name !== '--help' ? 2 : 0;
  }
  return command(argv.slice(1));
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`wayforge: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  },
);
