import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const directoryPath = path.dirname(__filename);

const soundMap = {};

const SHARP_TO_FLAT_LETTER = {
    A: 'B',
    C: 'D',
    D: 'E',
    F: 'G',
    G: 'A',
};

function cleanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            cleanAndMapDirectory(filePath);
        } else {
            const ext = path.extname(file).toLowerCase();
            const name = path.basename(file, ext);
            if (name !== 'name-audio') {
                soundMap[name] = `${name}.mp3`;
            }
        }
    });
}

console.log("Starting name extraction");
cleanDirectory(directoryPath);

const entries = [];
const sharpNamePattern = /^([A-G])s(\d+)$/;

for (const [name, filename] of Object.entries(soundMap)) {
    const match = name.match(sharpNamePattern);

    if (match) {
        const [, letter, octave] = match;
        entries.push([`${letter}#${octave}`, filename]);

        const flatLetter = SHARP_TO_FLAT_LETTER[letter];
        if (flatLetter) {
            entries.push([`${flatLetter}b${octave}`, filename]);
        }
    } else {
        entries.push([name, filename]);
    }
}

let str = '{\n';
for (let i = 0; i < entries.length; i += 5) {
    const chunk = entries.slice(i, i + 5);
    const line = chunk
        .map(([key, filename]) => `${key.includes('#') ? `"${key}"` : key}: "${filename}"`)
        .join(', ');
    str += `  ${line},\n`;
}
str += '}';

console.log(str);