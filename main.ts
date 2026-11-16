// Token radar entry point (Node 22, standard library only).
//
// What a run does:
//   1. reads the sealed snapshot (--input <file>, or a directory holding
//      snapshot.json; /input when the flag is absent),
//   2. scores every pre-token protocol in it with the radar model
//      (lib/model.ts) and refuses to hand in a board the gate would refuse,
//   3. writes board.json and the dashboard's data.js to the output dir
//      (MAKEFUN_OUTPUT_DIR, --output, or /output),
//   4. copies dashboard/ and screenshots/ across, checking the screenshot
//      count and names on the way,
//   5. writes dossier.json last, through the vendored make.fun library —
//      the scorer rebuilds it from the same output and compares bytes, so
//      nothing may be written after it.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// The gate's caps (the kit's reference/gate.json), named once here: the
// dossier text cap shapes how much text buildDossier may emit, the rest
// are limits a bad hand-in is refused for crossing.
const DOSSIER_TEXT_MAX = 65_536;
const SCREENSHOT_LIMITS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_LIMITS = { max_files: 400, max_bytes: 4_194_304 };
const SCREENSHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** Stop the run with a message on stderr and the given exit code. */
function fail(code: number, message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

/** One `--name value` or `--name=value` argument, else the fallback. */
function readArg(name: string, fallback: string): string {
  const flag = `--${name}`;
  const at = process.argv.indexOf(flag);
  if (at !== -1 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const joined = process.argv.find((a) => a.startsWith(`${flag}=`));
  return joined === undefined ? fallback : joined.slice(flag.length + 1);
}

/**
 * Copy the regular files of one directory into another (created as
 * needed), skipping dotfiles, and return the names copied. The dashboard
 * and the screenshots both travel this way.
 */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    copied.push(name);
  }
  return copied;
}

function main(): void {
  const inputArg = readArg('input', '/input');
  const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(snapshotPath)) {
    fail(2, `no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`);
  }
  const out = readArg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) fail(1, `the model wrote a board the gate refuses: ${issue}`);

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(out, 'data.js'), dataScript(radar));

  copyDir(join(repoDir, 'dashboard'), join(out, 'dashboard'));
  const shots = copyDir(join(repoDir, 'screenshots'), join(out, 'screenshots'));
  if (shots.length < 3) {
    fail(1, `screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!SCREENSHOT_NAME.test(name)) {
      fail(1, `screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
    }
  }

  const dossier = buildDossier(out, {
    text_max_bytes: DOSSIER_TEXT_MAX,
    screenshots: SCREENSHOT_LIMITS,
    dashboard: DASHBOARD_LIMITS,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
      `${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ` +
      `${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
  );
}

main();
