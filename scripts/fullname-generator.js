import { readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const surnamesPath = `${__dirname}/surnames_table.jsonl`;
const namesPath = `${__dirname}/names_table.jsonl`;
const midnamesPath = `${__dirname}/midnames_table.jsonl`;

function parseJsonl(filePath) {
    const data = [];
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum].trim();
        if (line) {
            try {
                data.push(JSON.parse(line));
            } catch (e) {
                console.log(`Ошибка в строке ${lineNum + 1} файла ${filePath}: ${e.message}`);
                continue;
            }
        }
    }
    return data;
}

function getNamesByGender(namesData, gender = 'm') {
    return namesData.filter(name => name.gender === gender);
}

/**
 * Фильтрует фамилии по полу.
 * gender: 'm' для мужских фамилий, 'f' для женских
 */
function getSurnamesByGender(surnamesData, gender = 'm') {
    return surnamesData.filter(surname => surname.gender === gender);
}

function getMidnamesByGender(midnamesData, gender = 'm') {
    return midnamesData.filter(midname => midname.gender === gender);
}

function getRandomName(namesData, gender = 'm') {
    const filteredNames = getNamesByGender(namesData, gender);
    if (filteredNames.length === 0) {
        return null;
    }
    return filteredNames[Math.floor(Math.random() * filteredNames.length)];
}

function generateFullName(namesData, surnamesData, midnamesData, gender = 'm') {
    const name = getRandomName(namesData, gender);
    const surname = surnamesData.length > 0 ? surnamesData[Math.floor(Math.random() * surnamesData.length)] : null;
    const midname = midnamesData.length > 0 ? midnamesData[Math.floor(Math.random() * midnamesData.length)] : null;
    
    if (!name) {
        return null;
    }
    
    const fullNameParts = [];
    
    if (surname) {
        fullNameParts.push(surname.text);
    }
    if (name) {
        fullNameParts.push(name.text);
    }
    if (midname) {
        fullNameParts.push(midname.text);
    }
    
    return fullNameParts.join(' ');
}

const surnames = parseJsonl(surnamesPath);
const names = parseJsonl(namesPath);
const midnames = parseJsonl(midnamesPath);

console.log(`Загружено имен: ${names.length}`);
console.log(`Загружено фамилий: ${surnames.length}`);
console.log(`Загружено отчеств: ${midnames.length}`);

function generateData(mAmount, fAmount) {
    const mNames = getNamesByGender(names, 'm');
    const fNames = getNamesByGender(names, 'f');
    const mSurnames = getSurnamesByGender(surnames, 'm');
    const fSurnames = getSurnamesByGender(surnames, 'f');
    const mMidnames = getMidnamesByGender(midnames, 'm');
    const fMidnames = getMidnamesByGender(midnames, 'f');
    
    const mData = [];
    const fData = [];
    
    for (let i = 0; i < mAmount; i++) {
        const fullName = generateFullName(mNames, mSurnames, mMidnames, 'm');
        mData.push(fullName);
    }
    
    for (let i = 0; i < fAmount; i++) {
        const fullName = generateFullName(fNames, fSurnames, fMidnames, 'f');
        fData.push(fullName);
    }
    
    return { mData, fData };
}

export {
    parseJsonl,
    getNamesByGender,
    getSurnamesByGender,
    getMidnamesByGender,
    getRandomName,
    generateFullName,
    generateData,
    surnames,
    names,
    midnames
};