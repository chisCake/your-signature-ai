import { createSupabaseClient } from './utils.js';
import { readdirSync } from 'fs';
import path from 'path';
import { readFileSync } from 'fs';

// Supabase client
const supabase = createSupabaseClient();

// Base paths
const DEFAULT_DSDB_PATH = './colab-training/datasets/DeepSignDB/';
const customDSDBPath = process.argv[2];
const dsdbPath = customDSDBPath || DEFAULT_DSDB_PATH;

// Split directories
const developmentPath = path.join(dsdbPath, 'Development');
const evaluationPath = path.join(dsdbPath, 'Evaluation');

// Stylus subdirs
const devStylusPath = path.join(developmentPath, 'stylus');
const evalStylusPath = path.join(evaluationPath, 'stylus');

// Файлы stylus
const devStylusFiles = readdirSync(devStylusPath);
const evalStylusFiles = readdirSync(evalStylusPath);

function getDistinctUsers(files) {
  return new Set(files.map(f => f.split('_')[0]));
}

const devStylusUsers = getDistinctUsers(devStylusFiles);
const evalStylusUsers = getDistinctUsers(evalStylusFiles);

const lastDevStylusUserIndex = [...devStylusUsers]
  .map(u => Number(u.slice(-4)))
  .sort((a, b) => a - b)
  .pop();

// --- CONSTANTS ---
const USERS_LIMIT = 300; // how many users from each split to process for now
const STYLUS_PRESSURE_MAX = 1023; // max value in raw files used for normalisation
const FINGER_PRESSURE_MAX = 255; // max value in raw files used for normalisation

// --- HELPERS ---

/**
 * Parse one DeepSignDB stylus .txt file.
 * @param {string} filePath Absolute path to the file
 * @returns {string} CSV format with header "t,x,y,p" and data rows
 */
function parseStylusFile(filePath) {
    const raw = readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
    // First line — number of points, ignore but slice(1)
    const points = raw.slice(1).map(line => {
        const [x, y, ts, _c4, _c5, p] = line.trim().split(/\s+/).map(Number);
        const pressure = +(p / STYLUS_PRESSURE_MAX).toFixed(4); // normalise 0..1, round a bit
        return `${ts},${x},${y},${pressure}`;
    });
    
    // Add header row
    return "t,x,y,p\n" + points.join("\n");
}

/** Insert pseudouser, returns its DB id */
async function insertPseudouser(name) {
    const { data, error } = await supabase
        .from('pseudousers')
        .insert({ name, source: 'dsdb' })
        .select('id')
        .single();
    if (error) {
        throw new Error(`Ошибка вставки pseudouser ${name}: ${error.message}`);
    }
    return data.id;
}

/** Insert genuine signature */
async function insertGenuine({ pseudouserId, csvData, fileName }) {
    const { error } = await supabase.from('genuine_signatures').insert({
        pseudouser_id: pseudouserId,
        features_table: csvData,
        input_type: 'pen',
        name: fileName,
        user_for_forgery: true,
        mod_for_forgery: true,
        mod_for_dataset: true
    });
    if (error) {
        console.error(`Ошибка вставки genuine ${fileName}:`, error);
    }
}

/** Insert forged signature (model_id может быть NULL) */
async function insertForged({ originalPseudouserId, csvData, fileName }) {
    const { error } = await supabase.from('forged_signatures').insert({
        original_pseudouser_id: originalPseudouserId,
        features_table: csvData,
        input_type: 'pen',
        name: fileName,
        mod_for_dataset: true
    });
    if (error) {
        console.error(`Ошибка вставки forged ${fileName}:`, error);
    }
}

async function main() {
    // 1. Подготовка списков пользователей
    const devUsers = [...devStylusUsers].sort().slice(0, USERS_LIMIT);
    const evalUsersRaw = [...evalStylusUsers].sort().slice(0, USERS_LIMIT);

    // 2. Создаём маппинг «старое имя → новое имя» для Evaluation
    let nextIdx = lastDevStylusUserIndex + 1;
    const evalNameMap = new Map();
    for (const u of evalUsersRaw) {
        evalNameMap.set(u, `u${String(nextIdx).padStart(4, '0')}`);
        nextIdx += 1;
    }

    const userIdMap = new Map(); // key: original filename user (u####) → db id

    // helper to process files given current mapping
    const processFiles = async (files, basePath) => {
        const totalFiles = files.length;
        let processedCount = 0;
        
        for (const file of files) {
            const match = file.match(/^(u\d{4})_(g|s)_.+\.txt$/i);
            if (!match) continue;
            const fileUser = match[1];
            if (!userIdMap.has(fileUser)) continue;

            const type = match[2]; // g | s
            const filePath = path.join(basePath, file);
            const csvData = parseStylusFile(filePath);

            if (type === 'g') {
                await insertGenuine({
                    pseudouserId: userIdMap.get(fileUser),
                    csvData,
                    fileName: file
                });
            } else if (type === 's') {
                await insertForged({
                    originalPseudouserId: userIdMap.get(fileUser),
                    csvData,
                    fileName: file
                });
            }
            
            processedCount++;
            
            // Выводим прогресс каждые 100 элементов
            if (processedCount % 100 === 0) {
                console.log(`${processedCount}/${totalFiles}`);
            }
        }
        
        // Выводим финальный прогресс если не кратно 100
        if (processedCount % 100 !== 0) {
            console.log(`${processedCount}/${totalFiles}`);
        }
    };

    // --- DEV phase ---
    for (const original of devUsers) {
        const id = await insertPseudouser(original);
        userIdMap.set(original, id);
        console.log(`Pseudouser created: ${original} → ${id}`);
    }

    await processFiles(devStylusFiles, devStylusPath);

    // --- EVAL phase ---
    for (const original of evalUsersRaw) {
        const newName = evalNameMap.get(original);
        const id = await insertPseudouser(newName);
        userIdMap.set(original, id);
        console.log(`Pseudouser created (eval): ${original} → ${newName} → ${id}`);
    }

    await processFiles(evalStylusFiles, evalStylusPath);

    console.log('Загрузка завершена');
}

main().catch(err => {
    console.error('Необработанная ошибка:', err);
    process.exit(1);
});


