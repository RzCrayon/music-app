import { memo, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { type Clefs, type Instruments, type Note, type NotePitch, type ParsedTimeSig, type PitchedNote, type PitchedPitch, type PopupNoteState, type PopupState, type RestNote, type StateManager, type Toaster, CLEF_TYPES } from "../services/types";
import { clean_pitch, defaultNewNote, voiceColours } from "./SheetMusicRenderer";
import './NoteEditorPopup.css'
import { adjust_pitch, dotted, find_next_avail_pitch, get_pitch_from_y, snap_to_valid_dur, VALID_DURS } from "./sheetmusic_processor";

import { FaTrash } from "react-icons/fa";
import { HiMinus } from "react-icons/hi";
import { HiPlus } from "react-icons/hi2";
import { IoIosArrowUp, IoIosArrowDown, IoMdCheckmark, IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import { INSTRUMENT_CLEF_TABLE } from "../services/key_map_lib";
import { FaCaretDown } from "react-icons/fa";
import { IoIosSettings } from "react-icons/io";
import Info, { Tooltip } from "../components/Info";
import { DeleteWarning } from "../components/ModalDialog";
import { addNoteLeft, addNoteRight, adjustPitch, decreaseNoteDur, deleteNote, dotNote, increaseNoteDur, nextNote, prevNote, shiftPart, snapToAcceptableRangeInClef } from "./sheetmusic_mod_funcs";

const VOICE_MSSG = "A voice is a chord that isn't inherintely linked in duration or start beat to another note like a chord is."
const INFO_MIN_WIDTH = 300

function numberToFraction(number: number): string {
    if (Number.isInteger(number)) return `${number}`;

    const sign = number < 0 ? "-" : "";
    const absoluteNumber = Math.abs(number);

    const wholeNumber = Math.floor(absoluteNumber);
    const decimalPart = absoluteNumber - wholeNumber;

    const decimalStr = decimalPart.toString().split('.')[1] || '';
    const denominator = Math.pow(10, decimalStr.length);
    const numerator = Math.round(decimalPart * denominator);

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(numerator, denominator);

    const finalNumerator = numerator / divisor;
    const finalDenominator = denominator / divisor;

    if (wholeNumber === 0) {
        return `${sign}${finalNumerator}/${finalDenominator}`;
    }

    return `${sign}${wholeNumber} ${finalNumerator}/${finalDenominator}`;
}

export const VOICE_LIMITS: Record<Instruments, number> = {
    //polyphonic instruments
    'piano': 4,
    'guitar': 2,

    //monophonic instruments
    'violin': 1,
    'viola': 1,
    'cello': 1,
    'trumpet': 1,
    'flute': 1,
    'saxophone': 1,
}

export const keyboardNoteAlteration = (
    e: KeyboardEvent,
    notes: Note[],
    popup: NewPopup,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    parsed_time_sig: ParsedTimeSig,
    instrument: Instruments,
    stateManager?: StateManager,
) => {

    const currNote = notes[popup.noteIdx];
    if (!currNote) return;

    if (e.key === "ArrowDown" || e.key.toUpperCase() === 'S') {
        e.preventDefault();
        if (currNote.type !== 'rest') {
            adjustPitch(
                'down',
                currNote.pitches[popup.pitchIdx],
                popup.noteIdx,
                popup.pitchIdx,
                setNotes,
                currNote,
                stateManager,
            )
        }
    }
    else if (e.key === "ArrowUp" || e.key.toUpperCase() === 'W') {
        e.preventDefault();
        if (currNote.type !== 'rest') {
            adjustPitch(
                'up',
                currNote.pitches[popup.pitchIdx],
                popup.noteIdx,
                popup.pitchIdx,
                setNotes,
                currNote,
                stateManager,
            )
        }
    }

    //can use e.repeat instead of holding_down
    else if ((e.key === 'ArrowRight' || e.key.toUpperCase() === 'D') && !e.repeat) {
        e.preventDefault();
        addNoteRight(popup, parsed_time_sig, setNotes, setPopup, notes, stateManager);
    }
    else if ((e.key === 'ArrowLeft' || e.key.toUpperCase() === 'A') && !e.repeat) {
        e.preventDefault();
        addNoteLeft(popup, currNote, parsed_time_sig, setNotes, setPopup, notes, stateManager);
    }

    else if (e.key.toUpperCase() === 'Q' && !e.repeat) {
        e.preventDefault();
        decreaseNoteDur(currNote, notes, setNotes, stateManager);
    }
    else if (e.key.toUpperCase() === 'E' && !e.repeat) {
        e.preventDefault();
        increaseNoteDur(currNote, notes, setNotes, stateManager);
    }
    else if (e.key.toUpperCase() === 'R' && !e.repeat) {
        e.preventDefault();
        dotNote(currNote, notes, setNotes, stateManager);
    }

    else if (e.key.toLowerCase() === 'backspace' && !e.repeat) {
        e.preventDefault();
        deleteNote(popup, setNotes, setPopup, true, notes, stateManager);
    }

    // this is okay to use notes bc these aren't commands that can be gotten from the popup which doesn't get notes passed in 
    else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.repeat) return;
        if (e.shiftKey) {
            prevNote(popup, setPopup, notes);
        } else {
            nextNote(popup, setPopup, notes);
        }
    }
};

function ClefControl({
    popup,
    instrument,
    setNotes,
    currNote,
    notes,
    stateManager,
}: {
    popup: NewPopup,
    instrument: Instruments,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    currNote: Note,
    notes: Note[],
    stateManager: StateManager,
}) {

    const getClef = () => {
        const targetClef: Clefs = currNote.type === 'rest'
            ? currNote.pitch.clef
            : currNote.pitches[0]?.clef;
        return INSTRUMENT_CLEF_TABLE[instrument].findIndex(clef => clef === targetClef);
    }
    const currClef = useMemo<number>(() => getClef(), [popup]);

    const [warningOpen, setWarningOpen] = useState(false)
    const [newClef, setNewClef] = useState<Clefs>(CLEF_TYPES[currClef]);

    return (
        <div className="voice-clef">
            Display Clef:
            <div
                className="clef-list-container"
            >
                <div
                    className="clef-list"
                    style={{
                        transform: `translateY(${-currClef * 41}px)`
                    }}
                >
                    {
                        INSTRUMENT_CLEF_TABLE[instrument].map((clef, idx) => (
                            <div key={`clef-${idx}`}>{clef}</div>
                        ))
                    }
                </div>
            </div>
            <DeleteWarning
                showMssg={warningOpen}
                setShowMssg={setWarningOpen}
                mssg={`Changing the display clef of this note works globally, and will change the display clef of all other notes in voice ${currNote.part + 1}.`}
                deleteButtonMssg="Yep, go for it"
                deleteProcess={() => {
                    const clefShiftedNotes: Note[] = []
                    const thisPart = currNote.part;
                    const updated = notes.map(note => {
                        if (note.part === thisPart) {
                            clefShiftedNotes.push(note);
                            if (note.type === 'rest') {
                                return (
                                    {
                                        ...note,
                                        pitch: { pitch: null, clef: newClef }
                                    }
                                )
                            }
                            else {
                                return (
                                    {
                                        ...note,
                                        pitches: note.pitches.map(p => ({ ...p, clef: newClef }))
                                    }
                                )
                            }
                        }
                        return note;
                    })
                    setNotes(updated);
                    stateManager.addComplexAction(clefShiftedNotes.map(n => ({
                        prevData: n,
                        currDur: n.duration,
                        currOffset: n.offset,
                        currPart: n.part
                    })));
                    // setNotes(prev => {
                    //     const thisPart = currNote.part;
                    //     return prev.map(note => note.part === thisPart
                    //         ? (note.type === 'rest'
                    //             ? {
                    //                 ...note,
                    //                 pitch: { pitch: null, clef: newClef }
                    //             }
                    //             : {
                    //                 ...note,
                    //                 pitches: note.pitches.map(p => ({ ...p, clef: newClef }))
                    //             })
                    //         : note
                    //     )
                    // })
                }}
            />
            <div className="clef-list-control-buttons">
                <div
                    onClick={() => {
                        if (currClef === 0) return;
                        setWarningOpen(true);
                        setNewClef(CLEF_TYPES[currClef - 1]);
                    }}
                    className={`clef-control-button top ${currClef === 0 ? 'disabled' : ''}`}
                >
                    <IoIosArrowUp />
                </div>
                <div
                    className={`clef-control-button bottom ${currClef === INSTRUMENT_CLEF_TABLE[instrument].length - 1 ? 'disabled' : ''}`}
                    onClick={() => {
                        if (currClef === INSTRUMENT_CLEF_TABLE[instrument].length - 1) return;
                        setWarningOpen(true);
                        setNewClef(CLEF_TYPES[currClef + 1]);
                    }}
                >
                    <IoIosArrowDown />
                </div>
            </div>
        </div>
    )
}

const PitchAdder = memo(function PitchAdder({
    pitchData, //pitchData won't exist if the type is rest so we don't need a seperate reference to type 
    setNotes,
    in_notes_idx,
    pitch_idx,
    stateManager,
    oldNote,
}: {
    in_notes_idx: number,
    pitch_idx: number,
    setNotes: Dispatch<SetStateAction<Note[]>>,
    oldNote: Note,
    pitchData?: PitchedPitch,
    stateManager: StateManager
}) {

    const atUpperRangeLimit = pitchData ? adjust_pitch(pitchData.pitch, 'up', pitchData.clef) === pitchData.pitch : true;
    const atLowerRangeLimit = pitchData ? adjust_pitch(pitchData.pitch, 'down', pitchData.clef) === pitchData.pitch : true;

    return (
        <div className="pitch-adder">
            {
                atUpperRangeLimit && atLowerRangeLimit ? (
                    <>
                        {
                            pitchData && (
                                <Tooltip
                                    mssg={
                                        <div>
                                            <div>Note is outside of the range for {pitchData.clef}.</div>
                                            <div>Click to snap note to first available pitch in {pitchData.clef}.</div>
                                        </div>
                                    }
                                    minWidth={300}
                                    content={
                                        <div
                                            className="snap-to-range-button"
                                            onClick={() => snapToAcceptableRangeInClef(pitchData.clef, oldNote, setNotes, in_notes_idx, stateManager)}
                                        >
                                            Snap into range.
                                        </div>
                                    }
                                    bgColor="var(--err-colour)"
                                />
                            )
                        }
                    </>
                ) : (
                    <>
                        {
                            pitchData && (
                                <Tooltip
                                    mssg={
                                        <div>
                                            <strong>You've reached the highest pitch in {pitchData.clef}.</strong>
                                            <div style={{ marginTop: '6px' }}>To write higher notes:</div>
                                            <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', lineHeight: '1.4' }}>
                                                <li style={{ marginBottom: '8px' }}>
                                                    <span>Move this note to a different voice</span>
                                                    <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                                                        <em>Advanced Options → Voice</em>
                                                    </div>
                                                </li>
                                                <li>
                                                    <span>Switch the voice's clef</span>
                                                    <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                                                        <em>Advanced Options → Voice → Display Clef</em>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    }
                                    minWidth={300}
                                    content={
                                        <div
                                            className={`pitch-control-button ${atUpperRangeLimit ? 'disabled' : ''}`}
                                            onClick={() => adjustPitch(
                                                'up',
                                                pitchData,
                                                in_notes_idx,
                                                pitch_idx,
                                                setNotes,
                                                oldNote,
                                                stateManager,
                                            )}
                                        >
                                            <IoIosArrowUp />
                                        </div>
                                    }
                                    renderAllowed={atUpperRangeLimit}
                                />
                            )
                        }
                        <div>{pitchData ? clean_pitch(pitchData.pitch) : 'REST'}</div>
                        {
                            pitchData && (
                                <Tooltip
                                    mssg={
                                        <div>
                                            <strong>You've reached the lowest pitch in {pitchData.clef}.</strong>
                                            <div style={{ marginTop: '6px' }}>To write lower notes:</div>
                                            <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', lineHeight: '1.4' }}>
                                                <li style={{ marginBottom: '8px' }}>
                                                    <span>Move this note to a different voice</span>
                                                    <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                                                        <em>Advanced Options → Voice</em>
                                                    </div>
                                                </li>
                                                <li>
                                                    <span>Switch the voice's clef</span>
                                                    <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                                                        <em>Advanced Options → Voice → Display Clef</em>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    }
                                    minWidth={300}
                                    content={
                                        <div
                                            className={`pitch-control-button ${atLowerRangeLimit ? 'disabled' : ''}`}
                                            onClick={() => adjustPitch(
                                                'down',
                                                pitchData,
                                                in_notes_idx,
                                                pitch_idx,
                                                setNotes,
                                                oldNote,
                                                stateManager,
                                            )}
                                        >
                                            <IoIosArrowDown />
                                        </div>
                                    }
                                    renderAllowed={atLowerRangeLimit}
                                />
                            )
                        }
                    </>
                )
            }
        </div>
    )
})

export type NewPopup = {
    noteIdx: number,
    pitchIdx: number
}

function PopupNoteEditorNoteDisplay({
    // popup,
    // setPopup,
    // setNotes,
    parsed_time_sig,
    sheet_accidental,
    instrument,
    used_parts,
    stateManager,
    popup,
    setPopup,
    setNotes,
    notes,
}: {
    popup: NewPopup,
    setPopup: Dispatch<SetStateAction<NewPopup>>,



    // popup: PopupNoteState,
    // setPopup: Dispatch<SetStateAction<PopupState>>,
    stateManager: StateManager,
    setNotes: React.Dispatch<React.SetStateAction<Note[]>>,
    parsed_time_sig: ParsedTimeSig,
    sheet_accidental: 'Flat' | 'Sharp' | 'Natural',
    instrument: Instruments,
    used_parts: number,
    notes: Note[],
}) {

    const [advancedOptionsOpen, setAdvancedOps] = useState(false);
    const popupNote = useMemo(() => notes[popup.noteIdx], [notes, popup.noteIdx]);
    // useEffect(() => {
    //     if (!popup.visible) setAdvancedOps(false);
    // }, [popup])

    useEffect(() => {
        setAdvancedOps(false);
    }, [popup])

    const pitch_idx = useMemo(() => popup.pitchIdx, [popup.pitchIdx]);

    // if (!popup.noteData || (popup.noteData.type !== 'rest' && !popup.noteData.pitches[pitch_idx])) return <></>;

    const pitch_option_map = {
        rest: popupNote.type === 'rest' ? 'selected' : '',
        natural: sheet_accidental === 'Natural' || popupNote.type === 'rest' ? 'disabled' :
            popupNote.pitches[pitch_idx].pitch.includes('#') || popupNote.pitches[pitch_idx].pitch.includes('-') ? '' : 'selected',
        flat: sheet_accidental === 'Flat' || popupNote.type === 'rest' || popupNote.pitches[pitch_idx].pitch.includes('#') ? 'disabled' :
            popupNote.pitches[pitch_idx].pitch.includes('-') ? 'selected' : '',
        sharp: sheet_accidental === 'Sharp' || popupNote.type === 'rest' || popupNote.pitches[pitch_idx].pitch.includes('-') ? 'disabled' :
            popupNote.pitches[pitch_idx].pitch.includes('#') ? 'selected' : '',
    }

    return (
        <>
            <div className="popover-inner">
                <div className='note-control'>
                    <div
                        className="note-control-button"
                        onClick={() => addNoteLeft(popup, popupNote, parsed_time_sig, setNotes, setPopup, notes, stateManager)}
                    >
                        Add left
                    </div>
                    <div
                        className="note-control-button"
                        onClick={() => addNoteRight(popup, parsed_time_sig, setNotes, setPopup, notes, stateManager)}
                    >
                        Add right
                    </div>
                    <Tooltip
                        content={
                            <div
                                className="note-control-button"
                                onClick={() => deleteNote(popup, setNotes, setPopup, false, notes, stateManager)}
                            >
                                <FaTrash />
                            </div>
                        }
                        mssg={
                            <div>
                                <strong>This deletes the entire chord.</strong>
                                <div style={{ marginTop: '6px' }}>
                                    <span>To remove just this individual pitch go to:</span>
                                    <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                                        <em>Advanced Options → Chord</em>
                                    </div>
                                </div>
                            </div>
                        }
                        minWidth={320}
                        bgColor="var(--err-colour)"
                        renderAllowed={popupNote.type === 'chord'}
                    />
                </div>
                <div className="duration-container">
                    <div className="duration-control">
                        <div>Duration:</div>
                        <div className="duration-adder">
                            <div
                                className={`duration-control-button 
                                ${VALID_DURS.indexOf(snap_to_valid_dur(popupNote.duration)) - 1 < 0 ? 'disabled' : ''}
                            `}
                                onClick={() => decreaseNoteDur(popupNote, notes, setNotes, stateManager)}
                            >
                                <HiMinus />
                            </div>
                            <div>{snap_to_valid_dur(popupNote.duration)}</div>
                            <div
                                className={`duration-control-button 
                                ${VALID_DURS.indexOf(snap_to_valid_dur(popupNote.duration)) + 1 >= VALID_DURS.length ? 'disabled' : ''}
                            `}
                                onClick={() => increaseNoteDur(popupNote, notes, setNotes, stateManager)}
                            >
                                <HiPlus />
                            </div>
                        </div>
                    </div>
                    <div className="duration-options-control">
                        {/* remember the validity of dotting is determined by the time signature */}
                        <div>Dotted?</div>
                        <div
                            className={`checkbox ${dotted(popupNote.duration) ? 'checked' : ''}`}
                            onClick={() => dotNote(popupNote, notes, setNotes, stateManager)}
                        >
                            {dotted(popupNote.duration) && <IoMdCheckmark />}
                        </div>
                    </div>
                </div>
                <div>Pitch:</div>
                <div className="pitch-container">
                    <PitchAdder
                        pitchData={popupNote.type !== 'rest' ? popupNote.pitches[popup.pitchIdx] : undefined}
                        pitch_idx={popup.pitchIdx}
                        setNotes={setNotes}
                        in_notes_idx={popup.noteIdx}
                        stateManager={stateManager}
                        oldNote={popupNote}
                    />
                    <div className="pitch-options-control">
                        <div
                            className={`pitch-option ${pitch_option_map['sharp']}`}
                            onClick={() => {
                                const state = pitch_option_map['sharp']
                                if (state === 'disabled' || popupNote.type === 'rest') return;
                                if (state !== 'selected') {
                                    const pitch = popupNote.pitches[pitch_idx].pitch;
                                    const clef = popupNote.pitches[pitch_idx].clef;
                                    const newNote = {
                                        ...popupNote, pitches: popupNote.pitches.map((p, idx) => pitch_idx === idx
                                            ? { pitch: `${pitch.slice(0, 1)}#${pitch.slice(1)}`, clef }
                                            : p
                                        )
                                    }
                                    setNotes(prev => prev.map((note, idx) =>
                                        idx === popup.noteIdx && note.type !== 'rest' ? newNote : note
                                    ))
                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                }
                                else {
                                    const pitch = popupNote.pitches[pitch_idx].pitch;
                                    const clef = popupNote.pitches[pitch_idx].clef;
                                    const newNote = {
                                        ...popupNote, pitches: popupNote.pitches.map((p, idx) => pitch_idx === idx
                                            ? { pitch: `${pitch.slice(0, 1)}${pitch.slice(2)}`, clef }
                                            : p
                                        )
                                    }
                                    setNotes(prev => prev.map((note, idx) =>
                                        idx === popup.noteIdx && note.type !== 'rest' ? newNote : note
                                    ))
                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                }
                            }}
                        >{'\u266F'}</div>
                        <div
                            className={`pitch-option ${pitch_option_map['flat']}`}
                            onClick={() => {
                                const state = pitch_option_map['flat']
                                if (state === 'disabled' || popupNote.type === 'rest') return;
                                if (state !== 'selected') {
                                    const pitch = popupNote.pitches[pitch_idx].pitch;
                                    const clef = popupNote.pitches[pitch_idx].clef;
                                    const newNote = {
                                        ...popupNote, pitches: popupNote.pitches.map((p, idx) => pitch_idx === idx
                                            ? { pitch: `${pitch.slice(0, 1)}-${pitch.slice(1)}`, clef }
                                            : p
                                        )
                                    }
                                    setNotes(prev => prev.map((note, idx) =>
                                        idx === popup.noteIdx && note.type !== 'rest' ? newNote : note
                                    ))
                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                }
                                else {
                                    const pitch = popupNote.pitches[pitch_idx].pitch;
                                    const clef = popupNote.pitches[pitch_idx].clef;
                                    const newNote = {
                                        ...popupNote, pitches: popupNote.pitches.map((p, idx) => pitch_idx === idx
                                            ? { pitch: `${pitch.slice(0, 1)}${pitch.slice(2)}`, clef }
                                            : p
                                        )
                                    }
                                    setNotes(prev => prev.map((note, idx) =>
                                        idx === popup.noteIdx && note.type !== 'rest' ? newNote : note
                                    ))
                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                }
                            }}
                        >{'\u266D'}</div>
                        <div
                            className={`pitch-option ${pitch_option_map['natural']}`}
                            onClick={() => {
                                const state = pitch_option_map['natural']
                                if (state === 'disabled' || popupNote.type === 'rest') return;
                                if (state !== 'selected') {
                                    const pitch = popupNote.pitches[pitch_idx].pitch;
                                    const clef = popupNote.pitches[pitch_idx].clef;
                                    const newNote = {
                                        ...popupNote,
                                        pitches: popupNote.pitches.map((p, idx) => pitch_idx === idx
                                            ? { pitch: `${pitch.slice(0, 1)}${pitch.slice(2)}`, clef }
                                            : p
                                        )
                                    }
                                    setNotes(prev => prev.map((note, idx) =>
                                        idx === popup.noteIdx && note.type !== 'rest' ? newNote : note
                                    ))
                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                }
                                else {
                                    const pitch = popupNote.pitches[pitch_idx].pitch;
                                    const clef = popupNote.pitches[pitch_idx].clef;
                                    const newNote = {
                                        ...popupNote, pitches: popupNote.pitches.map((p, idx) => pitch_idx === idx
                                            ? { pitch: `${pitch.slice(0, 1)}${sheet_accidental === 'Flat' ? '-' : '#'}${pitch.slice(1)}`, clef }
                                            : p
                                        )
                                    }
                                    setNotes(prev => prev.map((note, idx) =>
                                        idx === popup.noteIdx && note.type !== 'rest' ? newNote : note
                                    ))
                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                }
                            }}
                        >{'\u266E'}</div>
                        <Tooltip
                            mssg={
                                <div>
                                    <strong>Changing to a rest will delete some of this note's data.</strong>
                                    <div style={{ marginTop: '6px' }}>Including it's pitch and any attached chords.</div>
                                    <div style={{ marginTop: '6px' }}>
                                        Press Ctrl + Z to undo.
                                    </div>
                                </div>
                            }
                            minWidth={320}
                            renderAllowed={pitch_option_map['rest'] !== 'selected' && popupNote.type !== 'rest'}
                            bgColor='var(--err-colour)'
                            content={
                                <div
                                    className={`pitch-option ${pitch_option_map['rest']}`}
                                    onClick={() => {
                                        const state = pitch_option_map['rest']
                                        if (state !== 'selected' && popupNote.type !== 'rest') {
                                            const clef = popupNote.pitches[pitch_idx].clef;
                                            const newNote = {
                                                ...popupNote,
                                                type: 'rest',
                                                pitch: { pitch: null, clef }
                                            } as RestNote
                                            setNotes(prev => prev.map((note, idx) =>
                                                idx === popup.noteIdx ? newNote : note
                                            ))
                                            stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                            //need to reset the pitch_idx bc if we change a chord n we're on pitch_idx 3 then the popup won't update 
                                            setPopup({ ...popup, pitchIdx: 0 });
                                        }
                                        else if (state === 'selected' && popupNote.type === 'rest') {
                                            const clef = popupNote.pitch.clef;
                                            const pitch = get_pitch_from_y(undefined, clef);
                                            const newNote = { ...popupNote, pitches: [{ pitch, clef }], type: 'note' } as PitchedNote
                                            setNotes(prev => prev.map((note, idx) =>
                                                idx === popup.noteIdx ? newNote : note
                                            ))
                                            stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);
                                            //have to pass in a the newNote bc otherwise the memo for PitchAdder won't update and it'll still show the up/down ops as disabled
                                            setPopup({ ...popup, pitchIdx: 0 });
                                        }
                                    }}
                                >{'\uE4E5'}</div>
                            }
                        />
                    </div>
                </div>
                {
                    <div className="advanced-options-container">
                        <div
                            onClick={() => setAdvancedOps(!advancedOptionsOpen)}
                            className={`advanced-options-button ${advancedOptionsOpen ? 'open' : ''}`}
                        >
                            <FaCaretDown className='advanced-options-button-caret' />
                            Advanced Options
                            <IoIosSettings className="advanced-options-svg" />
                        </div>
                        <div className={`advanced-options-wrapper ${advancedOptionsOpen ? 'open' : ''}`}>
                            {
                                <div className="advanced-options">
                                    <div className="advanced-options header">Chords:</div>
                                    <div className="chord-button-container">
                                        <div
                                            className="chord-button"
                                            onClick={() => {

                                                const clef = popupNote.type === 'rest' ? popupNote.pitch.clef : popupNote.pitches[pitch_idx].clef
                                                const offset = popupNote.offset;

                                                setNotes((prev) => {

                                                    const used_pitches = new Set<string>();

                                                    prev.forEach((note) => {
                                                        if (note.offset === offset && note.type !== 'rest') {
                                                            note.pitches.forEach(p => {
                                                                if (!used_pitches.has(p.pitch)) used_pitches.add(p.pitch);
                                                            });
                                                        }
                                                    });

                                                    const new_pitch = find_next_avail_pitch([...used_pitches], clef);

                                                    const basePitches = popupNote.type !== 'rest'
                                                        ? popupNote.pitches
                                                        : [];

                                                    const newNote: Note = {
                                                        ...popupNote,
                                                        pitches: [...basePitches, { pitch: new_pitch, clef }],
                                                        type: 'chord'
                                                    };

                                                    stateManager.addAction(popupNote, newNote.offset, newNote.part, newNote.duration);

                                                    return prev.map((note, idx) => {
                                                        if (idx === popup.noteIdx && note.type !== 'rest') return newNote;
                                                        return note;
                                                    });
                                                })

                                                setPopup(prev => ({
                                                    ...popup,
                                                    pitchIdx: prev.pitchIdx + 1
                                                }))
                                            }}
                                        >
                                            Add Note
                                        </div>
                                        {
                                            popupNote.type === 'chord' && (
                                                <div
                                                    className="chord-button"
                                                    onClick={() => {
                                                        setNotes(
                                                            prev => prev.map((note, idx) =>
                                                                idx === popup.noteIdx && note.type !== 'rest'
                                                                    ? {
                                                                        ...note,
                                                                        type: note.pitches.length - 1 <= 1 ? 'note' : 'chord',
                                                                        pitches: note.pitches.filter((_, idx) => idx !== pitch_idx)
                                                                    } : note
                                                            )
                                                        )
                                                        stateManager.addAction(popupNote, popupNote.offset, popupNote.part, popupNote.duration)
                                                        setPopup(prev => ({
                                                            ...popup,
                                                            pitchIdx: prev.pitchIdx - 1
                                                        }))
                                                    }}
                                                >
                                                    Remove Note
                                                </div>
                                            )
                                        }
                                    </div>
                                    {
                                        VOICE_LIMITS[instrument] > 1 && (
                                            <>
                                                <div className="advanced-options header">
                                                    <div>Voice:</div>
                                                    <Info mssg={VOICE_MSSG} minWidth={INFO_MIN_WIDTH} />
                                                </div>
                                                <div className="voice-container">
                                                    <div className="voice-control">
                                                        <div
                                                            className={`voice-control-button ${popupNote.part > 0 ? '' : 'disabled'}`}
                                                            onClick={() => {
                                                                if (popupNote.part === 0) return;
                                                                shiftPart(
                                                                    popupNote.part - 1,
                                                                    popup,
                                                                    setPopup,
                                                                    setNotes,
                                                                    notes,
                                                                    stateManager,
                                                                )
                                                            }}
                                                        >
                                                            <IoIosArrowBack />
                                                        </div>
                                                        <div
                                                            className="voice-name"
                                                            style={{ backgroundColor: voiceColours[popupNote.part] }}
                                                        >{popupNote.part + 1}</div>
                                                        <div
                                                            className={`voice-control-button ${popupNote.part < used_parts ? '' : 'disabled'}`}
                                                            onClick={() => {
                                                                if (popupNote.part >= used_parts) return;
                                                                shiftPart(
                                                                    popupNote.part + 1,
                                                                    popup,
                                                                    setPopup,
                                                                    setNotes,
                                                                    notes,
                                                                    stateManager,
                                                                )
                                                            }}
                                                        >
                                                            <IoIosArrowForward />
                                                        </div>
                                                        <div
                                                            className={`voice-control-button add-new ${used_parts + 2 > VOICE_LIMITS[instrument] ? 'disabled' : ''}`}
                                                            onClick={() => {

                                                                const noteClef = popupNote.type === 'rest' ? popupNote.pitch.clef : popupNote.pitches[pitch_idx].clef;
                                                                const newPitch = find_next_avail_pitch(popupNote.type === 'rest' ? [] : popupNote.pitches.map(p => p.pitch), noteClef)
                                                                const newNote = {
                                                                    ...defaultNewNote,
                                                                    offset: popupNote.offset,
                                                                    duration: 4 / parsed_time_sig.numerator,
                                                                    pitches: [{
                                                                        pitch: newPitch,
                                                                        //when a new voice is added default the clef of this voice to the clef of the voice from which 
                                                                        //the addition was triggered
                                                                        clef: noteClef
                                                                    }],
                                                                    part: used_parts + 1
                                                                }
                                                                setNotes(prev => {
                                                                    if (used_parts + 2 > VOICE_LIMITS[instrument]) return prev;
                                                                    stateManager.addAction(undefined, newNote.offset, newNote.part, newNote.duration);
                                                                    return [...prev, newNote]
                                                                });
                                                                setPopup({
                                                                    pitchIdx: 0,
                                                                    noteIdx: notes.length,
                                                                })
                                                            }}
                                                        >
                                                            Add New
                                                        </div>
                                                    </div>
                                                    <ClefControl
                                                        popup={popup}
                                                        instrument={instrument}
                                                        setNotes={setNotes}
                                                        currNote={popupNote}
                                                        notes={notes}
                                                        stateManager={stateManager}
                                                    />
                                                </div>
                                            </>
                                        )
                                    }
                                    {/* <div>{'tie note'}</div>
                                    <div>{'insert repetition left / right'}</div>
                                    <div>{'silent note'}</div> */}
                                </div>
                            }
                        </div>
                    </div>
                }
            </div >
        </>
    )
}

export default PopupNoteEditorNoteDisplay;