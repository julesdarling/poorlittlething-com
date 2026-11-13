import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const publicDirectory = new URL('../public/', import.meta.url);
const products = JSON.parse(await readFile(new URL('products.json', publicDirectory), 'utf8'));
const ids = new Set();
const links = new Set();

if (!Array.isArray(products) || products.length === 0) throw new Error('The catalogue is empty.');

for (const product of products) {
  for (const key of ['id', 'designId', 'title', 'category']) {
    if (typeof product[key] !== 'string' || !product[key].trim()) throw new Error(`Missing product ${key}.`);
  }
  const link = new URL(product.cultsUrl);
  if (link.origin !== 'https://cults3d.com' || !link.pathname.startsWith('/en/3d-model/')) {
    throw new Error(`Invalid Cults3D buyer link: ${product.id}`);
  }
  if (ids.has(product.designId) || links.has(link.href)) throw new Error(`Duplicate product: ${product.id}`);
  ids.add(product.designId);
  links.add(link.href);
  if (Object.keys(product).some(key => /^stl|^download/i.test(key))) {
    throw new Error(`Local print-download metadata remains: ${product.id}`);
  }
  for (const key of ['model', 'poster', 'background']) {
    if (!product[key]) throw new Error(`Missing ${key}: ${product.id}`);
    const asset = new URL(product[key], 'https://poorlittlething.com');
    if (asset.origin !== 'https://poorlittlething.com') throw new Error(`Unexpected asset origin: ${product.id}`);
    await access(new URL(`.${asset.pathname}`, publicDirectory));
  }
}

async function checkDirectory(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = join(prefix, entry.name);
    if ((prefix === '' && entry.name === 'downloads') || entry.name === 'bundles-manifest.json' || /\.(zip|stl|3mf|gcode)$/i.test(entry.name)) {
      throw new Error(`Print download found in public assets: ${relative}`);
    }
    if (entry.isDirectory()) await checkDirectory(new URL(`${entry.name}/`, directory), relative);
  }
}

await checkDirectory(publicDirectory);
console.log(`Verified ${products.length} Cults3D links and gallery assets; no local print downloads.`);
