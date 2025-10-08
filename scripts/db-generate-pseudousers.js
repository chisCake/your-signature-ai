import { generateData } from './fullname-generator.js';
import { createSupabaseClient } from './utils.js';  

const args = process.argv.slice(2);
let menCount = 10;
let womenCount = 10;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--men' || args[i] === '-m') {
        menCount = parseInt(args[i + 1]) || 10;
        i++;
    } else if (args[i] === '--women' || args[i] === '-w') {
        womenCount = parseInt(args[i + 1]) || 10;
        i++;
    }
}

console.log(`Generating ${menCount} men and ${womenCount} women...`);

const supabase = createSupabaseClient();

try {
    const { mData, fData } = generateData(menCount, womenCount);

    for (const name of mData) {
        const { error } = await supabase
            .from('pseudousers')
            .insert({
                name: name,
                source: 'generated'
            });

        if (error) {
            console.error(`Ошибка при вставке мужского имени "${name}":`, error);
        }
    }

    for (const name of fData) {
        const { error } = await supabase
            .from('pseudousers')
            .insert({
                name: name,
                source: 'generated'
            });

        if (error) {
            console.error(`Ошибка при вставке женского имени "${name}":`, error);
        }
    }

    console.log('Псевдопользователи успешно созданы!');

} catch (error) {
    console.error('Ошибка при работе с базой данных:', error);
    process.exit(1);
}
