import type { Dispatch, SetStateAction } from "react";
import type { Clefs, ComplexActionItem, Instruments, Note, ParsedTimeSig, PitchedNote, PitchedPitch, StateManager, Toaster } from "../services/types";
import { adjust_pitch, calculate_ypos, convert_pitch_between_clefs, dotted, find_next_avail_pitch, get_pitch_from_y, snap_to_valid_dur, VALID_DURS } from "./sheetmusic_processor";
import { defaultNewNote } from "./SheetMusicRenderer";
import type { NewPopup } from "./NoteEditorPopupNoteDisplay";

// export const emptyNotePopup: NewPopup = {
//     visible: false,
//     top: 0,
//     left: 0,
//     noteIdx: -1,
//     noteData: null,
//     type: 'editor',
//     pitch_idx: 0,
//     stateManager: {
//         initManager: () => { },
//         releaseManager: () => { },
//         clearManager: () => { },
//         addAction: () => { },
//         addComplexAction: () => { },
//         undo: () => { }
//     }
// };

export function addNoteLeft(
    popup: NewPopup,
    currNote: Note,
    parsed_time_sig: ParsedTimeSig,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    notes: Note[],
    stateManager?: StateManager,
) {
    const noteClef = currNote.type === 'rest' ? currNote.pitch.clef : currNote.pitches[popup.pitchIdx].clef;
    let newNote = {
        ...defaultNewNote,
        offset: currNote.offset,
        duration: 4 / parsed_time_sig.numerator,
        pitches: [{
            pitch: get_pitch_from_y(undefined, noteClef),
            //default to the clef of the note that you just said add left from 
            clef: noteClef
        }],
        part: currNote.part,
    }
    setNotes(prev => {
        //space avail determines whether or not we fit the note into an empty gap or if we shift all the following notes to make room for it
        let space_avail = true;
        if (newNote.offset - newNote.duration < 0) {
            space_avail = false;
        }
        else {
            for (const note of prev) {
                //if the note we're checking rn falls in the duration of where we would add the note if there was space avail to the left
                //think 8th note, qtr note add left a qtr note u would have a qtr note with what looks like an 8th note offset from the 8th note to the left of that 8th note
                if (
                    note.part === newNote.part //only check the notes that belong to the same part as the part the new note is about to get added to
                    && note.offset < newNote.offset //only check the notes b4
                    &&
                    (
                        note.offset >= newNote.offset - newNote.duration  //make sure that we don't add the new note b4 the note right b4 (which would happen if we just assumed there was space available to the left)
                        || note.offset + note.duration > newNote.offset - newNote.duration //make sure that we don't add the new note inside of the note b4's duration
                    )
                ) {
                    space_avail = false;
                    break;
                }
            }
        }

        if (space_avail) newNote = { ...newNote, offset: newNote.offset - newNote.duration };

        const used_pitches = new Set<string>();
        let updated_notes = prev.map((note) => {
            if (note.offset === newNote.offset) {
                if (note.type !== 'rest') {
                    note.pitches.forEach(p => used_pitches.add(p.pitch));
                }
            }
            if (note.offset >= newNote.offset && note.part === newNote.part && !space_avail) {
                return { ...note, offset: note.offset + newNote.duration }
            }
            return note;
        })
        if (used_pitches.has(newNote.pitches[0].pitch)) {
            newNote.pitches[0].pitch = find_next_avail_pitch([...used_pitches], newNote.pitches[0].clef);
        }
        updated_notes.push(newNote);

        return updated_notes;
    })

    stateManager?.addAction(undefined, newNote.offset, newNote.part, newNote.duration);
    setPopup({
        noteIdx: notes.length,
        pitchIdx: 0
    })
}

export function addNoteRight(
    popup: NewPopup,
    parsed_time_sig: ParsedTimeSig,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    notes: Note[],
    stateManager?: StateManager,
) {

    const currNote = notes[popup.noteIdx];
    const noteClef = currNote.type === 'rest' ? currNote.pitch.clef : currNote.pitches[popup.pitchIdx].clef;
    const newNote = {
        ...defaultNewNote,
        offset: currNote.offset + currNote.duration,
        duration: 4 / parsed_time_sig.numerator,
        pitches: [{
            pitch: get_pitch_from_y(undefined, noteClef),
            //default to the clef of the note that you just said add left from 
            clef: noteClef
        }],
        part: currNote.part,
    }
    setNotes(prev => {
        const used_pitches = new Set<string>();
        let updated_notes = prev.map((note) => {
            if (note.offset === newNote.offset) {
                if (note.type !== 'rest') {
                    note.pitches.forEach(p => used_pitches.add(p.pitch));
                }
            }
            if (note.offset >= newNote.offset && note.part === newNote.part) {
                return { ...note, offset: note.offset + newNote.duration }
            }
            return note;
        })
        if (used_pitches.has(newNote.pitches[0].pitch)) {
            newNote.pitches[0].pitch = find_next_avail_pitch([...used_pitches], newNote.pitches[0].clef);
        }
        updated_notes.push(newNote);

        return updated_notes;
    })

    stateManager?.addAction(undefined, newNote.offset, newNote.part, newNote.duration);
    setPopup({
        noteIdx: notes.length,
        pitchIdx: 0,
    })
}

export function deleteNote(
    popup: NewPopup,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    fromKeyboard: boolean = false,
    notes: Note[],
    stateManager?: StateManager
) {
    const prevNote = notes[popup.noteIdx];
    if (!prevNote) return;

    // 1. Deleting a single note out of a chord
    if (fromKeyboard && prevNote.type === 'chord') {
        const { part, offset, duration } = prevNote;
        const pitch_idx = popup.pitchIdx;
        let newTargetPitchIdx = 0;

        const updatedNotes = notes.map((note) => {
            if (note.part === part && note.offset === offset && note.duration === duration) {
                const pitchedNote = note as PitchedNote;
                const deletedY = calculate_ypos(
                    pitchedNote.pitches[pitch_idx].pitch,
                    pitchedNote.pitches[pitch_idx].clef
                );

                const updatedPitches = pitchedNote.pitches.filter((_, idx) => idx !== pitch_idx);

                let smallestYDiff = Infinity;
                let nextHighestIdx = -1;
                let lowestY = -Infinity;
                let lowestIdx = 0;

                updatedPitches.forEach((p, idx) => {
                    const thisY = calculate_ypos(p.pitch, p.clef);

                    if (thisY < deletedY) {
                        const diff = deletedY - thisY;
                        if (diff < smallestYDiff) {
                            smallestYDiff = diff;
                            nextHighestIdx = idx;
                        }
                    }

                    if (thisY > lowestY) {
                        lowestY = thisY;
                        lowestIdx = idx;
                    }
                });

                newTargetPitchIdx = nextHighestIdx !== -1 ? nextHighestIdx : lowestIdx;

                return {
                    ...pitchedNote,
                    pitches: updatedPitches,
                    type: updatedPitches.length === 1 ? ('note' as const) : ('chord' as const),
                };
            }
            return note;
        })

        setNotes(updatedNotes);

        stateManager?.addAction(prevNote, offset, part, duration);

        setPopup((prevPopup) => ({
            ...prevPopup,
            pitchIdx: newTargetPitchIdx,
        }));
    }
    // 2. Full note deletion
    else {

        const updatedNotes = notes
            .filter((_, idx) => idx !== popup.noteIdx)
            .map((note) => {
                if (note.part !== prevNote.part || note.offset < prevNote.offset) return note;
                return { ...note, offset: note.offset - prevNote.duration };
            });

        // Synchronously compute focus note and next popup state using updatedNotes
        if (updatedNotes.length === 0) {
            setPopup({ noteIdx: -1, pitchIdx: -1 });
        } else {
            const deletedOffset = prevNote.offset;
            const deletedPart = prevNote.part;

            const sortedNotes = [...updatedNotes].sort((a, b) => a.offset - b.offset);

            const newFocusNote =
                [...sortedNotes].reverse().find((n) => n.part === deletedPart && n.offset < deletedOffset) ??
                [...sortedNotes].reverse().find((n) => n.offset < deletedOffset) ??
                sortedNotes[0];

            const calculatedIdx = updatedNotes.indexOf(newFocusNote);

            if (calculatedIdx === -1) {
                setPopup({ noteIdx: -1, pitchIdx: -1 });
            } else {
                setPopup((prevPopup) => ({
                    ...prevPopup,
                    noteIdx: calculatedIdx,
                    pitch_idx: 0,
                }));
            }
        }

        setNotes(updatedNotes);

        if (stateManager) {
            stateManager.addAction(prevNote);
        }
    }
}

export function decreaseNoteDur(
    currNote: Note,
    notes: Note[],
    setNotes: Dispatch<SetStateAction<Note[]>>,
    stateManager?: StateManager
) {
    const new_dur_idx = VALID_DURS.indexOf(snap_to_valid_dur(currNote.duration)) - 1
    if (new_dur_idx < 0) return;
    const newNote = {
        ...currNote,
        duration: VALID_DURS[new_dur_idx],
    }
    stateManager?.addAction(currNote, newNote.offset, newNote.part, newNote.duration)
    const diff = currNote.duration - VALID_DURS[new_dur_idx];
    setNotes(prev => prev
        .map((note) => {
            if (note.part !== newNote.part) return note;
            if (note.offset < newNote.offset) return note;
            if (note.offset == newNote.offset) return newNote;
            return { ...note, offset: note.offset - diff }
        })
    )
}

export function increaseNoteDur(
    currNote: Note,
    notes: Note[],
    setNotes: Dispatch<SetStateAction<Note[]>>,
    stateManager?: StateManager,
) {
    const new_dur_idx = VALID_DURS.indexOf(snap_to_valid_dur(currNote.duration)) + 1;
    if (new_dur_idx >= VALID_DURS.length) return;
    const newNote = {
        ...currNote,
        duration: VALID_DURS[new_dur_idx],
    }
    stateManager?.addAction(currNote, newNote.offset, newNote.part, newNote.duration)
    const diff = VALID_DURS[new_dur_idx] - currNote.duration;
    setNotes(prev => prev
        .map((note) => {
            if (note.part !== newNote.part) return note;
            if (note.offset < newNote.offset) return note;
            if (note.offset === newNote.offset) return newNote;
            return { ...note, offset: note.offset + diff }
        })
    )
}

export function dotNote(
    currNote: Note,
    notes: Note[],
    setNotes: Dispatch<SetStateAction<Note[]>>,
    stateManager?: StateManager,
) {
    if (!dotted(currNote.duration)) {
        const new_dur = 1.5 * currNote.duration;
        const newNote = {
            ...currNote,
            duration: new_dur,
        }
        stateManager?.addAction(currNote, newNote.offset, newNote.part, newNote.duration)
        const diff = new_dur - currNote.duration;
        setNotes(prev => prev
            .map((note) => {
                if (note.part !== newNote.part) return note;
                if (note.offset < newNote.offset) return note;
                if (note.offset === newNote.offset) return newNote;
                return { ...note, offset: note.offset + diff }
            })
        )
    }
    else {
        //round to 3 decimal places to match OMR valid note durations
        const new_dur = Math.round((2 / 3 * currNote.duration) * 1000) / 1000
        const newNote = {
            ...currNote,
            duration: new_dur,
        }
        stateManager?.addAction(currNote, newNote.offset, newNote.part, newNote.duration)
        const diff = currNote.duration - new_dur;
        setNotes(prev => prev
            .map((note) => {
                if (note.part !== newNote.part) return note;
                if (note.offset < newNote.offset) return note;
                if (note.offset == newNote.offset) return newNote;
                return { ...note, offset: note.offset - diff }
            })
        )
    }
}

export function adjustPitch(
    dir: 'up' | 'down',
    pitchData: PitchedPitch,
    in_notes_idx: number,
    pitch_idx: number,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    oldNote: Note,
    stateManager?: StateManager,
) {
    const pitch = adjust_pitch(pitchData.pitch, dir, pitchData.clef);
    setNotes(prev => prev.map((note, idx) => {
        if (idx === in_notes_idx && note.type !== 'rest') {
            return {
                ...note,
                pitches: note.pitches.map((p, idx) => idx === pitch_idx ? {
                    //keep the clef the same bc now the clef is linked to the part... the only time the 
                    //clef can be changed is if the user explicilty changes the render clef of a certain part 
                    ...p,
                    pitch,
                } : p),
            }
        }
        return note;
    }));
    stateManager?.addAction(oldNote, oldNote.offset, oldNote.part, oldNote.duration);
}

export function nextNote(
    popup: NewPopup,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    notes: Note[],
) {

    const currNote = notes[popup.noteIdx];
    if (!currNote) return;

    const thisPart = currNote.part;
    const thisOffset = currNote.offset;

    let lowestOffsetIdx = -1;

    const foundIdx = notes.reduce((closestIdx, curr, currIdx) => {
        //skip all other notes not in the same part
        if (curr.part !== thisPart) return closestIdx;

        if (lowestOffsetIdx === -1 || curr.offset < notes[lowestOffsetIdx].offset) {
            lowestOffsetIdx = currIdx;
        }

        if (curr.offset <= thisOffset) return closestIdx;

        if (closestIdx === -1) return currIdx;

        const closestNote = notes[closestIdx];
        return curr.offset < closestNote.offset ? currIdx : closestIdx;
    }, -1);

    //fall back to the lowest offset note in this part 
    const newIdx = foundIdx === -1 ? lowestOffsetIdx : foundIdx;

    if (newIdx !== -1) {
        setPopup({
            ...popup,
            noteIdx: newIdx,
            pitchIdx: 0,
        });
    }
}

export function prevNote(
    popup: NewPopup,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    notes: Note[],
) {

    const currNote = notes[popup.noteIdx];
    const thisPart = currNote.part;
    const thisOffset = currNote.offset;

    let highestOffsetIdx = -1;
    let closestIdx = -1;
    //can't use reduce here bc we're keeping track of too many vars
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i]
        if (note.part !== thisPart) continue;
        if (highestOffsetIdx === -1 || note.offset > notes[highestOffsetIdx].offset) {
            highestOffsetIdx = i;
        }
        if (note.offset >= thisOffset) continue;
        if (closestIdx === -1 || Math.abs(note.offset - thisOffset) < Math.abs(notes[closestIdx].offset - thisOffset)) {
            closestIdx = i;
        }
    }

    const newIdx = closestIdx === -1 ? highestOffsetIdx : closestIdx

    if (newIdx !== -1) {
        setPopup({
            ...popup,
            noteIdx: newIdx,
            pitchIdx: 0
        });
    }
}

export function shiftPart(
    newPart: number,
    popup: NewPopup,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    notes: Note[],
    stateManager: StateManager,
) {

    const currNote = notes[popup.noteIdx];
    const currPart = currNote.part;
    const currOffset = currNote.offset;
    const duration = currNote.duration;

    //same operation every time... add to the new part remove from the old part
    const cleanNotes = [];
    let prevNoteIdx = -1;

    //remove from the list everything else stays the same
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (note.part === currPart) {
            if (note.offset === currOffset) continue;
        }
        //find the note in the new part that comes right b4
        if (note.part === newPart) {
            if (note.offset <= currOffset) {
                if (prevNoteIdx < 0 || prevNoteIdx >= 0 && Math.abs(note.offset - currOffset) < Math.abs(notes[prevNoteIdx].offset - currOffset))
                    prevNoteIdx = i;
            }
        }
        cleanNotes.push(note);
    }

    //safe to grab from prev bc this will never be the note that is being removed in cleanNotes bc its from the newPart 
    const prevNote = notes[prevNoteIdx];
    console.log(prevNoteIdx, prevNote, notes);

    let partClef: Clefs = 'Treble';

    const updatedNotes = cleanNotes.map(note => {
        //add to newPart
        if (note.part === newPart) {
            partClef = note.type === 'rest' ? note.pitch.clef : note.pitches[0].clef;
            //not greater than or equal to bc if decide to change the part into a part that has a note there alr 
            //that note there alr should stay in place and the shifting note should shift based on that notes dur 
            if (note.offset > currOffset) {
                return { ...note, offset: note.offset + duration };
            }
        }
        //remove from currPart
        else if (note.part === currPart) {
            if (note.offset > currOffset) {
                return { ...note, offset: note.offset - duration };
            }
        }
        return note;
    });

    const newNote = {
        ...currNote,
        part: newPart,
        offset: prevNote.offset + prevNote.duration,
        //need to adjust to the parts clef when joining a new part 
        clef: partClef,
    }
    if (newNote.type === 'rest') {
        newNote.pitch.clef = partClef
    }
    else {
        newNote.pitches = newNote.pitches.map(p => ({ ...p, clef: partClef }))
    }
    //don't need to worry about auto pitch shifting bc of the note colouring in sheetmusicrenderer
    updatedNotes.push(newNote);

    setNotes(updatedNotes);

    stateManager.addAction(currNote, newNote.offset, newNote.part, newNote.duration);
    setPopup({
        ...popup,
        noteIdx: notes.length - 1,
    })
}

export function snapToAcceptableRangeInClef(
    clef: Clefs,
    note: Note,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    noteIdx: number,
    stateManager: StateManager,
) {
    if (note.type === 'rest') return;

    setNotes(prev => {

        const occupiedPitches = new Set<PitchedPitch>();

        prev.forEach((n, idx) => {
            if (n.offset == note.offset && idx !== noteIdx && n.type !== 'rest') {
                n.pitches.forEach(p => occupiedPitches.add(p));
            }
        })

        //all the notes of that offset's pitches flattened out into the desired clef
        const convertedPitches = new Set<string>();
        occupiedPitches.forEach(p => convertedPitches.add(convert_pitch_between_clefs(p.pitch, p.clef, clef)));

        const takenPitches = [...convertedPitches];
        const newPitches = note.pitches.map(_ => {
            const newPitch = find_next_avail_pitch(takenPitches, clef);
            takenPitches.push(newPitch);
            return {
                pitch: newPitch,
                clef,
            }
        })

        const updated = [...prev];
        updated[noteIdx] = { ...updated[noteIdx] as PitchedNote, pitches: newPitches };

        return updated;
    })

    stateManager?.addAction(note, note.offset, note.part, note.duration);

}

export function deleteAllInRange(
    startingOffset: number,
    endingOffset: number,
    notes: Note[],
    stateManager?: StateManager,
    toaster?: Toaster,
): { updatedNotes: Note[], deletedNotes: ComplexActionItem[] } {
    if (startingOffset >= endingOffset) return { updatedNotes: notes, deletedNotes: [] };

    const updatedNotes: Note[] = [];
    const deletedNotes: Note[] = [];

    //part, Note for both b4 and after
    const pre_suf_ix_notes_by_parts = notes.reduce<Map<Note['part'], { before?: Note, after?: Note }>>((acc, note) => {
        const bounds = acc.get(note.part) ?? {};

        //before
        if (note.offset < startingOffset) {
            if (!bounds.before || note.offset > bounds.before.offset) {
                bounds.before = note;
            }
        }

        //after
        if (note.offset >= endingOffset) {
            if (!bounds.after || note.offset < bounds.after.offset) {
                bounds.after = note;
            }
        }

        acc.set(note.part, bounds);
        return acc;
    }, new Map());

    const shiftAmntsByPart = new Map<number, number>(); //part, shift amnt
    for (const [part, bound] of pre_suf_ix_notes_by_parts) {
        if (!bound.after) {
            //dw abt shifting here bc this means no notes come after so we'd be shifting 
            //the notes that don't exist back by 0
            shiftAmntsByPart.set(part, 0);
            continue;
        }
        let newFirstNoteOffset = 0
        //default to 0 as the starting offset if no notes come b4 in this part 
        if (bound.before) {
            newFirstNoteOffset = bound.before.offset + bound.before.duration
        }
        shiftAmntsByPart.set(part, bound.after.offset - newFirstNoteOffset);
    }

    for (const note of notes) {
        //should be <= bc we're working in ref to the note right before which should be included
        if (note.offset < startingOffset) {
            updatedNotes.push(note); //before delete region, leave untouched
            continue;
        }
        if (note.offset >= endingOffset) {
            const shift = shiftAmntsByPart.get(note.part);
            if (!shift) //handles both 0 and undefined which would happen if we try to access a part that doesn't exist in the sheetmusic (impossible)
                updatedNotes.push(note);
            else updatedNotes.push({ ...note, offset: note.offset - shift });
            continue;
        }
        deletedNotes.push(note);
    }

    const diff = deletedNotes.length;
    if (diff > 0) {
        toaster?.add_message(`${diff} note${diff !== 1 ? 's' : ''} successfully deleted.`, 'var(--success-colour)')
    }

    const stateManagerNotes = deletedNotes.map(n => ({ prevData: n }))
    if (stateManager) {
        stateManager.addComplexAction(stateManagerNotes)
    }

    return { updatedNotes, deletedNotes: stateManagerNotes };
}

export function copyNotesOffsetJustified(
    startingOffset: number,
    endingOffset: number,
    notes: Note[]
) {
    const notesByPart = new Map<number, Note[]>();
    for (const note of notes) {
        if (note.offset >= startingOffset && note.offset < endingOffset) {
            const partGroup = notesByPart.get(note.part);
            if (!partGroup) {
                notesByPart.set(note.part, [note]);
                continue;
            }
            notesByPart.set(note.part, [...partGroup, note]);
        }
    }

    const justifiedNotes = new Map<number, Note[]>();

    for (const [part, partNotes] of notesByPart) {
        const lowestPartOffset = Math.min(...partNotes.map(n => n.offset));
        const shiftedNotes = partNotes.map(note => ({
            ...note,
            offset: note.offset - lowestPartOffset
        }));
        justifiedNotes.set(part, shiftedNotes);
    }

    return justifiedNotes;

}

export function insertNotesAt(
    insertOffset: number,
    currNotes: Note[],
    insertNotes: ReturnType<typeof copyNotesOffsetJustified>,
): { updatedNotes: Note[], addedNotes: ComplexActionItem[] } {

    let updatedNotes: Note[] = []

    const closestNotesByPartB4InsertOffset = new Map<number, Note>();
    const notesAfterInsertOffsetByPart = new Map<number, Note[]>();
    const partsToCheck = new Set(insertNotes.keys());
    //finds the closest note in the notes list as it is right now to the insertOffset for each part that's going to be added in 
    for (const note of currNotes) {
        //makes sure that this note is worth actually checking
        if (partsToCheck.has(note.part)) {
            //looking for prev note 
            if (note.offset < insertOffset) {
                const closestSoFar = closestNotesByPartB4InsertOffset.get(note.part);
                //the note with the highest offset that comes before the insertOffset and is in this part will be the prev note
                if (!closestSoFar || note.offset > closestSoFar.offset) {
                    closestNotesByPartB4InsertOffset.set(note.part, note);
                }
                updatedNotes.push(note); //add here bc nothing needs to change w the notes b4
            }
            //looking at all notes after
            else {
                const currNotes = notesAfterInsertOffsetByPart.get(note.part) ?? [] as Note[];
                notesAfterInsertOffsetByPart.set(note.part, [...currNotes, note]);
            }
        }
        //push here bc nothing needs to change w these notes 
        else updatedNotes.push(note);
    }

    const addedNotes: Note[] = [];

    partsToCheck.forEach(part => {
        const prevNote = closestNotesByPartB4InsertOffset.get(part);

        let insertOffsetShift = 0;
        //if the cursor is at the beginning 
        if (prevNote) insertOffsetShift = prevNote.offset + prevNote.duration;

        const newInsertNotes = insertNotes.get(part)?.map(note => ({ ...note, offset: note.offset + insertOffsetShift })) ?? [];

        let insertNotesTotalDur = 0;
        newInsertNotes.forEach(note => insertNotesTotalDur += note.duration)

        const newAfterNotes = notesAfterInsertOffsetByPart.get(part)?.map(note => ({
            ...note,
            offset: note.offset + insertNotesTotalDur
        })) ?? [];

        updatedNotes = [...updatedNotes, ...newInsertNotes, ...newAfterNotes];

        newInsertNotes.forEach(n => addedNotes.push(n));

    })

    if (updatedNotes.length === 0) return { updatedNotes: currNotes, addedNotes: [] }; //temp fallback
    return { updatedNotes, addedNotes: addedNotes.map(n => ({ currDur: n.duration, currPart: n.part, currOffset: n.offset })) };

}

export function pasteNotesRangeSelected(
    selectedRangeStartingOffset: number,
    selectedRangeEndingOffset: number,
    notes: Note[],
    copiedNotes: ReturnType<typeof copyNotesOffsetJustified>,
    stateManager: StateManager,
    toaster?: Toaster,
) {
    //first delete all of the stuff that is highlighted (provides overwrite functionality)
    const cleanedNotes = deleteAllInRange(
        selectedRangeStartingOffset,
        selectedRangeEndingOffset,
        notes
    )
    // then insert the notes at the starting location
    const updatedNotes = insertNotesAt(
        selectedRangeStartingOffset,
        cleanedNotes.updatedNotes,
        copiedNotes,
    )

    stateManager.addComplexAction([...cleanedNotes.deletedNotes, ...updatedNotes.addedNotes])

    const diff = updatedNotes.updatedNotes.length - cleanedNotes.updatedNotes.length;
    if (diff > 0) {
        toaster?.add_message(`${diff} note${diff !== 1 ? 's' : ''} successfully pasted.`, 'var(--success-colour)')
    }

    return updatedNotes;
}