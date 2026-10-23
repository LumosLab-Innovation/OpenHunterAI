import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const IMAGE = new URL('./assets/hunter-character.png', import.meta.url);

const BRAND_PALETTE = [
  [30, 111, 225], // hood edge
  [37, 228, 236], // visor glow
  [69, 235, 183], // teal highlight
];
const TAGLINE_PALETTE = [
  [133, 164, 196],
  [150, 200, 207],
  [135, 190, 174],
];

function gradientText(value, palette, bold = false) {
  const glyphs = [...value];
  return glyphs.map((glyph, index) => {
    const position = glyphs.length === 1 ? 0 : index / (glyphs.length - 1);
    const segment = Math.min(palette.length - 2, Math.floor(position * (palette.length - 1)));
    const mix = position * (palette.length - 1) - segment;
    const rgb = palette[segment].map((start, channel) =>
      Math.round(start + (palette[segment + 1][channel] - start) * mix));
    return `\x1b[${bold ? '1;' : ''}38;2;${rgb.join(';')}m${glyph}`;
  }).join('') + '\x1b[0m';
}

function renderBrand(color) {
  const left = '╺━━━━━━';
  const name = 'OPENHUNTERAI';
  const right = '━━━━━━╸';
  const tagline = 'AI ATTACKER-MINDSET PENTEST';
  if (!color) return `  ${left}  ${name}  ${right}\n     ${tagline}`;
  const darkBlue = [[25, 54, 121], [30, 111, 225]];
  const darkTeal = [[37, 184, 210], [28, 100, 134]];
  return `  ${gradientText(left, darkBlue)}  ${gradientText(name, BRAND_PALETTE, true)}  ${gradientText(right, darkTeal)}\n     ${gradientText(tagline, TAGLINE_PALETTE)}`;
}

/** Decode the bundled, non-interlaced 8-bit RGBA brand PNG without CLI dependencies. */
export function decodeRgbaPng(data) {
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG');
  let width = 0;
  let height = 0;
  const idat = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error('Unsupported PNG format');
    }
    if (type === 'IDAT') idat.push(body);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (!width || !height || !idat.length) throw new Error('Incomplete PNG');
  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const a = Math.abs(p - left);
        const b = Math.abs(p - up);
        const c = Math.abs(p - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      } else if (filter !== 0) throw new Error('Unsupported PNG filter');
      pixels[y * stride + x] = (value + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

export function renderTerminalArt({ columns = 80, rows = 32, color = true } = {}) {
  const { width, height, pixels } = decodeRgbaPng(readFileSync(IMAGE));
  const maxRows = Math.max(12, Math.min(27, rows - 8));
  const countX = Math.max(34, Math.min(72, columns - 4, Math.floor(maxRows * 2 * width / height)));
  const countY = Math.max(12, Math.min(maxRows, Math.round(countX * height / (2 * width))));
  const sample = (x, y, totalRows) => {
    const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / countX));
    const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / totalRows));
    return pixels.subarray((sourceY * width + sourceX) * 4, (sourceY * width + sourceX) * 4 + 4);
  };
  const lines = [];
  for (let y = 0; y < countY; y += 1) {
    let line = '';
    for (let x = 0; x < countX; x += 1) {
      if (color) {
        const top = sample(x, y * 2, countY * 2);
        const bottom = sample(x, y * 2 + 1, countY * 2);
        const topVisible = top[3] >= 60;
        const bottomVisible = bottom[3] >= 60;
        if (!topVisible && !bottomVisible) { line += '\x1b[0m '; continue; }
        if (topVisible && bottomVisible) {
          line += `\x1b[38;2;${top[0]};${top[1]};${top[2]}m\x1b[48;2;${bottom[0]};${bottom[1]};${bottom[2]}m▀`;
        } else if (topVisible) {
          line += `\x1b[49m\x1b[38;2;${top[0]};${top[1]};${top[2]}m▀`;
        } else {
          line += `\x1b[49m\x1b[38;2;${bottom[0]};${bottom[1]};${bottom[2]}m▄`;
        }
        continue;
      }
      const [r, g, b, alpha] = sample(x, y, countY);
      if (alpha < 60) { line += ' '; continue; }
      const luminance = 0.21 * r + 0.72 * g + 0.07 * b;
      const inVisor = y / countY > 0.4 && y / countY < 0.7 &&
        x / countX > 0.27 && x / countX < 0.73;
      const glyph = inVisor && luminance < 35 ? ' ' :
        luminance < 35 ? '#' : luminance < 80 ? '+' : '@';
      line += glyph;
    }
    lines.push(`${line.trimEnd()}${color ? '\x1b[0m' : ''}`);
  }
  return `\n${lines.join('\n')}\n\n${renderBrand(color)}\n`;
}
