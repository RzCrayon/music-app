import type { Accidentals, Clefs, Note, NoteDisplay, NotePitch, ParsedTimeSig, PitchedPitch } from "../services/types";
import './SheetMusicRenderer.css'
import { isValidElement, useEffect, useMemo, useState } from "react";

/*
this only exists to generate relevant display data for each note
the actual notes arent every edited in their display data form and 
then converted back into traditional notes... the direction of logic is
always the Note[] itself is editted and the display data for each note
is always derived from that
*/

//line 5 in treble is f5
//in explaining clefs: bass is used for any note below c4 in treble... 
//alto is the clef between bass and treble if the notes hover around c4 used pretty much only for violas
const CLEF_OFFSETS: Record<Clefs, number> = {
    'Treble': 0,
    'Bass': 12,
    'Alto': 6,
    'Tenor': 8
};

const CLEF_RANGES: Record<Clefs, { min: number, max: number }> = {
    //each capped at 2 lines above 2 lines below
    'Treble': {
        min: calculate_treble_ypos('A3'),
        max: calculate_treble_ypos('C6')
    },

    'Bass': {
        min: correct_ypos_for_clef(calculate_treble_ypos('C2'), 'Bass'),
        max: correct_ypos_for_clef(calculate_treble_ypos('E4'), 'Bass'),
    },

    'Alto': {
        min: correct_ypos_for_clef(calculate_treble_ypos('G5'), 'Alto'),
        max: correct_ypos_for_clef(calculate_treble_ypos('F3'), 'Alto')
    },

    'Tenor': {
        min: correct_ypos_for_clef(calculate_treble_ypos('E5'), 'Tenor'),
        max: correct_ypos_for_clef(calculate_treble_ypos('D3'), 'Tenor')
    }
}

const CLEF_REF_LIST: Clefs[] = ['Treble', 'Alto', 'Tenor', 'Bass'];

const MULTIPLE_CLEF_SHRINK_SIZE = 3;

export const VALID_DURS = [0.25, 0.5, 1, 2, 4];
export const DUR_NAMES = ['Sixteenth', 'Eighth', 'Quarter', 'Half', 'Whole'];

const NOTE_SVGS_UP: Record<number, React.ReactNode> = {
    0.25: <text key="sixteenth-up" className="note">{'\uE1D9'}</text>,
    0.5: <text key="eighth-up" className="note">{'\uE1D7'}</text>,
    1: <text key="quarter-up" className="note">{'\uE1D5'}</text>,
    2: <text key="half-up" className="note">{'\uE1D3'}</text>,
    4: <text key="whole-up" className="note">{'\uE1D2'}</text>
};

const NOTE_SVGS_DOWN: Record<number, React.ReactNode> = {
    0.25: <text key="sixteenth-down" className="note">{'\uE1DA'}</text>,
    0.5: <text key="eighth-down" className="note">{'\uE1D8'}</text>,
    1: <text key="quarter-down" className="note">{'\uE1D6'}</text>,
    2: <text key="half-down" className="note">{'\uE1D4'}</text>,
    4: <text key="whole-down" className="note">{'\uE1D2'}</text>
};

const REST_SVGS: Record<number, React.ReactNode> = {
    0.25: <text key="sixteenth-rest" className="note">{'\uE4E7'}</text>,
    0.5: <text key="eighth-rest" className="note">{'\uE4E6'}</text>,
    1: <text key="quarter-rest" className="note">{'\uE4E5'}</text>,
    2: <text key="half-rest" className="note">{'\uE4E4'}</text>,
    4: <text key="whole-rest" className="note">{'\uE4E3'}</text>
};

const JOINED_NOTE_SVG = <text key='joined-note' className="note">{'\uE0A4'}</text>
const LEFT_JOINED_NOTE_SVG = <text key='left-joined-note' x={25} className="note">{'\uE0A4'}</text>

export const STEMLESS_NOTE_SVGS: Record<number, React.ReactNode> = {
    0.25: <text key='stemless-sixteenth-note' className="note">{'\uE0A4'}</text>,
    0.5: <text key='stemless-eighth-note' className="note">{'\uE0A4'}</text>,
    1: <text key='stemless-quarter-note' className="note">{'\uE0A4'}</text>,
    2: <text key='stemless-half-note' className="note">{'\uE0A3'}</text>,
}

export const LEFT_STEMLESS_NOTE_SVGS: Record<number, React.ReactNode> = {
    0.25: <text key='left-stemless-sixteenth-note' className="note">{'\uE0A4'}</text>,
    0.5: <text key='left-stemless-eighth-note' className="note">{'\uE0A4'}</text>,
    1: <text key='left-stemless-quarter-note' className="note">{'\uE0A4'}</text>,
    2: <text key='left-stemless-half-note' className="note">{'\uE0A3'}</text>,
}

export const STEMLESS_NOTE_FLAG_SVGS: Record<string, React.ReactNode> = {
    '0.25-down': <text key='stemless-stem-sixteenth-note-down' className="note">{'\uE243'}</text>,
    '0.5-down': <text key='stemless-stem-eighth-note-down' className="note">{'\uE241'}</text>,
    '0.25-up': <text key='stemless-stem-sixteenth-note-up' className="note">{'\uE242'}</text>,
    '0.5-up': <text key='stemless-stem-eighth-note-up' className="note">{'\uE240'}</text>,
}

export const CLEF_SVGS: Record<string, React.ReactNode> = {
    'Treble': <text key="treble-clef" y={35} className="clef">{'\uE050'}</text>,
    'Bass': <text key="bass-clef" y={-30} className="clef">{'\uE062'}</text>,
    'Alto': <text key="alto-clef" className="clef">{'\uE05c'}</text>,
    //fix the -30
    'Tenor': <text key="tenor-clef" y={-30} className="clef">{'\uE05c'}</text>,
}

const ACCIDENTAL_SVGS: Record<string, React.ReactNode> = {
    'flat': <text y={-30} key="accidental-flat" className="note accidental">{'\uE260'}</text>,
    'sharp': <text x={-25} key="accidental-sharp" className="note accidental">{'\uE262'}</text>,
    'natural': <text y={-30} key="accidental-natural" className="note accidental">{'\uE261'}</text>,
    'dot': (
        <text
            key="accidental-dot"
            className="note"
            x={40}
            y={10}
        >
            {'\uE1E7'}
        </text>
    ),
    'whole-dot': (
        <text
            key="accidental-dot"
            className="note"
            x={55}
            y={20}
        >
            {'\uE1E7'}
        </text>
    )
};

const ACCIDENTAL_SVGS_LEFT_VARIATIONS: Record<string, React.ReactNode> = {
    'accidental-flat': <text y={-30} x={65} key="accidental-flat" className="note accidental">{'\uE260'}</text>,
    'accidental-sharp': <text x={65} key="accidental-sharp" className="note accidental">{'\uE262'}</text>,
    'accidental-natural': <text y={-30} key="accidental-natural" className="note accidental">{'\uE261'}</text>,
};

export const TIME_SIG_GLYPHS: Record<number, string> = {
    0: '\uE080',
    1: '\uE081',
    2: '\uE082',
    3: '\uE083',
    4: '\uE084',
    5: '\uE085',
    6: '\uE086',
    7: '\uE087',
    8: '\uE088',
    9: '\uE089',
};

export const time_sig_svg = (num: number) => {
    const glyphs = num
        .toString()
        .split('')
        .map(digit => TIME_SIG_GLYPHS[parseInt(digit, 10)] || '')
        .join('');

    return (
        <text
            className="time-sig"
            textAnchor="middle"
            dominantBaseline="central"
        >
            {glyphs}
        </text>
    );
};

//dangerous now 
const REST_REL_YPOS = 4;

export function find_next_avail_pitch(pitches: string[], clef: Clefs): string {
    const letters = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
    const octaves = [6, 5, 4, 3, 2, 1];

    let cleaned_pitches = pitches.map((pitch) => clean_pitch(pitch));
    const used_pitches = new Set(cleaned_pitches);

    const offset = CLEF_OFFSETS[clef] ?? 0;

    const maxAllowedScore = 35 - offset;
    const minAllowedScore = 21 - offset;

    for (const octave of octaves) {
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            const current_pitch = `${letter}${octave}`;

            const currentScore = (octave * 7) + i;

            if (currentScore > maxAllowedScore || currentScore < minAllowedScore) {
                continue;
            }

            if (!used_pitches.has(current_pitch)) {
                return current_pitch;
            }
        }
    }

    if (clef === 'Bass') return 'B1';
    if (clef === 'Alto') return 'F2';
    if (clef === 'Tenor') return 'D2';
    return 'B3';
}

//time signatures: top note is how many notes per measure
//bottom note is what kind of note equals 1 beat 1 = whole note, 2 = half note 4 = quarter note 8 = eighth note 16 = sixteenth note
export function destructure_time_sig(time_sig: string) {
    const sig = {
        numerator: parseInt(time_sig.split('/')[0]),
        denom: parseInt(time_sig.split('/')[1])
    }
    if (isNaN(sig.numerator) || isNaN(sig.denom)) {
        return null;
    }
    if (sig.numerator < 0) {
        return null;
    }
    //power of 2
    if (!(sig.denom > 0 && (sig.denom & (sig.denom - 1)) === 0)) {
        return null;
    }
    return sig;
}

export function calculate_beats_per_measure(parsed_time_sig: ParsedTimeSig) {
    return parsed_time_sig.numerator * (4 / parsed_time_sig.denom);
}

export function clean_pitch(pitch: string) {
    return pitch.replace(/--?|##?/g, '');
}

export function get_accidental(pitch: string): string {
    const match = pitch.match(/[#-]+/);
    return match ? match[0] : "";
}

export function calculate_ypos(pitch: string | null, clef: Clefs) {
    if (!pitch) {
        const rel_rest_pos = convert_pitch_between_clefs('B4', 'Treble', clef);
        const rel_y = calculate_treble_ypos(rel_rest_pos)
        return correct_ypos_for_clef(rel_y, clef);
    }
    return correct_ypos_for_clef(calculate_treble_ypos(pitch), clef);
}

function calculate_treble_ypos(pitch: string) {
    const cleaned_pitch = clean_pitch(pitch);
    const letters = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
    const letter = cleaned_pitch.charAt(0).toUpperCase();
    const octave = parseInt(cleaned_pitch.charAt(1));
    const scale = letters.indexOf(letter) - 3;
    return (5 - octave) * letters.length + scale;
}

function correct_ypos_for_clef(ypos: number, clef: Clefs) {
    return ypos - CLEF_OFFSETS[clef]
}

export function convert_pitch_between_clefs(
    pitch: string,
    from_clef: Clefs,
    to_clef: Clefs,
): string {
    const cleaned = clean_pitch(pitch);
    const accidental = pitch.slice(1, pitch.length - cleaned.length + 1);
    const letter = cleaned.charAt(0).toUpperCase();
    const octave = parseInt(cleaned.charAt(1));

    const letters = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
    const letterIdx = letters.indexOf(letter);

    const treble_ypos = (5 - octave) * 7 + (letterIdx - 3);
    const new_treble_ypos = treble_ypos - (CLEF_OFFSETS[from_clef] - CLEF_OFFSETS[to_clef]);

    // invert calculate_ypos: treble_ypos = (5 - octave) * 7 + (letterIdx - 3)
    const total = new_treble_ypos + 3; // shift so C is 0 within octave
    const new_octave = 5 - Math.floor(total / 7);
    const new_letterIdx = ((total % 7) + 7) % 7;
    const new_letter = letters[new_letterIdx];

    return `${new_letter}${accidental}${new_octave}`;
}

export function get_pitch_from_y(y?: number, clef_type: Clefs = 'Treble') {
    const my_y = y !== undefined ? y : REST_REL_YPOS;

    const letters = ['B', 'A', 'G', 'F', 'E', 'D', 'C'];
    const num_letters = letters.length;

    const treble_ypos = my_y + CLEF_OFFSETS[clef_type];

    const raw_octave_shift = Math.floor((treble_ypos + 3) / num_letters);
    const octave = 5 - raw_octave_shift;

    let scale = ((treble_ypos + 3) % num_letters) - 3;
    if (scale < -3) {
        scale += num_letters;
    }

    const letterIndex = scale + 3;
    const letter = letters[letterIndex];

    return `${letter}${octave}`;
}

export function adjust_pitch(
    pitch: string,
    dir: 'up' | 'down',
    clef: Clefs,
) {
    const ypos = calculate_ypos(pitch, clef);
    const newY = ypos + (dir === 'up' ? -1 : 1);
    if (CLEF_RANGES[clef].max <= newY && CLEF_RANGES[clef].min >= newY) {
        return get_pitch_from_y(newY, clef);
    }
    return pitch;
}

function find_note_type(
    dur: number,
    denom: number,
    rest: boolean,
    ypos: number,
) {
    const entry = 4 * snap_to_valid_dur(dur) / denom;
    if (rest) return REST_SVGS[entry];
    if (ypos < REST_REL_YPOS) return NOTE_SVGS_DOWN[entry];
    return NOTE_SVGS_UP[entry];
}

export function snap_to_valid_dur(dur: number) {
    if (dur <= VALID_DURS[0]) return VALID_DURS[0];
    for (let i = VALID_DURS.length - 1; i >= 0; i--) {
        if (dur >= VALID_DURS[i]) return VALID_DURS[i];
    }
    return VALID_DURS[0];
}

export function dotted(dur: number) {
    if (VALID_DURS.indexOf(dur) === -1) {
        if (snap_to_valid_dur(dur) === 4) return ACCIDENTAL_SVGS['whole-dot']
        return ACCIDENTAL_SVGS['dot'];
    }
    return null;
}

//adapt for chords
export function get_note_display_name(note: Note) {
    const is_dotted = note.type !== 'rest' ? dotted(note.duration) : false;
    const accidental_res = note.type !== 'rest' ? accidental(note.pitches[0].pitch) : '';
    const accidental_name = accidental_res ? accidental_res.type : '';
    return `${is_dotted ? 'Dotted' : ''} ${DUR_NAMES[VALID_DURS.indexOf(snap_to_valid_dur(note.duration))]} ${note.type === 'rest' ? 'Rest' : 'Note: ' + clean_pitch(note.pitches[0].pitch) + " " + accidental_name}`;
}

//uses circle of fifths 
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
function find_sheet_accidental(notes: Note[]) {
    const sharpNotes = new Set<string>();
    const flatNotes = new Set<string>();

    notes.forEach((note) => {
        if (note.type !== 'rest' && note.pitches.length > 0) {
            note.pitches.forEach((pitch) => {
                const this_pitch = pitch.pitch;
                const noteLetter = this_pitch.charAt(0).toUpperCase();

                if (this_pitch.includes('#')) {
                    sharpNotes.add(noteLetter);
                } else if (this_pitch.includes('-')) {
                    flatNotes.add(noteLetter);
                }
            })
        }
    });

    if (sharpNotes.size === 0 && flatNotes.size === 0) {
        return 'Natural';
    }
    let sharpScore = 0;
    for (let i = 0; i < SHARP_ORDER.length; i++) {
        if (sharpNotes.has(SHARP_ORDER[i])) {
            sharpScore++;
        } else {
            break;
        }
    }
    let flatScore = 0;
    for (let i = 0; i < FLAT_ORDER.length; i++) {
        if (flatNotes.has(FLAT_ORDER[i])) {
            flatScore++;
        } else {
            break;
        }
    }

    if (sharpScore > flatScore && sharpScore >= sharpNotes.size) {
        return 'Sharp';
    }
    if (flatScore > sharpScore && flatScore >= flatNotes.size) {
        return 'Flat';
    }

    if (sharpNotes.size !== flatNotes.size) {
        return sharpNotes.size > flatNotes.size ? 'Sharp' : 'Flat';
    }

    return 'Natural';
}

function accidental(pitch: string, sheet_accidental: Accidentals = 'Natural') {

    const hasSharp = pitch.includes('#');
    const hasFlat = pitch.includes('-');
    const isNatural = !hasSharp && !hasFlat;

    if (hasSharp) {
        return sheet_accidental !== 'Sharp' ? { svg: ACCIDENTAL_SVGS['sharp'], type: 'Flat' } : null;
    }
    if (hasFlat) {
        return sheet_accidental !== 'Flat' ? { svg: ACCIDENTAL_SVGS['flat'], type: 'Flat' } : null;
    }
    if (isNatural && sheet_accidental !== 'Natural') {
        return { svg: ACCIDENTAL_SVGS['natural'], type: 'Natural' };
    }
    return null;
}

function find_used_clefs(notes: Note[], allowed_clefs: Clefs[]) {
    const usedClefs = new Set<Clefs>();
    for (const note of notes) {
        if (note.type === 'rest') {
            usedClefs.add(note.pitch.clef);
            continue;
        }
        for (const pitch of note.pitches) {
            if (!usedClefs.has(pitch.clef)) usedClefs.add(pitch.clef);
        }
    }
    //makes sure that even if the first note is bass bass always comes after treble on the used list
    let usedClefsList: Clefs[] = []
    for (const clef of CLEF_REF_LIST) {
        if (usedClefs.has(clef)) usedClefsList.push(clef);
    }

    if (usedClefsList.length === 0) {
        usedClefsList = [allowed_clefs[0]];
    }

    return usedClefsList;
}

export function find_used_parts(notes: Note[]) {
    const usedParts = new Set<number>();
    for (const note of notes) {
        if (!usedParts.has(note.part)) usedParts.add(note.part);
    }
    return Math.max(...usedParts);
}

export function group_into_measure(
    note: NoteDisplay,
    beats_per_measure: number,
    measure_group: Record<number, NoteDisplay[][]>
) {
    const measure = Math.floor(note.offset / beats_per_measure);
    const idx = Math.round((note.offset % beats_per_measure) / 0.0625);
    if (!measure_group[measure]) {
        measure_group[measure] = Array.from({ length: 64 }, () => []);
    }
    measure_group[measure][idx].push(note);
}

function destructure_note(
    note: Note,
    pitch: NotePitch,
    pitch_idx: number,
    in_notes_idx: number,
    parsed_time_sig: ParsedTimeSig,
    sheet_accidental: 'Flat' | 'Sharp' | 'Natural',
    allowed_clefs: Clefs[],
): NoteDisplay {

    if (pitch.pitch === null) {
        return {
            id: crypto.randomUUID(),
            relative_xpos: 0,
            relative_ypos: calculate_ypos(null, pitch.clef),
            width: note.duration,
            svg: find_note_type(note.duration, parsed_time_sig.denom, true, 0),
            accidental: null,
            dotted: dotted(note.duration),
            pitch_idx,
            in_notes_idx,
            type: 'Singleton',
            clef: pitch.clef,
            part: note.part,
            offset: note.offset
        }
    }

    // const best_clef = resolve_best_clef(pitch.pitch, allowed_clefs);
    const ypos = calculate_ypos(pitch.pitch, pitch.clef);

    return {
        id: crypto.randomUUID(),
        relative_xpos: 0,
        relative_ypos: ypos,
        width: note.duration,
        svg: find_note_type(note.duration, parsed_time_sig.denom, false, ypos),
        accidental: accidental(pitch.pitch, sheet_accidental)?.svg,
        dotted: dotted(note.duration),
        pitch_idx,
        in_notes_idx,
        type: note.type === 'chord' ? 'Chord' : 'Singleton',
        clef: pitch.clef,
        part: note.part,
        offset: note.offset
    }

}

function decode_sheet_music(
    notes: Note[],
    parsed_time_sig: ParsedTimeSig,
    allowed_clefs: Clefs[],
    sheet_accidental?: 'Flat' | 'Sharp' | 'Natural',
) {
    const evaluated_sheet_accidental = sheet_accidental || find_sheet_accidental(notes);

    const decoded_notes: Record<number, NoteDisplay[][]> = {};

    notes.forEach((note, in_notes_idx) => {
        if (note.type !== 'rest') {
            note.pitches.forEach((pitch, pitch_idx) => {
                group_into_measure(destructure_note(note, pitch, pitch_idx, in_notes_idx, parsed_time_sig, evaluated_sheet_accidental, allowed_clefs), 4, decoded_notes)
            })
        }
        else {
            group_into_measure(destructure_note(note, note.pitch, 0, in_notes_idx, parsed_time_sig, evaluated_sheet_accidental, allowed_clefs), 4, decoded_notes)
        }
    });

    return decoded_notes;
}

//where the bar's highest possible position is relative to the center of the staff where the notes r located 
export const relative_highest_bar_height = -6.5;
export const relative_lowest_bar_height = 8 + 6.5;

function processJoinedNotes(measure_group: Record<number, NoteDisplay[][]> | null, notes: Note[]) {

    if (!measure_group) return;

    const measures = Object.values(measure_group);
    if (measures.length === 0) return;

    type RunningJoinedNotesList = {
        //note is a list to accomodate for the fact that we could be adding a chord so instead of adding multiple
        //notes in the running list for a chord we just add them all to the same note param
        note: NoteDisplay[],
        loc: {
            measure_idx: number,
            slot_idx: number,
            note_idx: number,
        }
    }[]

    type RunningJoinedNotesListMapData = {
        list: RunningJoinedNotesList,
        maxNote: number,
        minNote: number,
        //chorded just means that it contains at least 1 note with a chord in it 
        chorded?: boolean,
    }

    const modifyMeasureGroup = (runningJoinedNotesList: RunningJoinedNotesList, highestY: number, lowestY: number) => {
        if (runningJoinedNotesList.length <= 1 || highestY === -Infinity) return;

        const lastIdx = runningJoinedNotesList.length - 1;

        for (let i = 0; i < runningJoinedNotesList.length; i++) {
            const noteData = runningJoinedNotesList[i];

            const nextItem = runningJoinedNotesList[i + 1];
            const nextNote = nextItem?.note?.[0];

            const targetNote = measure_group[noteData.loc.measure_idx][noteData.loc.slot_idx][noteData.loc.note_idx];
            const refNote = noteData.note[0];

            const barOp1 = Math.max(relative_highest_bar_height, highestY - 4.5);
            const barOp2 = Math.min(relative_lowest_bar_height, lowestY + 4.5);
            let bar = barOp1;
            // -1 means barOp2
            let barChoice = 1;
            //if we breach any of the boundaries then we have to hard set it to the opp bar
            if (highestY < relative_highest_bar_height) {
                bar = barOp2
                barChoice = -1;
            }
            else if (lowestY > relative_lowest_bar_height) bar = barOp1;
            else {
                const avg = (lowestY - highestY) / 2;
                const diff1 = Math.abs(avg - relative_highest_bar_height);
                const diff2 = Math.abs(avg - relative_lowest_bar_height);
                //closer to the higher bar
                if (diff1 < diff2) bar = barOp1;
                //closer to the lower bar 
                else {
                    bar = barOp2
                    barChoice = -1;
                }
            }


            if (refNote.type === 'Chord') {
                const targetSlot = measure_group[noteData.loc.measure_idx][noteData.loc.slot_idx];
                targetSlot.forEach((n, idx) => {
                    if (n.part === refNote.part) {
                        targetSlot[idx].type = 'Packed';
                        targetSlot[idx].svg = barChoice === -1 ? LEFT_JOINED_NOTE_SVG : JOINED_NOTE_SVG;
                        if (barChoice === -1 && isValidElement(targetSlot[idx].accidental) && targetSlot[idx].accidental.key) {
                            targetSlot[idx].accidental = ACCIDENTAL_SVGS_LEFT_VARIATIONS[targetSlot[idx].accidental.key] ?? null;
                        }
                    }
                })
            }
            else {
                targetNote.type = 'Packed';
                targetNote.svg = barChoice === -1 ? LEFT_JOINED_NOTE_SVG : JOINED_NOTE_SVG;
            }

            //both this note and the next note have to be 0.25
            const isDoubled = Boolean(nextNote && nextNote.width === 0.25 && refNote?.width === 0.25);

            if (i !== lastIdx) {
                targetNote.renderJoinBar = {
                    barHeight: bar,
                    doubled: isDoubled ? barChoice : undefined,
                    //find the lowest note ypos of all the notes (needed so that we map one line for chords) and just push that 
                    noteCnxns: [barChoice === 1 ? Math.max(...noteData.note.map(n => n.relative_ypos), -Infinity) : Math.min(...noteData.note.map(n => n.relative_ypos), Infinity)]
                };
            }

            //add the last note's note cnxns to the second to last note 
            if (i === lastIdx - 1 && nextItem) {
                const renderJoinBarData = targetNote.renderJoinBar;
                if (renderJoinBarData) {
                    //find the lowest note ypos of all the notes (needed so that we map one line for chords) and just push that 
                    renderJoinBarData.noteCnxns.push(barChoice === 1 ? Math.max(...nextItem.note.map(n => n.relative_ypos), -Infinity) : Math.min(...nextItem.note.map(n => n.relative_ypos), Infinity));
                }
            }
        }
    }

    const addChordToRunningList = (
        note: NoteDisplay,
        //safe to make this not optional bc there had to alr be a prev note in the list to call add chord 
        runningJoinedNotesList: RunningJoinedNotesListMapData,
        listLen: number,
    ): RunningJoinedNotesListMapData => {
        //bc we're adding chord to the running list we're just adding a chord note to the last note in the list so we can
        //just access the last note and push
        runningJoinedNotesList.list[listLen - 1].note.push(note);
        runningJoinedNotesList.chorded = true;
        //even tho with chorded notes we don't compare for ranges we still need to know the max and min to figure out where to 
        //position the bar 
        runningJoinedNotesList.maxNote = Math.max(runningJoinedNotesList.maxNote, note.relative_ypos);
        runningJoinedNotesList.minNote = Math.min(runningJoinedNotesList.minNote, note.relative_ypos);
        return runningJoinedNotesList;
    }

    const addNoteToRunningList = (
        note: NoteDisplay,
        measure_idx: number,
        slot_idx: number,
        note_idx: number,
        runningJoinedNotesList?: RunningJoinedNotesListMapData,
    ): RunningJoinedNotesListMapData => {
        //bc we add notes without considering chords we can just create a new empty list for the notes
        if (!runningJoinedNotesList) return { list: [{ note: [note], loc: { measure_idx, slot_idx, note_idx } }], maxNote: note.relative_ypos, minNote: note.relative_ypos };
        runningJoinedNotesList.list.push({ note: [note], loc: { measure_idx, slot_idx, note_idx } });
        runningJoinedNotesList.maxNote = Math.max(runningJoinedNotesList.maxNote, note.relative_ypos);
        runningJoinedNotesList.minNote = Math.min(runningJoinedNotesList.minNote, note.relative_ypos);
        return runningJoinedNotesList;
    }

    const commitListSoFar = (
        measure_idx: number,
        slot_idx: number,
        note_idx: number,
        runningJoinedNotesList?: RunningJoinedNotesListMapData,
        preserveNote?: NoteDisplay,
    ): RunningJoinedNotesListMapData => {
        if (!runningJoinedNotesList) return { list: [], maxNote: -Infinity, minNote: Infinity };
        //bc the min is visually higher vertically it goes in for the highestY
        modifyMeasureGroup(runningJoinedNotesList.list, runningJoinedNotesList.minNote, runningJoinedNotesList.maxNote);
        if (preserveNote) {
            return { list: [{ note: [preserveNote], loc: { measure_idx, slot_idx, note_idx } }], maxNote: preserveNote.relative_ypos, minNote: preserveNote.relative_ypos };
        }
        return { list: [], maxNote: -Infinity, minNote: Infinity };
    }

    const relMaxNoteGap = 8;

    measures.forEach((measure, measure_idx) => {
        //part with its running joined notes list (that has a loc id so that we can easily modify the global measure_group)
        //max note and min note are used to bound the join so that we can't have a join that spans more than 4 lines
        const runningJoinedNotesListByPart = new Map<number, RunningJoinedNotesListMapData>();
        const slotsPerUnit = 16;
        measure.forEach((slot, slot_idx) => {
            if (slot.length > 0) {//notes in this pos
                slot.forEach((note, note_idx) => {
                    //have to make sure it's not a rest otherwise can register eighth rests as packed notes
                    if (notes[note.in_notes_idx].type !== "rest") {

                        const cleaned_dur = snap_to_valid_dur(note.width);
                        let runningJoinedNotesList = runningJoinedNotesListByPart.get(note.part);

                        //if not a 16th or an 8th note commit the group as is
                        if (cleaned_dur !== 0.25 && cleaned_dur !== 0.5) {
                            //if there's nothing in the group that's fine it'll just ignore the group and prep an empty group
                            runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList);
                        }
                        else {

                            //NOTE: NOT CHANGING THE GAP SIZING BASED ON CHORDS VS SINGLETONS BC ITS TOO UNPREDICTABLE INSTEAD WE JUST HAVE A UNIVERSALLY ACCEPTABLE GAP

                            const newMax = Math.max(runningJoinedNotesList?.maxNote ?? -Infinity, note.relative_ypos);
                            const newMin = Math.min(runningJoinedNotesList?.minNote ?? Infinity, note.relative_ypos);
                            const newDiff = Math.abs(newMax - newMin);

                            const prevNote = runningJoinedNotesList?.list.at(-1);
                            //can access note[0] of note bc they're all gonna have the same dur / offset, it's just the pitch that'll change from note to note
                            const prevDur = prevNote ? snap_to_valid_dur(prevNote.note[0].width) : null;

                            const listLen = runningJoinedNotesList?.list.length ?? 0;

                            const nextSlot = measure[slot_idx + slotsPerUnit * note.width];
                            let nextNote = undefined;
                            if (nextSlot) {
                                nextNote = nextSlot.filter(n => {
                                    const cleanedDur = snap_to_valid_dur(n.width)
                                    return n.part === note.part && (cleanedDur === 0.25 || cleanedDur === 0.5);
                                })[0];
                            }
                            const nextDur = nextNote ? snap_to_valid_dur(nextNote.width) : null;
                            const nextMax = Math.max(newMax, nextNote?.relative_ypos ?? -Infinity);
                            const nextMin = Math.min(newMin, nextNote?.relative_ypos ?? Infinity);
                            const nextDiff = Math.abs(nextMax - nextMin);

                            //if the two notes' offsets r the same that means that its a chord bc y else would the last note that we added to the running group 
                            //have the same offset as the note we're currently checking
                            //safe to always check the first note in prev note bc if the note is chorded the first one is guaranteed to have the same offset/type data as the following ones
                            if (note.type === 'Chord' && prevNote && prevNote.note[0].offset === note.offset && runningJoinedNotesList) {
                                //for the first note u accept all incoming chords even if it breaks the gap bc the gap is then checked for each chord as soon as a new note is added - after the chord has been complete in both 8ths and 16ths
                                //u also have to check all the following chord additions after the first note has been added bc then u have a steady min / max val that can be broken with new chord additions...

                                //if u don't leave the first note alone than as soon there's a break you'll get stuck with no notes being rendered and you'll keep passing blame until eventually u reach the last chord in the note and then it won't overflow 
                                //so you'll be stuck with adding a note to that and the overflow catch won't catch a non-overflowing chord bc half the notes will have been discarded 
                                if (listLen > 1 && newDiff > relMaxNoteGap) {
                                    //if ur abt to add a note to a chord that's going to break the gap limit then just disregard everything so far 
                                    runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx);
                                }
                                else runningJoinedNotesList = addChordToRunningList(note, runningJoinedNotesList, listLen);
                            }
                            else {
                                if (cleaned_dur === 0.5) {
                                    //need this bc we can't catch overloads on the gap while adding chords bc chords could be added in such a way that the first 2 both cause overloads but then the third doesnt 
                                    //and it registers as a group and then that would be an invalid group bc the first two wouldn't be connected but would still be rendered as a part of the group (which would be okay cuz we could work around that in the render but that also for some rzn disables the overlapping of notes check on those chord notes)
                                    if (prevNote && prevNote.note[0].type === 'Chord' && newDiff > relMaxNoteGap) runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    //if this is the first note in the list add it
                                    //processing this b4 the len comparison to make sure that runningJoinedNotesList exists 
                                    else if (!runningJoinedNotesList) runningJoinedNotesList = addNoteToRunningList(note, measure_idx, slot_idx, note_idx);
                                    //need to make sure that all the notes are within 4 lines of each other 
                                    //and if the note we're about to add breaks that then just commit what we alr have and run thru the rest of the comparisons normally 
                                    else if (newDiff > relMaxNoteGap) {
                                        runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    }
                                    //can't add anymore to the list bc it's full so we have to commit and preserve the note we have
                                    //OR the first note of the list is a 16th note then we have to commit as well 
                                    else if (runningJoinedNotesList.list.length === 4 || (prevDur === 0.25 && listLen === 1)) {
                                        runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    }
                                    //here just register the eighth note normally 
                                    else {
                                        runningJoinedNotesList = addNoteToRunningList(note, measure_idx, slot_idx, note_idx, runningJoinedNotesList);
                                    }
                                }
                                //processing 16th notes
                                else {
                                    if (prevNote && prevNote.note[0].type === 'Chord' && newDiff > relMaxNoteGap) runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    //if it's the first note in the group then the note after HAS to be 16th too 
                                    else if (listLen === 0) {
                                        if (nextDur === 0.25) {
                                            runningJoinedNotesList = addNoteToRunningList(note, measure_idx, slot_idx, note_idx, runningJoinedNotesList);
                                        }
                                        //even tho no need to commit if it's not valid bc there's no list to commit
                                        //if u remove this then u have to add a fallback down at the bottom of all these if statements bc u don't fullfill every if/else case and ts thinks it can be undefined... but adding a fallback could mess with purposesly empty lists down the line in other ifs
                                        else runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx);
                                    }
                                    //if we've reached the max allowed notes just commit what we have and start a new group with this note in it... 
                                    else if (listLen >= 4) {
                                        runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    }
                                    //if it's the last note to go in the group then the note b4 it HAS to be 16th too 
                                    else if (nextDur !== 0.25 && nextDur !== 0.5) {
                                        if (prevDur === 0.25) {
                                            //if the note we're about to add will break the 4 gap rule then we need to commit what we have and just start a new group
                                            if (newDiff > relMaxNoteGap) runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                            else runningJoinedNotesList = addNoteToRunningList(note, measure_idx, slot_idx, note_idx, runningJoinedNotesList);
                                        }
                                        else runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    }
                                    //if the note is in the middle of the group then either prev or next has to be 16th too
                                    else {
                                        //u have to check this down here 2 to make it work in both 16th and 8ths 
                                        if (prevDur === 0.25 || nextDur === 0.25) {
                                            //if the note we're about to add will break the 4 gap rule then we need to commit what we have and just start a new group
                                            if (newDiff > relMaxNoteGap) runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                            //we need to check the next dif only if we're working exclusively off the nextDur... just like we are at the beginning of groups when listLen === 0, in all other places we 
                                            //have prevDur as a ref
                                            else if (prevDur !== 0.25 && nextDur === 0.25 && nextDiff > relMaxNoteGap) runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                            else runningJoinedNotesList = addNoteToRunningList(note, measure_idx, slot_idx, note_idx, runningJoinedNotesList);
                                        }
                                        else runningJoinedNotesList = commitListSoFar(measure_idx, slot_idx, note_idx, runningJoinedNotesList, note);
                                    }
                                }
                            }
                            // }
                        }
                        //fallback if the list turns up undefined 
                        runningJoinedNotesListByPart.set(note.part, runningJoinedNotesList);
                    }
                })
            }
        })
        //at the end of the measure the notes should be committed 
        runningJoinedNotesListByPart.forEach((runningJoinedNotesList) => {
            modifyMeasureGroup(runningJoinedNotesList.list, runningJoinedNotesList.minNote, runningJoinedNotesList.maxNote);
        });
    })

    return measure_group;
}

export function useSheetMusicProcessor({
    notes,
    time_sig,
    sheet_accidental,
    allowed_clefs
}: {
    notes: Note[],
    time_sig: string,
    allowed_clefs: Clefs[]
    sheet_accidental?: Accidentals,
}) {
    const decodedNotes = useMemo(
        () => {
            const parsed_time_sig = destructure_time_sig(time_sig);
            if (parsed_time_sig === null) return null;

            const decoded_notes = processJoinedNotes(decode_sheet_music(notes, parsed_time_sig, allowed_clefs, sheet_accidental), notes)
            return decoded_notes
        },
        [notes, time_sig, sheet_accidental, allowed_clefs]
    );
    const usedClefs = useMemo(
        () => find_used_clefs(notes, allowed_clefs),
        [notes, allowed_clefs]
    );
    const usedParts = useMemo(() => find_used_parts(notes), [notes]);

    return { decoded_notes: decodedNotes, used_clefs: usedClefs, used_parts: usedParts };
}
