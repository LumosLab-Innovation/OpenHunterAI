import { cpSync, existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const source = join(root, 'site');
const frontend = join(root, 'frontend');
const output = join(frontend, 'dist');

// Only replace the generated artifact inside this checkout, never a linked directory.
if (realpathSync(frontend) !== frontend || (existsSync(output) && lstatSync(output).isSymbolicLink())) {
  throw new Error('Public output must be the checkout frontend/dist directory');
}
if (!existsSync(join(source, 'index.html'))) throw new Error('Public landing site/index.html is missing');
rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });
console.log(`Built public landing: ${output}`);
