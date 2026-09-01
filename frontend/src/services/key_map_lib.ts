import type { Clefs, Instruments } from './types'

// export const img_dimensions = { width: '400px', height: '100px' }

export const getImgDimensionsFor = (instrument: Instruments) => {
    switch (instrument) {
        case 'piano':
            return { width: 400, height: 100 };
        default:
            return { width: 400, height: 200 };
    }
}

const piano_map: Record<string, number> = {
    // --- Octave 0 ---
    'A0': 1,
    'A#0': 2, 'B-0': 2,
    'B0': 3,

    // --- Octave 1 ---
    'C1': 4,
    'C#1': 5, 'D-1': 5,
    'D1': 6,
    'D#1': 7, 'E-1': 7,
    'E1': 8,
    'F1': 9,
    'F#1': 10, 'G-1': 10,
    'G1': 11,
    'G#1': 12, 'A-1': 12,
    'A1': 13,
    'A#1': 14, 'B-1': 14,
    'B1': 15,

    // --- Octave 2 ---
    'C2': 16,
    'C#2': 17, 'D-2': 17,
    'D2': 18,
    'D#2': 19, 'E-2': 19,
    'E2': 20,
    'F2': 21,
    'F#2': 22, 'G-2': 22,
    'G2': 23,
    'G#2': 24, 'A-2': 24,
    'A2': 25,
    'A#2': 26, 'B-2': 26,
    'B2': 27,

    // --- Octave 3 ---
    'C3': 28,
    'C#3': 29, 'D-3': 29,
    'D3': 30,
    'D#3': 31, 'E-3': 31,
    'E3': 32,
    'F3': 33,
    'F#3': 34, 'G-3': 34,
    'G3': 35,
    'G#3': 36, 'A-3': 36,
    'A3': 37,
    'A#3': 38, 'B-3': 38,
    'B3': 39,

    // --- Octave 4 (Middle Octave) ---
    'C4': 40, // Middle C
    'C#4': 41, 'D-4': 41,
    'D4': 42,
    'D#4': 43, 'E-4': 43,
    'E4': 44,
    'F4': 45,
    'F#4': 46, 'G-4': 46,
    'G4': 47,
    'G#4': 48, 'A-4': 48,
    'A4': 49,
    'A#4': 50, 'B-4': 50,
    'B4': 51,

    // --- Octave 5 ---
    'C5': 52,
    'C#5': 53, 'D-5': 53,
    'D5': 54,
    'D#5': 55, 'E-5': 55,
    'E5': 56,
    'F5': 57,
    'F#5': 58, 'G-5': 58,
    'G5': 59,
    'G#5': 60, 'A-5': 60,
    'A5': 61,
    'A#5': 62, 'B-5': 62,
    'B5': 63,

    // --- Octave 6 ---
    'C6': 64,
    'C#6': 65, 'D-6': 65,
    'D6': 66,
    'D#6': 67, 'E-6': 67,
    'E6': 68,
    'F6': 69,
    'F#6': 70, 'G-6': 70,
    'G6': 71,
    'G#6': 72, 'A-6': 72,
    'A6': 73,
    'A#6': 74, 'B-6': 74,
    'B6': 75,

    // --- Octave 7 ---
    'C7': 76,
    'C#7': 77, 'D-7': 77,
    'D7': 78,
    'D#7': 79, 'E-7': 79,
    'E7': 80,
    'F7': 81,
    'F#7': 82, 'G-7': 82,
    'G7': 83,
    'G#7': 84, 'A-7': 84,
    'A7': 85,
    'A#7': 86, 'B-7': 86,
    'B7': 87,

    // --- Octave 8 ---
    'C8': 88
};

const trumpet_map: Record<string, number> = {
    'F#3': 7, 'G-3': 7, // 1-2-3
    'G3': 5,            // 1-3
    'G#3': 4, 'A-3': 4, // 2-3
    'A3': 6,            // 1-2
    'A#3': 1, 'B-3': 1, // 1
    'B3': 2,            // 2

    'C4': 0,            // Open
    'C#4': 7, 'D-4': 7, // 1-2-3
    'D4': 5,            // 1-3
    'D#4': 4, 'E-4': 4, // 2-3
    'E4': 6,            // 1-2
    'F4': 1,            // 1
    'F#4': 2, 'G-4': 2, // 2
    'G4': 0,            // Open
    'G#4': 4, 'A-4': 4, // 2-3
    'A4': 6,            // 1-2
    'A#4': 1, 'B-4': 1, // 1
    'B4': 2,            // 2

    'C5': 0,            // Open
    'C#5': 6, 'D-5': 6, // 1-2
    'D5': 1,            // 1
    'D#5': 2, 'E-5': 2, // 2
    'E5': 0,            // Open
    'F5': 1,            // 1
    'F#5': 2, 'G-5': 2, // 2
    'G5': 0,            // Open
    'G#5': 4, 'A-5': 4, // 2-3
    'A5': 6,            // 1-2
    'A#5': 1, 'B-5': 1, // 1
    'B5': 2,            // 2
    'C6': 0             // Open
};

export const INSTRUMENT_CLEF_TABLE: Record<Instruments, Clefs[]> = {
    'piano': ['Treble', 'Bass'],
    'guitar': ['Treble'], //should really be octave treble but we don't support that yet 
    'trumpet': ['Treble'],
    'viola': ['Alto'],
    'violin': ['Treble'],
    'cello': ['Bass', 'Tenor', 'Treble'],
    'flute': ['Treble'],
    'saxophone': ['Treble'],

}

export function find_pic_idx(instrument: Instruments, pitch: string) {
    switch (instrument) {
        case 'piano': return piano_map[pitch];
        case 'trumpet': return trumpet_map[pitch];
        default: return 0;
    }
}