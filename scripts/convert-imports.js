import { readFile, writeFile, readdir, stat } from "fs/promises";
import { resolve as _resolve, relative, sep, dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Script to convert all import paths in `.tsx` files from the `@/` alias
 * to proper relative paths.
 *
 * Usage:
 *   node scripts/convert-imports.js
 */
(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = _resolve(__dirname, "..", "vercel-site");

  /**
   * Returns a relative path from `from` to `to` with POSIX separators and a leading `./` or `../`.
   */
  function toRelativeImport(fromDir, absoluteTarget) {
    let rel = relative(fromDir, absoluteTarget);
    // Ensure POSIX separators and leading ./ or ../
    rel = rel.split(sep).join("/");
    if (!rel.startsWith(".")) {
      rel = "./" + rel;
    }
    return rel;
  }

  /**
   * Process a single file.
   */
  async function processFile(filePath) {
    console.log(`Processing file: ${filePath}`);
    let content = await readFile(filePath, "utf8");
    const dir = dirname(filePath);

    // Regex to capture import statements starting with @/
    const importRegex = /from\s+["']@\/(.+?)["']/g;
    let hasChange = false;
    let matchCount = 0;
    
    content = content.replace(importRegex, (match, subPath) => {
      matchCount++;
      console.log(`Found alias import: ${match} -> ${subPath}`);
      const absoluteTarget = join(projectRoot, subPath);
      const rel = toRelativeImport(dir, absoluteTarget);
      console.log(`Converting to relative: ${rel}`);
      hasChange = true;
      return `from '${rel}'`;
    });

    console.log(`Found ${matchCount} alias imports in ${relative(projectRoot, filePath)}`);
    
    if (hasChange) {
      await writeFile(filePath, content, "utf8");
      console.log(`✅ Updated: ${relative(projectRoot, filePath)}`);
    } else {
      console.log(`⏭️  No changes needed: ${relative(projectRoot, filePath)}`);
    }
  }

  async function getAllTsx() {
    const files = [];
    
    async function findTsxFiles(dir) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await findTsxFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.log(`Error reading directory ${dir}:`, error.message);
      }
    }
    
    console.log(`Searching for .tsx files in: ${projectRoot}`);
    await findTsxFiles(projectRoot);
    console.log(`Found ${files.length} .tsx files:`, files);
    return files;
  }

  const files = await getAllTsx();
  console.log(`Found ${files.length} .tsx files to process`);
  console.log(`Project root: ${projectRoot}`);
  
  for (const file of files) {
    await processFile(file);
  }
  
  console.log("✅ Alias import conversion completed.");
})();