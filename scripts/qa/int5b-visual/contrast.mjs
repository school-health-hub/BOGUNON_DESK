import fs from 'node:fs/promises';
import { PNG } from './tools/node_modules/pngjs/lib/png.js';
import { textSamples } from './measure.mjs';

const luminance = rgb => rgb.map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

export async function contrastEvidence(page, backgroundFile) {
  const samples = await page.evaluate(textSamples);
  // A separate measurement-only image removes glyph paint; CSS geometry/colors stay unchanged.
  const sheet = await page.addStyleTag({ content: '* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' });
  let png;
  try {
    const bytes = await page.screenshot({ animations: 'disabled' });
    await fs.writeFile(backgroundFile, bytes);
    png = PNG.sync.read(bytes);
  } finally { await sheet.evaluate(element => element.remove()); }
  return samples.map(sample => {
    if (!sample.rgba || sample.unsupported || sample.opacity !== 1 || sample.disabled) return { ...sample, status: sample.disabled ? 'EXEMPT_DISABLED' : 'REQUIRES_REVIEW', reason: 'Group opacity/filter/blend/color needs manual compositing; disabled contrast exempt' };
    let minimum = Infinity, pixels = 0;
    for (const r of sample.rectangles) {
      for (let y = Math.max(0, Math.ceil(r.top)); y < Math.min(png.height, r.bottom); y += 2) {
        for (let x = Math.max(0, Math.ceil(r.left)); x < Math.min(png.width, r.right); x += 2) {
          const offset = (y * png.width + x) * 4;
          const background = [...png.data.subarray(offset, offset + 3)];
          const alpha = (sample.rgba[3] ?? 1) * sample.opacity;
          const foreground = background.map((value, i) => sample.rgba[i] * alpha + value * (1 - alpha));
          minimum = Math.min(minimum, ratio(foreground, background)); pixels++;
        }
      }
    }
    return { ...sample, minimumRatio: pixels ? minimum : null, pixelsSampled: pixels, status: pixels ? (minimum >= sample.threshold ? 'SAMPLED_PASS_REVIEW_REQUIRED' : 'REVISE_CANDIDATE') : 'NOT_VISIBLE', method: 'Computed text color/ancestor opacity over actual glyph-free screenshot pixels (DPR 1); 2px grid. Sampling is evidence, not complete WCAG certification.' };
  });
}
