import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

/**
 * What each route sends before it can run, gzipped, from the last build.
 *
 * Read from Next's own route bundle stats rather than summed by hand, and
 * printed per route: the documents grid alone is a third again of any other
 * screen, and one total would hide that. Turbopack builds carry no analyzer,
 * so this is the measurement the README's figures come from.
 */
type RouteStats = { route: string; firstLoadChunkPaths: string[] };

const STATS = '.next/diagnostics/route-bundle-stats.json';

function gzippedKb(path: string): number {
  return gzipSync(readFileSync(path), { level: 9 }).byteLength / 1024;
}

function main(): void {
  let routes: RouteStats[];
  try {
    routes = JSON.parse(readFileSync(STATS, 'utf8')) as RouteStats[];
  } catch {
    console.error(`No ${STATS} — run \`pnpm build\` first.`);
    process.exit(1);
  }

  console.log('\nFirst-load JavaScript per route, gzipped\n');

  const sizes = new Map<string, number>();
  for (const { route, firstLoadChunkPaths } of routes) {
    let raw = 0;
    let gz = 0;
    for (const path of firstLoadChunkPaths) {
      raw += statSync(path).size / 1024;
      gz += sizes.get(path) ?? (sizes.set(path, gzippedKb(path)), sizes.get(path) as number);
    }
    console.log(
      `  ${route.padEnd(24)} ${gz.toFixed(0).padStart(6)} KB gz   ${raw.toFixed(0).padStart(7)} KB raw   ${String(firstLoadChunkPaths.length).padStart(3)} chunks`,
    );
  }

  console.log('');
}

main();
