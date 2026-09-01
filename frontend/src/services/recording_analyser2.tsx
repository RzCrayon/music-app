// import { addPitchBendsToNoteEvents, BasicPitch, noteFramesToTime, outputToNotesPoly } from "@spotify/basic-pitch";
import type { NoteEventTime } from "@spotify/basic-pitch";
import type { Note, Song } from "./types";
import type { Dispatch, SetStateAction } from "react";
import { FINAL_RECORDING_LOADING_STATE } from "../MusicEditorPlayer";
import { apiService } from "./api";
import { sessionStateManager } from "./session_state_manager";

interface NoteNames {
    sharp: string;
    flat: string;
    isAccidental: boolean;
    display: string; // "C4" or "C#4 / Db4"
}

interface ModifiedNotes {
    name: string[],
    start: number,
    dur: number,
    midi: number,
    amp: number
}

interface ModifiedNoteEventTime {
    pitchName: NoteNames;
    startTimeSeconds: number;
    durationSeconds: number;
    pitchMidi: number;
    amplitude: number;
    pitchBends?: number[] | undefined;
}

interface ModifiedChordEventTime {
    pitchNames: NoteNames[];
    startTimeSeconds: number;
    durationSeconds: number;
    pitchMidis: number[];
    amplitude: number;
    pitchBends?: number[] | undefined;
}

const calculate_rms = (samples: Float32Array, start: number, end: number): number => {
    const totalSamples = end - start;
    if (totalSamples <= 0) return 0;

    let sumSquares = 0;
    for (let i = start; i < end; i++) {
        sumSquares += samples[i] * samples[i];
    }
    const meanSquare = sumSquares / totalSamples;
    return Math.sqrt(meanSquare);
};
export const beats_to_sec = (beats: number, bpm: number) => (beats / bpm) * 60;

function getMidiNoteNames(midi: number): NoteNames {
    if (midi < 0 || midi > 127) {
        throw new RangeError("MIDI pitch must be between 0 and 127.");
    }

    const sharps = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const flats = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

    const index = midi % 12;
    const octave = Math.floor(midi / 12) - 1;

    const sharpName = `${sharps[index]}${octave}`;
    const flatName = `${flats[index]}${octave}`;

    // It's an accidental if the sharp name and flat name are different
    const isAccidental = sharpName !== flatName;

    return {
        sharp: sharpName,
        flat: flatName,
        isAccidental,
        display: isAccidental ? `${sharpName} / ${flatName}` : sharpName
    };
}

function cleanAudio(audioBuffer: AudioBuffer, notes: Note[], bpm: number = 120, rms_thresh: number = 0.01) {
    const sampleRate = audioBuffer.sampleRate;

    const channelFiltration = (startTime: number, endTime: number, channelData: Float32Array) => {
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);

        if (startSample >= channelData.length || startSample < 0) return;
        const validEndSample = Math.min(endSample, channelData.length);

        const rms = calculate_rms(channelData, startSample, validEndSample);

        if (rms <= rms_thresh) {
            channelData.fill(0, startSample, validEndSample);
        }
    };

    const sortedNotes = [...notes].sort((a, b) => a.offset - b.offset);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        let currentTimeSec = 0;

        sortedNotes.forEach(note => {
            const noteStartSec = beats_to_sec(note.offset, bpm);
            const noteEndSec = beats_to_sec(note.offset + note.duration, bpm);

            if (noteStartSec > currentTimeSec) {
                channelFiltration(currentTimeSec, noteStartSec, channelData);
            }

            channelFiltration(noteStartSec, noteEndSec, channelData);
            currentTimeSec = noteEndSec;
        });

        if (currentTimeSec < audioBuffer.duration) {
            channelFiltration(currentTimeSec, audioBuffer.duration, channelData);
        }
    }

    return audioBuffer;
}

function postExtractionCleanse(extracted_notes: NoteEventTime[], amplitude_thresh: number, recording_offset: number) {
    return extracted_notes.map(note => {
        return {
            ...note,
            startTimeSeconds: note.startTimeSeconds - recording_offset,
            pitchName: getMidiNoteNames(note.pitchMidi),
        }
    })
        .filter(note => note.amplitude >= amplitude_thresh)
        .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

function mergeHarmonics(extracted_notes: ModifiedNoteEventTime[], merge_thresh: number = 0.07) {
    let curr_process_idx = 0;
    const new_notes: ModifiedNoteEventTime[] = []
    while (curr_process_idx < extracted_notes.length) {
        const processed_notes = new Set<ModifiedNoteEventTime>();
        let cumulativeDur = extracted_notes[curr_process_idx].durationSeconds;
        processed_notes.add(extracted_notes[curr_process_idx]); // always add current first

        while (curr_process_idx < extracted_notes.length - 1) {
            const note_class = extracted_notes[curr_process_idx].pitchMidi % 12;
            const next_note_class = extracted_notes[curr_process_idx + 1].pitchMidi % 12;
            //have to keep this here so we don't accidentally merge two notes that are the same note that should be played right after each other
            const timeClose = Math.abs(extracted_notes[curr_process_idx + 1].startTimeSeconds - extracted_notes[curr_process_idx].startTimeSeconds) < merge_thresh;

            if (note_class === next_note_class && timeClose) {
                curr_process_idx++;
                processed_notes.add(extracted_notes[curr_process_idx]);
                cumulativeDur += extracted_notes[curr_process_idx].durationSeconds;
            } else {
                break;
            }
        }

        const converted = [...processed_notes.values()];
        const minNote = converted.reduce((min, curr) => curr.pitchMidi < min.pitchMidi ? curr : min, converted[0])
        const startTime = converted.reduce((min, curr) => curr.startTimeSeconds < min.startTimeSeconds ? curr : min, converted[0]).startTimeSeconds
        new_notes.push({ ...minNote, startTimeSeconds: startTime, durationSeconds: cumulativeDur });

        curr_process_idx++;
    }

    return new_notes;
}

function compressChords(extracted_notes: ModifiedNoteEventTime[], merge_thresh: number = 0.07) {
    let curr_process_idx = 0;
    const new_notes: ModifiedChordEventTime[] = []
    while (curr_process_idx < extracted_notes.length) {
        const processed_notes = new Set<ModifiedNoteEventTime>();
        let maxDur = extracted_notes[curr_process_idx].durationSeconds;
        processed_notes.add(extracted_notes[curr_process_idx]); // always add current first

        while (curr_process_idx < extracted_notes.length - 1) {
            const merge = Math.abs(extracted_notes[curr_process_idx + 1].startTimeSeconds - extracted_notes[curr_process_idx].startTimeSeconds) < merge_thresh;
            if (merge) {
                curr_process_idx++;
                processed_notes.add(extracted_notes[curr_process_idx]);
                maxDur = extracted_notes[curr_process_idx].durationSeconds > maxDur ? extracted_notes[curr_process_idx].durationSeconds : maxDur
            } else {
                break;
            }
        }

        const converted = [...processed_notes.values()];
        const startTime = converted.reduce((sum, curr) => sum + curr.startTimeSeconds, 0) / converted.length;
        const names = converted.map(note => note.pitchName);
        const midis = converted.map(note => note.pitchMidi);

        new_notes.push({
            ...converted[0],
            startTimeSeconds: startTime,
            durationSeconds: maxDur,
            pitchNames: names,
            pitchMidis: midis,
        });

        curr_process_idx++;
    }
    return new_notes;
}

function snapNotes(extracted_notes: ModifiedChordEventTime[], notes: Note[], bpm: number) {
    const expectedTimesInSec = notes
        .map(note => beats_to_sec(note.offset, bpm))
        .sort((a, b) => a - b);

    return extracted_notes.map(extractedNote => {
        const playedTime = extractedNote.startTimeSeconds;
        const validPastTargets = expectedTimesInSec.filter(targetTime => targetTime <= playedTime);
        let snappedTime = expectedTimesInSec[0];

        if (validPastTargets.length > 0) {
            snappedTime = validPastTargets[validPastTargets.length - 1];
        }

        return {
            ...extractedNote,
            startTimeSeconds: snappedTime
        };
    });
}

function matchOutputToExpected(
    cleaned_notes: ModifiedChordEventTime[],
    notes: Note[],
    time_tolerance: number = 0.1,
    bpm: number = 120
) {
    const snappedNotes = snapNotes(cleaned_notes, notes, bpm);
    const res = notes.map(note => {

        const expectedStart = beats_to_sec(note.offset, bpm);

        if (note.type === 'rest') return { note, score: 2 };

        const matched_pitches = note.pitches.map(pitch => {
            return snappedNotes.some(cleaned_note => {
                const timeDiff = Math.abs(expectedStart - cleaned_note.startTimeSeconds);

                const pitchMatches = cleaned_note.pitchNames.some(p => p.sharp === pitch.pitch || p.flat === pitch.pitch);
                return timeDiff < time_tolerance && pitchMatches;
            });
        });

        const correctCount = matched_pitches.filter(Boolean).length;
        const totalPitches = note.pitches.length;

        return {
            note,
            score: totalPitches > 0 ? correctCount / totalPitches : 0
        };
    })
    evalRests(res, snappedNotes);
    return res;
}

function evalRests(
    matchedNotes: { note: Note, score: number }[],
    snapped_notes: ModifiedChordEventTime[],
    time_tolerance: number = 0.1
) {

    const rests = []
    const nonRests = []
    for (const note of matchedNotes) {
        if (note.score === 2) {
            rests.push(note);
        }
        else nonRests.push(note);
    }

    const findNoisesDuringRest = (range: { start: number, end: number }) =>
        snapped_notes.filter(cleaned_note => (
            (cleaned_note.startTimeSeconds > range.start && cleaned_note.startTimeSeconds < range.end)
            || Math.abs(cleaned_note.startTimeSeconds - range.start) < time_tolerance
            || Math.abs(cleaned_note.startTimeSeconds - range.end) < time_tolerance
        ));

    for (const data of rests) {
        const note = data.note;
        const noteRange = { start: note.offset, end: note.offset + note.duration };
        //automatically clean out the note itself from this list too 
        //searching on nonRests bc another rest can't have an impact on whether or not this rest was played correctly
        const notesWithinRange = nonRests.filter(n => {
            if (n.note.part === note.part) return false;
            const nStart = n.note.offset;
            const nEnd = n.note.offset + n.note.duration;
            return nStart < noteRange.end && nEnd > noteRange.start;
        });

        //if there are played notes that overlap with the rest... then they all have to be played correctly so that the rest is played correctly...
        //if there was a noise that didn't belong to the overlapping notes then its impossible to know for which part it was intended (the rest part or the overlapping notes' part)...
        //so the rest has to be automatically marked as missed.
        //if ALL the overlapping notes were missed tho... the only way this rest could be correct is if there was NO noise played during its range
        if (notesWithinRange.length > 0) {
            const allCorrect = notesWithinRange.every(note => note.score === 1);
            const allIncorrect = notesWithinRange.every(note => note.score === 0);
            if (allCorrect) {
                data.score = 1;
            }
            else if (allIncorrect) {
                const noisesDuringRest = findNoisesDuringRest(noteRange);
                if (noisesDuringRest.length > 0) data.score = 0;
                else data.score = 1;
            }
            else {
                data.score = 0;
            }
        }
        //if there were no overlapping notes in the range then you just have to make sure there were no notes during the rest 
        else {
            const noisesDuringRest = findNoisesDuringRest(noteRange);
            data.score = noisesDuringRest.length > 0 ? 0 : 1;
        }

    }
}

function flattenScore(matchedNotes: { note: Note, score: number }[]) {
    return matchedNotes.reduce((sum, note) => sum + note.score, 0) / matchedNotes.length;
}

async function resampleAudioBuffer(
    buffer: AudioBuffer,
    targetRate = 22050
): Promise<AudioBuffer> {
    const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(buffer.duration * targetRate),
        targetRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    return await offlineCtx.startRendering();
}

export const runAudioAnalysis = async (
    played_audio_url: string,
    notes: Note[],
    bpm: number,
    recording_offset: number,
    setLoading: Dispatch<SetStateAction<string>>
) => {

    const {
        addPitchBendsToNoteEvents,
        BasicPitch,
        noteFramesToTime,
        outputToNotesPoly,
    } = await import("@spotify/basic-pitch");

    setLoading('Fetching Audio');

    const audioCtx = new AudioContext();

    const response = await fetch(played_audio_url);
    const arrayBuffer = await response.arrayBuffer();

    setLoading('Prepping Audio');
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const audioBuffer = await resampleAudioBuffer(decodedBuffer, 22050);

    const cleanedBuffer = cleanAudio(audioBuffer, notes, bpm);

    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];
    let pct: number = 0; // Tracks model progress percentage

    const basicPitch = new BasicPitch("https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json");
    await basicPitch.evaluateModel(
        cleanedBuffer as unknown as AudioBuffer,
        (f: number[][], o: number[][], c: number[][]) => {
            frames.push(...f);
            onsets.push(...o);
            contours.push(...c);
        },
        (p: number) => {
            setLoading(`Analysing Audio: ${Math.round(p * 100)}%`)
        },
    );

    setLoading('Scoring Attempt')
    const extracted_notes = noteFramesToTime(
        addPitchBendsToNoteEvents(
            contours,
            //onset threshold... what should register as a new note
            //frame threshold minimum confidence score required to keep a note alive once a note is triggered by onset
            //minimum note length
            outputToNotesPoly(frames, onsets, 0.4, 0.3, 7),
        ),
    );

    const cleanedNotes = postExtractionCleanse(extracted_notes, 0.4, 0);
    const mergedNotes = mergeHarmonics(cleanedNotes);
    const compressedNotes = compressChords(mergedNotes);
    const matchedNotes = matchOutputToExpected(compressedNotes, notes);
    const finalScore = flattenScore(matchedNotes);

    setLoading(FINAL_RECORDING_LOADING_STATE);

    return finalScore;
}
