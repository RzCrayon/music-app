import { useCallback, type Dispatch, type SetStateAction } from "react";
import { CLEF_TYPES, type Clefs, type ComplexActionItem, type Instruments, type Note, type PitchedNote, type PitchedPitch, type RestNote, type RestPitch, type StateManager, type Toaster } from "../services/types";
import { clean_pitch, get_accidental, snap_to_valid_dur, VALID_DURS } from "./sheetmusic_processor";

export const ERRS = {
    UNINITIALISED_ERR: 'History State Uninitialised',
    //say 'failure to store changes' in the frontend processing
    INVALID_ACTION_ERR: 'Invalid Action',
    EMPTY_SET_ERR: 'No Actions to Undo'
}

export function useSheetMusicStateManager(toaster: Toaster): StateManager {

    //consider dropping to 100kb
    const maxStorageSize = 0.5 //in mb

    //not stored as an array... instead stored as a single string seperated by |
    const initManager = useCallback(() => {
        sessionStorage.setItem('history', '')
    }, []);
    const releaseManager = useCallback(() => sessionStorage.removeItem('history'), []);
    const clearManager = useCallback(() => sessionStorage.setItem('history', ''), [])

    //prev is optional bc if its a new note there wont be a prev
    //curr remembers the offset, part and dur... and if necessary it remembers the chordidx which indicates that the change was on that chord idx and then that means that the pitch of that chord idx should be restored to what's memorised in the prevData
    const clefPattern = CLEF_TYPES.join('|');
    const singlePitchPairPattern = `(?:[A-G][#\\-]?[0-9]|RE)(?:${clefPattern})`;
    const notesGroupPattern = `(?<notes>${singlePitchPairPattern}(?:,${singlePitchPairPattern})*)?`;
    const durationPattern = `(?:[0-3](?:\\.\\d+)?|4(?:\\.0+)?)`;
    // const durationPattern = `(?:[0-5](?:\\.\\d+)?|6(?:\\.0+)?)`;
    //comma seperate all the fields in here 
    const compressionRegex = new RegExp(
        `^(?:(?<prev>P(?<prev_offset>\\d+(?:\\.\\d+)?),(?<prev_dur>${durationPattern}),(?<prev_part>\\d+),(?<prev_type>[NCR]),${notesGroupPattern})?(?<curr>P(?<curr_offset>\\d+(?:\\.\\d+)?),(?<curr_dur>${durationPattern}),(?<curr_part>\\d+))?)$`
    );

    interface ParsedAction {
        type: 'ADD' | 'DELETE' | 'EDIT';
        prevData?: {
            offset: number;
            duration: number;
            part: number;
            type: 'note' | 'chord' | 'rest';
            pitches: { pitch: string | null; clef: Clefs }[];
        };
        currData?: {
            offset: number;
            duration: number;
            part: number;
        };
    }

    interface ClearedParsedAction {
        type: 'ADD' | 'DELETE' | 'EDIT';
        prevData: {
            offset: number;
            duration: number;
            part: number;
            type: 'note' | 'chord' | 'rest';
            pitches: { pitch: string | null; clef: Clefs }[];
        };
        currData: {
            offset: number;
            duration: number;
            part: number;
        };
    }

    function parseAction(actionStr: string): ParsedAction {
        const match = compressionRegex.exec(actionStr);
        if (!match || !match.groups) {
            throw new Error(ERRS.INVALID_ACTION_ERR);
        }

        const {
            prev, prev_offset, prev_dur, prev_part, prev_type, notes,
            curr, curr_offset, curr_dur, curr_part
        } = match.groups;

        let type: 'ADD' | 'DELETE' | 'EDIT' = 'EDIT';
        if (prev && !curr) type = 'DELETE';
        if (curr && !prev) type = 'ADD';

        const result: ParsedAction = { type };

        const parseMusicFloat = (value: string): number => {
            const parsed = parseFloat(value);
            //round to 4 decimal places to avoid floating point math
            return Math.round(parsed * 10000) / 10000;
        };

        if (prev) {
            const typeMapping: Record<string, 'note' | 'chord' | 'rest'> = {
                N: 'note',
                C: 'chord',
                R: 'rest'
            };

            let parsedPitches: { pitch: string | null, clef: Clefs }[] = []
            if (notes) {
                parsedPitches = notes.split(',').map(segment => {
                    const clef = CLEF_TYPES.find(c => segment.endsWith(c)) as Clefs;
                    const pitch = segment.slice(0, -clef.length);
                    return { pitch: pitch === 'RE' ? null : pitch, clef };
                });
            }

            result.prevData = {
                offset: parseMusicFloat(prev_offset),
                duration: parseMusicFloat(prev_dur),
                part: parseInt(prev_part, 10),
                type: typeMapping[prev_type] || 'note',
                pitches: parsedPitches
            };
        }

        if (curr) {
            result.currData = {
                offset: parseMusicFloat(curr_offset),
                duration: parseMusicFloat(curr_dur),
                part: parseInt(curr_part, 10)
            };
        }

        return result;
    }

    function compressData(
        prevData?: Note,
        currOffset?: number,
        currPart?: number,
        currDur?: number,
    ) {
        let compressedData = '';
        //means that its a new note
        if (prevData === undefined) {
            if (currDur === undefined || currPart === undefined || currOffset === undefined) throw new Error(ERRS.INVALID_ACTION_ERR);
            compressedData = `P${currOffset},${currDur},${currPart}`
        }
        //means that a note was deleted
        else if (currOffset === undefined || currPart === undefined || currDur === undefined) {
            if (!prevData) throw new Error(ERRS.INVALID_ACTION_ERR);
            compressedData = `P${prevData.offset},${prevData.duration},${prevData.part},${prevData.type[0].toUpperCase()},`
            if (prevData.type !== 'rest') {
                compressedData += prevData.pitches.map(p => `${p.pitch}${p.clef}`).join(',');
            }
            else compressedData += `RE${prevData.pitch.clef}`
        }
        //means that a note was editted 
        else {
            compressedData = `P${prevData.offset},${prevData.duration},${prevData.part},${prevData.type[0].toUpperCase()},`
            if (prevData.type !== 'rest') {
                compressedData += prevData.pitches.map(p => `${p.pitch}${p.clef}`).join(',');
            }
            else compressedData += `RE${prevData.pitch.clef}`
            compressedData += `P${currOffset},${currDur},${currPart}`;
        }
        return compressedData;
    }

    function manageStorage(newHistory: string) {
        //storage limit for history 
        let historySize = newHistory.length * 2 / 1024 / 1024
        while (historySize >= maxStorageSize) {
            const firstPipeIndex = newHistory.indexOf('|');
            if (firstPipeIndex === -1) {
                break;
            }
            //slice off the oldest history point if we exceed the storage limit 
            newHistory = newHistory.substring(firstPipeIndex + 1);
            historySize = (newHistory.length * 2) / 1024 / 1024;
        }
    }

    //in this model adding / removing a note isn't the same as adding / removing a chord 
    const addAction = useCallback((
        prevData?: Note | undefined,
        currOffset?: number | undefined,
        currPart?: number | undefined,
        currDur?: number | undefined,
    ) => {
        try {
            //don't let us add if there's no history 
            const historyPack = sessionStorage.getItem('history');
            if (historyPack === null) {
                throw new Error(ERRS.UNINITIALISED_ERR);
            }

            const compressedData = compressData(prevData, currOffset, currPart, currDur);

            if (!compressionRegex.test(compressedData)) {
                throw new Error(ERRS.INVALID_ACTION_ERR)
            }

            let newHistory = historyPack === '' ? compressedData : `${historyPack}|${compressedData}` //so that our data doesn't start with a leading |

            //storage limit for history 
            manageStorage(newHistory);

            sessionStorage.setItem('history', newHistory);
            // console.log('new history', newHistory);

        }
        catch {
            toaster.add_message("Couldn't save action to history.")
        }
    }, [])

    //a complex action is a collection of actions that happened all at once (like a bunch of deletes or a bunch of adds)
    //not rly worried abt a bunch of note edits happening all at once bc 
    //   1. rn that can't happen & 2. it doesn't matter what order that happens in bc it would be just one shift up/down in pitch/dur across multiple notes so the order in which u shift them back doesn't matter
    //bc we keep a running list the offsets have to be ordered in increasing order if it was a delete (part doesn't matter bc the shifting happens based on offset and excludes parts) so that when they're added back in they're added to their correct prior offsets
    //adds have to be ordered in decreasing order
    //if action contains multiple types the type order is additions -> deletions -> edits
    const addComplexAction = useCallback((
        actionData: ComplexActionItem[],
        //to support changing an instrument
        oldInstrument?: Instruments,
    ) => {
        try {
            const historyPack = sessionStorage.getItem('history');
            if (historyPack === null) {
                throw new Error(ERRS.UNINITIALISED_ERR);
            }

            let additions: ComplexActionItem[] = [];
            let deletions: ComplexActionItem[] = [];
            const edits: ComplexActionItem[] = [];

            actionData.forEach(axn => {
                //deletion
                if (axn.prevData) {
                    if (axn.currDur === undefined) {
                        deletions.push(axn);
                    }
                    else edits.push(axn);
                }
                else additions.push(axn);
            })

            //sort additions in decreasing order
            additions = additions.sort((a, b) => (b.currOffset ?? 0) - (a.currOffset ?? 0));
            //sort deletions in increasing order
            deletions = deletions.sort((a, b) => (a.prevData?.offset ?? 0) - (b.prevData?.offset ?? 0))

            const actionClxn = [...additions, ...deletions, ...edits];

            let compressedData = actionClxn
                .map(axn => {
                    const regex = compressData(axn.prevData, axn.currOffset, axn.currPart, axn.currDur);
                    if (!compressionRegex.test(regex)) {
                        throw new Error(ERRS.INVALID_ACTION_ERR);
                    }
                    return regex;
                })
                .join('/');
            if (oldInstrument) compressedData += `/*${oldInstrument}*`

            let newHistory = historyPack === '' ? `[${compressedData}]` : `${historyPack}|[${compressedData}]`;

            manageStorage(newHistory);

            sessionStorage.setItem('history', newHistory);

            // console.log('new history', newHistory);
        }
        catch {
            toaster.add_message("Couldn't save actions to history.")
        }
    }, [])

    const undo = useCallback((
        setNotes: Dispatch<SetStateAction<Note[]>>,
        setInstrument?: (newInstrument: Instruments) => void,
    ) => {

        const historyPack = sessionStorage.getItem('history');
        try {
            if (historyPack === null) throw new Error(ERRS.UNINITIALISED_ERR);
            if (historyPack === '') throw new Error(ERRS.EMPTY_SET_ERR);

            try {
                let lastAction = '';
                const lastPipeIdx = historyPack.lastIndexOf('|');
                if (lastPipeIdx !== -1) lastAction = historyPack.slice(lastPipeIdx + 1);
                else lastAction = historyPack //only one thing in the history 

                let actionData = null;
                if (lastAction.charAt(0) === '[') {
                    let actionDataList = lastAction.replace('[', '').replace(']', '').split('/')
                    if (actionDataList.at(-1)?.charAt(0) === "*" && setInstrument) {//undoing an instrument change
                        setInstrument(actionDataList.at(-1)!.replace(/\*/g, '') as Instruments);
                        actionDataList = actionDataList.slice(0, -1);
                    }
                    actionData = actionDataList.map(axn => parseAction(axn));
                }
                else actionData = [parseAction(lastAction)];

                //for some rzn the parsing didn't work
                if (actionData === null) throw new Error(ERRS.INVALID_ACTION_ERR);

                const removeNote = (actionData: ClearedParsedAction, prev: Note[]) => {
                    const updatedNotes: Note[] = [];
                    for (const note of prev) {
                        if (note.part === actionData.currData.part) {
                            if (note.offset === actionData.currData.offset) continue;
                            else if (note.offset > actionData.currData.offset) {
                                updatedNotes.push({ ...note, offset: note.offset - actionData.currData.duration });
                            }
                            else updatedNotes.push(note);
                        }
                        else updatedNotes.push(note);
                    }
                    return updatedNotes;
                }

                const addNoteBackIn = (actionData: ClearedParsedAction, prev: Note[]) => {
                    const updatedNotes = prev.map(note => {
                        if (!actionData.prevData) return note;
                        if (note.part === actionData.prevData.part && note.offset >= actionData.prevData.offset) {
                            return { ...note, offset: note.offset + actionData.prevData.duration };
                        }
                        return note;
                    });
                    updatedNotes.push(
                        actionData.prevData.type === 'rest'
                            ? {
                                offset: actionData.prevData.offset,
                                duration: actionData.prevData.duration,
                                part: actionData.prevData.part,
                                type: actionData.prevData.type,
                                pitch: actionData.prevData.pitches[0] as RestPitch,
                            }
                            : {
                                offset: actionData.prevData.offset,
                                duration: actionData.prevData.duration,
                                part: actionData.prevData.part,
                                type: actionData.prevData.type,
                                pitches: actionData.prevData.pitches as PitchedPitch[],
                            }
                    )
                    return updatedNotes;
                }

                const restoreNote = (actionData: ClearedParsedAction, prev: Note[]) => {
                    if (!actionData.currData || !actionData.prevData) throw new Error(ERRS.INVALID_ACTION_ERR);
                    //part change
                    if (actionData.currData.part !== actionData.prevData.part) {
                        //remove note from the notes 
                        const cleanNotes = prev.filter(note =>
                            !(note.part === actionData.currData!.part && note.offset === actionData.currData!.offset)
                        );

                        //same operation every single time... add back to the prevData.part and remove from the currData.part
                        const updatedNotes = cleanNotes.map(note => {
                            if (!actionData.currData || !actionData.prevData) return note;

                            if (note.part === actionData.prevData.part) {
                                if (note.offset >= actionData.prevData.offset) {
                                    return { ...note, offset: note.offset + actionData.prevData.duration };
                                }
                            } else if (note.part === actionData.currData.part) {
                                if (note.offset > actionData.currData.offset) {
                                    return { ...note, offset: note.offset - actionData.currData.duration };
                                }
                            }
                            return note;
                        });

                        //re-add the previous note 
                        updatedNotes.push(
                            actionData.prevData.type === 'rest'
                                ? {
                                    offset: actionData.prevData.offset,
                                    duration: actionData.prevData.duration,
                                    part: actionData.prevData.part,
                                    type: actionData.prevData.type,
                                    pitch: actionData.prevData.pitches[0] as RestPitch,
                                }
                                : {
                                    offset: actionData.prevData.offset,
                                    duration: actionData.prevData.duration,
                                    part: actionData.prevData.part,
                                    type: actionData.prevData.type,
                                    pitches: actionData.prevData.pitches as PitchedPitch[],
                                }
                        );

                        return updatedNotes;
                    }
                    //duration change
                    else if (actionData.currData.duration !== actionData.prevData.duration) {
                        const deltaDur = actionData.currData.duration - actionData.prevData.duration;
                        return prev.map(note => {
                            if (!actionData.currData || !actionData.prevData) return note;
                            if (note.part === actionData.currData.part) {
                                if (note.offset === actionData.currData.offset) return { ...note, duration: actionData.prevData.duration };
                                //need to subtract bc when we're going from smaller dur back to bigger dur the deltaDur is negative but we have to shift the 
                                //data to the right which means we need to ADD the dur to the offset
                                else if (note.offset > actionData.currData.offset) return { ...note, offset: note.offset - deltaDur };
                                else return note;
                            }
                            return note;
                        })
                    }
                    //pitch change
                    return prev.map(note => {
                        if (!actionData.currData || !actionData.prevData) return note;
                        if (note.part === actionData.currData.part && note.offset === actionData.currData.offset) {
                            return {
                                ...note,
                                type: actionData.prevData.type,
                                ...(actionData.prevData.type === 'rest'
                                    ? { pitch: actionData.prevData.pitches[0] as RestPitch }
                                    : { pitches: actionData.prevData.pitches as PitchedPitch[] })
                            } as Note;
                        }
                        return note;
                    });
                }

                setNotes(prev => {
                    if (!actionData) return prev;
                    let runningList = [...prev];
                    actionData.forEach(axn => {
                        //if the last action was adding the note then we need to remove it 
                        if (axn.type === 'ADD' && axn.currData) {
                            runningList = [...removeNote(axn as ClearedParsedAction, runningList)];
                        }
                        //the last action was a deletion so now we need to add that note back in 
                        else if (axn.type === 'DELETE' && axn.prevData) {
                            runningList = [...addNoteBackIn(axn as ClearedParsedAction, runningList)];
                        }
                        //the last action was an edit so now we need to restore the note back to what it was
                        else {
                            runningList = [...restoreNote(axn as ClearedParsedAction, runningList)];
                        }
                    })
                    return runningList;
                })

                const remainingHistory = lastPipeIdx !== -1 ? historyPack.slice(0, lastPipeIdx) : '';
                sessionStorage.setItem('history', remainingHistory);
                // console.log('remaining history', remainingHistory);

            }
            catch {
                toaster.add_message("Failed to undo.");
            }

        }
        catch (err: any) {
            const mssg = err instanceof Error ? err.message : err;
            if (mssg === ERRS.EMPTY_SET_ERR) toaster.add_message(mssg, 'color-mix(brown 30%, var(--warning-colour) 70%)')
        }

    }, []);

    return { initManager, releaseManager, clearManager, addAction, addComplexAction, undo }

}