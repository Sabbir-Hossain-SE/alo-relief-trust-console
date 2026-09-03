import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

/**
 * Renders the raster icons from `src/app/icon.svg`, so there is one drawing of
 * the mark rather than four that drift.
 *
 *   pnpm icons
 *
 * Apple ignores SVG icons entirely, and a handful of browsers still ask for
 * `/favicon.ico` by path. Neither format can carry a media query, so both are
 * rendered with the light horizon: a tab strip is more often light than dark,
 * and the sun carries the mark either way.
 */
const SOURCE = 'src/app/icon.svg';

const RASTERS = [
  { path: 'src/app/apple-icon.png', size: 180 },
  { path: 'src/app/icon.png', size: 32 },
];

/** The size stored inside the ICO directory. 0 means 256. */
function icoDimension(size: number): number {
  return size >= 256 ? 0 : size;
}

/**
 * Wraps a PNG as a single-image ICO.
 *
 * An ICO may hold PNG data directly rather than a device-independent bitmap,
 * which every browser that still asks for `favicon.ico` supports and which
 * avoids hand-rolling a BMP with an inverted alpha mask.
 */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(icoDimension(size), 0);
  entry.writeUInt8(icoDimension(size), 1);
  entry.writeUInt8(0, 2); // palette colours
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.byteLength, 8);
  entry.writeUInt32LE(header.byteLength + entry.byteLength, 12);

  return Buffer.concat([header, entry, png]);
}

async function main(): Promise<void> {
  const svg = await readFile(SOURCE, 'utf8');
  const browser = await chromium.launch();

  try {
    for (const { path, size } of RASTERS) {
      // Light explicitly: the media query in the source would otherwise follow
      // whatever machine happens to run this, and bake it into a file that
      // cannot change its mind.
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        colorScheme: 'light',
      });

      await page.setContent(
        `<body style="margin:0">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</body>`,
      );

      // Transparent, so the mark composites onto whatever it is placed on.
      const png = await page.screenshot({ omitBackground: true });
      await writeFile(path, png);
      await page.close();

      console.log(`rendered ${path} at ${size}px`);
    }

    const favicon = await readFile('src/app/icon.png');
    await writeFile('src/app/favicon.ico', pngToIco(favicon, 32));
    console.log('wrote src/app/favicon.ico');
  } finally {
    await browser.close();
  }
}

// Called rather than awaited at the top level: tsx compiles this file to CJS,
// where a top-level await is a syntax error.
void main();
