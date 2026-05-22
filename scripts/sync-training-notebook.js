/**
 * Copy training/main.ipynb -> training/main.example.ipynb with cleared outputs.
 * Use before committing notebook structure changes (main.ipynb is gitignored).
 *
 * Usage: npm run notebook:sync
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const DEFAULT_SOURCE = resolve(repoRoot, 'training/main.ipynb');
const DEFAULT_TARGET = resolve(repoRoot, 'training/main.example.ipynb');

function parseArgs() {
  const args = process.argv.slice(2);
  let source = DEFAULT_SOURCE;
  let target = DEFAULT_TARGET;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      source = resolve(repoRoot, args[++i]);
    } else if (args[i] === '--target' && args[i + 1]) {
      target = resolve(repoRoot, args[++i]);
    } else if (args[i] === '-h' || args[i] === '--help') {
      console.log(`Usage: npm run notebook:sync [-- --source PATH --target PATH]

Defaults:
  source  training/main.ipynb
  target  training/main.example.ipynb`);
      process.exit(0);
    }
  }

  return { source, target };
}

function clearNotebook(nb) {
  if (!Array.isArray(nb.cells)) {
    throw new Error('Invalid notebook: missing cells array');
  }

  let clearedOutputs = 0;

  for (const cell of nb.cells) {
    if (cell.cell_type !== 'code') continue;

    if (Array.isArray(cell.outputs) && cell.outputs.length > 0) {
      clearedOutputs += cell.outputs.length;
    }
    cell.outputs = [];
    cell.execution_count = null;
  }

  return clearedOutputs;
}

function main() {
  const { source, target } = parseArgs();

  if (!existsSync(source)) {
    console.error(`Source not found: ${source}`);
    console.error('Create training/main.ipynb (e.g. from Colab) and run again.');
    process.exit(1);
  }

  const raw = readFileSync(source, 'utf8');
  let nb;
  try {
    nb = JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to parse notebook JSON: ${e.message}`);
    process.exit(1);
  }

  const clearedOutputs = clearNotebook(nb);

  writeFileSync(target, `${JSON.stringify(nb, null, 1)}\n`, 'utf8');

  const cellCount = nb.cells?.length ?? 0;
  console.log(`Wrote ${target}`);
  console.log(`  cells: ${cellCount}, cleared output blobs: ${clearedOutputs}`);
}

main();
