// SOLANO HEAT — make.fun gta6-01 hand-in program.
//
// Written for Node 22, standard library only. Running it hands the entry in:
// it copies the game/ and screenshots/ folders that sit beside this file into
// the output directory, checks them against the bounty's scorer caps with its
// own measurements first, and then writes dossier.json there using the kit's
// buildDossier, so a hand-in that the scorer would refuse fails here instead,
// with a message that names the cap it broke.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// MAKEFUN_OUTPUT_DIR names the output directory; /output is the default.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's caps, mirrored so this program can refuse on its own first.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

const entryDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function fail(message: string): never {
  console.error(`solano-heat: ${message}`);
  process.exit(1);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/** Every entry under dir, as paths relative to dir, directories included. */
function walk(dir: string, base: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full);
    out.push(rel);
    if (statSync(full).isDirectory()) walk(full, base, out);
  }
  return out;
}

/**
 * Measure screenshots/ against the caps before anything is copied: at most
 * CAPS.screenshots.max image files, each at most CAPS.screenshots.max_bytes,
 * and nothing in the folder that is not a PNG or JPEG image.
 */
function checkScreenshots(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    fail('screenshots/ is missing beside main.ts');
  }
  const names = readdirSync(dir).sort();
  const images: string[] = [];
  for (const name of names) {
    const full = join(dir, name);
    if (!statSync(full).isFile()) fail(`screenshots/${name} is not a file`);
    if (!IMAGE_EXTENSIONS.has(extensionOf(name))) {
      fail(`screenshots/${name} is not a PNG or JPEG image`);
    }
    const bytes = statSync(full).size;
    if (bytes > CAPS.screenshots.max_bytes) {
      fail(
        `screenshots/${name} is ${bytes} bytes, over the ${CAPS.screenshots.max_bytes}-byte cap`,
      );
    }
    images.push(name);
  }
  if (images.length === 0) fail('screenshots/ holds no image');
  if (images.length > CAPS.screenshots.max) {
    fail(
      `screenshots/ holds ${images.length} images, over the cap of ${CAPS.screenshots.max}`,
    );
  }
  return images;
}

/**
 * Measure game/ against the caps: at most CAPS.game_max_files entries (files
 * and directories counted alike, as the platform counts them), at most
 * CAPS.game_max_bytes in file bytes, no relative path longer than
 * CAPS.game_path_max_bytes UTF-8 bytes, and an index.html at its root.
 */
function checkGame(dir: string): { entries: number; bytes: number } {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    fail('game/ is missing beside main.ts');
  }
  if (!existsSync(join(dir, 'index.html'))) fail('game/index.html is missing');
  const rels = walk(dir, dir, []);
  let bytes = 0;
  for (const rel of rels) {
    const pathBytes = Buffer.byteLength(rel.split(sep).join('/'), 'utf8');
    if (pathBytes > CAPS.game_path_max_bytes) {
      fail(
        `game/${rel} has a ${pathBytes}-byte path, over the ${CAPS.game_path_max_bytes}-byte cap`,
      );
    }
    const full = join(dir, rel);
    if (statSync(full).isFile()) bytes += statSync(full).size;
  }
  if (rels.length > CAPS.game_max_files) {
    fail(`game/ holds ${rels.length} entries, over the cap of ${CAPS.game_max_files}`);
  }
  if (bytes > CAPS.game_max_bytes) {
    fail(`game/ is ${bytes} bytes, over the ${CAPS.game_max_bytes}-byte cap`);
  }
  return { entries: rels.length, bytes };
}

/** Copy one entry folder into the output, replacing whatever was there. */
function handOver(name: string): void {
  const from = join(entryDir, name);
  const to = join(outDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

function main(): void {
  const gameDir = join(entryDir, 'game');
  const shotsDir = join(entryDir, 'screenshots');

  // Measure first, copy second: a refused entry leaves the output untouched.
  const shots = checkScreenshots(shotsDir);
  const game = checkGame(gameDir);

  mkdirSync(outDir, { recursive: true });
  handOver('game');
  handOver('screenshots');

  // The dossier is built from the copies in the output, with the same caps,
  // so the bytes handed in are exactly the bytes the scorer recomputes.
  const dossier = buildDossier(outDir, {
    text_max_bytes: CAPS.text_max_bytes,
    screenshots: { max: CAPS.screenshots.max, max_bytes: CAPS.screenshots.max_bytes },
    game_max_files: CAPS.game_max_files,
    game_max_bytes: CAPS.game_max_bytes,
    game_path_max_bytes: CAPS.game_path_max_bytes,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  console.log(
    `solano-heat: handed in game/ (${game.entries} entries, ${game.bytes} bytes), ` +
      `${shots.length} screenshots (${shots.join(', ')}) and dossier.json to ${outDir}`,
  );
}

main();
