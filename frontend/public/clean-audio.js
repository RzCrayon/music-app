import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const directoryPath = path.dirname(__filename);

function cleanDirectory(dir) {
    fs.readdir(dir, (err, files) => {
        if (err) return console.error('Error reading directory: ' + err);

        files.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                // Dive into subfolders recursively
                cleanDirectory(filePath);
            } else {
                const ext = path.extname(file).toLowerCase();
                if (ext === '.ogg' || ext === '.wav') {
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted: ${path.relative(directoryPath, filePath)}`);
                    } catch (fail) {
                        console.error(`Failed to delete ${file}:`, fail.message);
                    }
                }
            }
        });
    });
}

console.log("Starting deep cleanup of .ogg and .wav files...");
cleanDirectory(directoryPath);