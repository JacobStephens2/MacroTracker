/**
 * Rasterize public/logo.svg into web + Android launcher icons.
 * Usage: node scripts/generate-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const svgPath = path.join(root, 'public', 'logo.svg');
const svg = fs.readFileSync(svgPath);

async function writePng(outPath, size, { flatten = null } = {}) {
  let pipeline = sharp(svg, { density: 384 }).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (flatten) {
    pipeline = pipeline.flatten({ background: flatten });
  }
  await pipeline.png().toFile(outPath);
  console.log('wrote', path.relative(root, outPath), `(${size}x${size})`);
}

async function main() {
  // Web / PWA
  await writePng(path.join(root, 'public', 'app-icons', 'icon-512.png'), 512);
  await writePng(path.join(root, 'public', 'app-icons', 'icon-192.png'), 192);
  await writePng(path.join(root, 'public', 'favicon.png'), 32);

  // Capacitor Android launcher densities (full icon, already rounded in SVG)
  const androidDensities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
  };
  for (const [density, size] of Object.entries(androidDensities)) {
    const dir = path.join(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    await writePng(path.join(dir, 'ic_launcher.png'), size);
    await writePng(path.join(dir, 'ic_launcher_round.png'), size);
    // Adaptive-icon foreground: full-bleed mark on transparent; system masks it.
    // Use a slightly larger canvas-safe version (same art, no extra padding needed
    // because the SVG already has generous margin inside the squircle).
    await writePng(path.join(dir, 'ic_launcher_foreground.png'), size);
  }

  // TWA bubblewrap mipmaps
  const twaDensities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
  };
  for (const [density, size] of Object.entries(twaDensities)) {
    const dir = path.join(root, 'android-twa', 'app', 'src', 'main', 'res', `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    await writePng(path.join(dir, 'ic_launcher.png'), size);
    await writePng(path.join(dir, 'ic_maskable.png'), size);
  }

  // Adaptive icon background color → deep teal matching the mark
  const bgXml = path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(bgXml)) {
    fs.writeFileSync(
      bgXml,
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0F766E</color>
</resources>
`
    );
    console.log('updated ic_launcher_background.xml');
  }

  // TWA splash screens (were the old M mark)
  const twaSplash = {
    mdpi: 288,
    hdpi: 288,
    xhdpi: 384,
    xxhdpi: 384,
    xxxhdpi: 512,
  };
  for (const [density, size] of Object.entries(twaSplash)) {
    const dir = path.join(root, 'android-twa', 'app', 'src', 'main', 'res', `drawable-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    await writePng(path.join(dir, 'splash.png'), size);
  }

  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
