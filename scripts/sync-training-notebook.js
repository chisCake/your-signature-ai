/**
 * Sync training/main.ipynb <-> training/main.example.ipynb
 *
 * main -> example: clears code cell outputs (for git commit; main.ipynb is gitignored)
 * example -> main: copies as-is (refresh local working notebook from tracked template)
 *
 * Usage:
 *   npm run notebook:main-to-example
 *   npm run notebook:example-to-main
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const MAIN = resolve(repoRoot, 'training/main.ipynb');
const EXAMPLE = resolve(repoRoot, 'training/main.example.ipynb');

const DIRECTIONS = {
  'main-to-example': { source: MAIN, target: EXAMPLE, clearOutputs: true },
  'example-to-main': { source: EXAMPLE, target: MAIN, clearOutputs: false },
};

function parseArgs() {
  const args = process.argv.slice(2);
  let direction = null;
  let source = null;
  let target = null;
  let clearOutputs = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--direction' && args[i + 1]) {
      direction = args[++i];
    } else if (arg === '--source' && args[i + 1]) {
      source = resolve(repoRoot, args[++i]);
    } else if (arg === '--target' && args[i + 1]) {
      target = resolve(repoRoot, args[++i]);
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg in DIRECTIONS) {
      direction = arg;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!direction) {
    console.error('Missing direction. Use main-to-example or example-to-main.');
    printHelp();
    process.exit(1);
  }

  const preset = DIRECTIONS[direction];
  if (!preset) {
    console.error(`Unknown direction: ${direction}`);
    printHelp();
    process.exit(1);
  }

  return {
    direction,
    source: source ?? preset.source,
    target: target ?? preset.target,
    clearOutputs: clearOutputs ?? preset.clearOutputs,
  };
}

function printHelp() {
  console.log(`Usage:
  npm run notebook:main-to-example
  npm run notebook:example-to-main

Or:
  node scripts/sync-training-notebook.js <main-to-example|example-to-main> [--source PATH --target PATH]

Directions:
  main-to-example   training/main.ipynb -> training/main.example.ipynb (clears outputs)
  example-to-main   training/main.example.ipynb -> training/main.ipynb (copy as-is)`);
}

function clearNotebookOutputs(nb) {
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
  const { direction, source, target, clearOutputs } = parseArgs();

  if (!existsSync(source)) {
    console.error(`Source not found: ${source}`);
    if (direction === 'example-to-main') {
      console.error('Ensure training/main.example.ipynb exists in the repo.');
    } else {
      console.error('Create training/main.ipynb (e.g. from Colab) and run again.');
    }
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

  let clearedOutputs = 0;
  if (clearOutputs) {
    clearedOutputs = clearNotebookOutputs(nb);
  }

  writeFileSync(target, `${JSON.stringify(nb, null, 1)}\n`, 'utf8');

  const cellCount = nb.cells?.length ?? 0;
  console.log(`[${direction}] Wrote ${target}`);
  console.log(`  from: ${source}`);
  console.log(`  cells: ${cellCount}${clearOutputs ? `, cleared output blobs: ${clearedOutputs}` : ''}`);
}

main();
