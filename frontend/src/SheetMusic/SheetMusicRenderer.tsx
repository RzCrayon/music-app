import React, { isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react';
import type { SheetMusicProps, NoteDisplay, Note, PitchedNote, Clefs, PopupNoteState, Instruments, ParsedTimeSig, StateManager, PopupNonEditorState, PlaybackState, Toaster } from '../services/types.ts'
import './SheetMusicRenderer.css'
import { adjust_pitch, calculate_beats_per_measure, CLEF_SVGS, destructure_time_sig, get_note_display_name, LEFT_STEMLESS_NOTE_SVGS, snap_to_valid_dur, STEMLESS_NOTE_FLAG_SVGS, STEMLESS_NOTE_SVGS, time_sig_svg, useSheetMusicProcessor } from './sheetmusic_processor.tsx';
import { getImgDimensionsFor, INSTRUMENT_CLEF_TABLE } from '../services/key_map_lib.ts';
import Popup from '../components/Popup.tsx';
import NoteEditorPopupNoteDisplay, { keyboardNoteAlteration, type NewPopup } from './NoteEditorPopupNoteDisplay.tsx';
import DrawCursor from './Cursor.tsx';
import { getTextHeightForWidth, SongNotePopupDisplay } from './SongNotePopupDisplay.tsx';
import { globalZCounter, incGlobalZCounter } from '../main.tsx';

const measure_width = 800;
const min_scaled_measure_width = 300;
export const measure_height = 150;
const inter_staff_line_gap = measure_height / 4;
const inter_staff_gap = 4 * inter_staff_line_gap;
const staff_height = measure_height + inter_staff_gap;

const starting_clef_offset = 60;
const starting_time_sig_offset = 100;
const starting_inter_gap = starting_clef_offset / 2;

const starting_gap = starting_clef_offset + starting_time_sig_offset

const treble_offset = inter_staff_line_gap / 2;

export const inter_note_gap = measure_width / 5;
const measure_padding = measure_width / 5 / 2;
const standard_note_bar_height = measure_height - 3 * treble_offset;

const note_hitbox_width = 40;

const lines_per_clef = 5;
//minus 2 bc the rel y is 0 indexed and we end on a line, not on the space underneath the last line 
const lastLineOfClefRelYPos = lines_per_clef * 2 - 2;

const line_colour = 'black'

export const voiceColours = [
    'black',
    'rgb(0, 132, 255)',
    'rgb(0, 136, 68)',
    'rgb(194, 0, 219)'
]

export const defaultNewNote: PitchedNote = {
    offset: 0,
    duration: 0,
    part: 0,
    type: 'note',
    pitches: [{ pitch: 'B4', clef: 'Treble' }],
}

export function clean_pitch(pitch: string) {
    return pitch.replace(/--?|##?/g, '');
}

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

function compute_note_layout(
    decoded_notes: Record<number, NoteDisplay[][]>,
    beats_per_measure: number,
    used_clefs: Clefs[],
    measuresPerStaff: number,
    notes: Note[]
) {

    type ErrType = {
        mssg: string,
        errMeasure: number //the measure where the err occurs
        errPhysicalLoc: { xpos: number, ypos: number }, //if -1 and -1 it's a timing issue if not then its an overlap issue 
    }

    const errList: ErrType[] = []

    const addErr = (
        mssg: ErrType['mssg'],
        errMeasure: ErrType['errMeasure'],
        physicalLoc: ErrType['errPhysicalLoc']
    ) => {
        errList.push({ errMeasure, mssg, errPhysicalLoc: physicalLoc })
    };

    let layout: (NoteDisplay & { xpos: number, ypos: number })[] = [];
    const barLayout: { xpos: number, ypos: number, part: number, width: number, doubled: number, cnxns: number[] }[] = [];
    const clefOverFlowBarLayout: { xpos: number, clef: Clefs, staff: number, linesNeededAbove: number, linesNeededBelow: number }[] = [];
    const linkedChordsLayout: { xpos: number, ypos1: number, ypos2: number, up: boolean, part: number, accentSvg: ReactNode | null }[] = [];

    const list_decoded_notes = Object.entries(decoded_notes);
    let layoutIdx = 0;

    for (const [measure_num, measure] of list_decoded_notes) {
        const measure_num_cleaned = Number(measure_num)
        const measure_idx = Math.floor(measure_num_cleaned % measuresPerStaff);
        const curr_staff = Math.floor(measure_num_cleaned / measuresPerStaff);
        let noteInMeasure = 0;

        const elapsed_times_map: { part: number, elapsed_time: number }[] = [];

        measure.forEach((slot, slot_idx) => {

            if (slot.length > 0) {

                const used_pitches = new Set<string>();
                const chord_map: { part: number, chord_pitches: Set<number> }[] = [];
                noteInMeasure++;

                //for the overflow clef ticks 
                //if u do it by part and u have two parts that are on the same clef and both go break the boundaries then ur redrawing the ticks twice
                const noteRangesByClef = new Map<Clefs, { highestNote: number, lowestNote: number }>();
                //for the chord links
                //safe to do it by part bc this slot's part is either going to be a chord or not
                const noteRangesByPart = new Map<number, { highestNote: number, lowestNote: number, clef: Clefs, dur: number, noteIdxsInLayout: number[] }>();

                let left_edge = starting_gap + measure_padding + measure_idx * measure_width;
                let slot_width = (measure_width - 2 * measure_padding) / 64;
                if (measure_idx === 0 && curr_staff > 0) {
                    left_edge = starting_clef_offset + measure_padding;
                    slot_width = ((measure_width + starting_gap - starting_clef_offset) - 2 * measure_padding) / 64;
                }
                const xpos = left_edge + slot_idx * slot_width;

                for (const note of slot) {

                    noteRangesByClef.set(note.clef, {
                        lowestNote: Math.max(noteRangesByClef.get(note.clef)?.lowestNote ?? -Infinity, note.relative_ypos), //most pos rel_ypos
                        highestNote: Math.min(noteRangesByClef.get(note.clef)?.highestNote ?? Infinity, note.relative_ypos) //most negative rel_ypos
                    });

                    if (note.type === 'Chord' && note.width < 4) {
                        const noteRange = noteRangesByPart.get(note.part);
                        noteRangesByPart.set(note.part, {
                            lowestNote: Math.max(noteRange?.lowestNote ?? -Infinity, note.relative_ypos), //most pos rel_ypos
                            highestNote: Math.min(noteRange?.highestNote ?? Infinity, note.relative_ypos), //most negative rel_ypos
                            clef: note.clef,
                            dur: snap_to_valid_dur(note.width),
                            noteIdxsInLayout: [...noteRange?.noteIdxsInLayout ?? [], layoutIdx]
                        });
                        note.svg = STEMLESS_NOTE_SVGS[snap_to_valid_dur(note.width)];
                    }

                    const ypos = (used_clefs.length * curr_staff + used_clefs.indexOf(note.clef)) * staff_height
                        + note.relative_ypos * inter_staff_line_gap * 0.5;

                    let part_map = elapsed_times_map.find(p => p.part === note.part);
                    if (!part_map) {
                        part_map = { part: note.part, elapsed_time: 0 };
                        //doesn't start on the first beat err... will happen with voices normally
                        if (slot_idx !== 0) {
                            addErr(
                                `Voice ${note.part + 1} starts mid-measure on measure ${curr_staff * measuresPerStaff + measure_idx + 1}.`,
                                curr_staff * measuresPerStaff + measure_idx,
                                { xpos: -1, ypos: -1 }
                            )
                        }
                        elapsed_times_map.push(part_map);
                    }

                    let chordDuplicateFound = false;
                    if (notes[note.in_notes_idx].type === 'chord') {

                        let chord = chord_map.find(c => c.part === note.part)
                        if (!chord) {
                            chord = { part: note.part, chord_pitches: new Set() };
                            chord_map.push(chord);
                        }

                        if (chord.chord_pitches.size === 0) {
                            part_map.elapsed_time += note.width;
                        }
                        //catch chord same pitch errs
                        if (chord.chord_pitches.has(ypos)) {
                            addErr(
                                `Measure ${curr_staff * measuresPerStaff + measure_idx + 1}, note ${noteInMeasure} in voice ${note.part + 1} has two chords with the same pitch.`,
                                curr_staff * measuresPerStaff + measure_idx,
                                { xpos, ypos }
                            )
                            chordDuplicateFound = true
                        }
                        chord.chord_pitches.add(ypos);
                    }
                    else {
                        part_map.elapsed_time += note.width;
                    }

                    const realNote = notes[note.in_notes_idx]
                    if (realNote !== undefined && realNote.type !== 'rest' && realNote.pitches[note.pitch_idx]) {
                        const pitch = realNote.pitches[note.pitch_idx].pitch

                        const atUpperRangeLimit = adjust_pitch(pitch, 'up', note.clef) === pitch;
                        const atLowerRangeLimit = adjust_pitch(pitch, 'down', note.clef) === pitch;

                        if (atUpperRangeLimit && atLowerRangeLimit) {
                            addErr(
                                `Measure ${curr_staff * measuresPerStaff + measure_idx + 1}, note ${noteInMeasure} pitch ${note.pitch_idx + 1} in voice ${note.part + 1} is outside the pitch range for ${note.clef}.`,
                                curr_staff * measuresPerStaff + measure_idx,
                                { xpos, ypos }
                            )
                        }

                        //catch multi=part same pitch errs
                        if (!chordDuplicateFound && used_pitches.has(pitch)) {
                            addErr(
                                `Measure ${curr_staff * measuresPerStaff + measure_idx + 1}, note ${noteInMeasure} in voice ${note.part + 1} has the same pitch as a note in another voice`,
                                curr_staff * measuresPerStaff + measure_idx,
                                { xpos, ypos }
                            )
                        }

                        used_pitches.add(pitch);
                    }

                    if (note.renderJoinBar !== undefined) {
                        const renderJoinBarData = note.renderJoinBar;

                        const staffOffset = (used_clefs.length * curr_staff + used_clefs.indexOf(note.clef)) * staff_height;
                        const beamOffset = renderJoinBarData.barHeight * inter_staff_line_gap * 0.5;

                        const computedYpos = staffOffset + beamOffset;

                        barLayout.push({
                            xpos: xpos + 30,
                            ypos: computedYpos,
                            part: note.part,
                            width: slot_width * (note.width * 16),
                            doubled: renderJoinBarData.doubled ?? 0,
                            // Clearer relative stem line calculation:
                            cnxns: renderJoinBarData.noteCnxns.map(cnxn =>
                                (cnxn * inter_staff_line_gap * 0.5) - beamOffset
                            ),
                        })
                    }

                    layout.push({
                        ...note,
                        xpos,
                        ypos
                    })
                    layoutIdx++;
                }

                for (const overflow of noteRangesByClef.entries()) {
                    if (overflow[1].highestNote < 0 || overflow[1].lowestNote > lastLineOfClefRelYPos) {
                        clefOverFlowBarLayout.push({
                            xpos,
                            clef: overflow[0],
                            linesNeededAbove: Math.abs(Math.min(0, overflow[1].highestNote)),
                            linesNeededBelow: Math.abs(Math.max(lastLineOfClefRelYPos, overflow[1].lowestNote) - lastLineOfClefRelYPos),
                            staff: curr_staff,
                        })
                    }
                }

                for (const linkedChord of noteRangesByPart.entries()) {
                    const groupData = linkedChord[1]
                    const relGap = groupData.lowestNote - groupData.highestNote;
                    let ypos1 = groupData.highestNote - 4;
                    let ypos2 = groupData.lowestNote;
                    let up = true;
                    //the notes are more centralised above the middle of the clef 
                    if (relGap / 2 < lastLineOfClefRelYPos / 2) {
                        ypos1 = groupData.highestNote;
                        ypos2 = groupData.lowestNote + 4;
                        up = false;
                    }
                    const staffOffset = (used_clefs.length * curr_staff + used_clefs.indexOf(groupData.clef)) * staff_height;
                    ypos1 = staffOffset + ypos1 * inter_staff_line_gap * 0.5;
                    ypos2 = staffOffset + ypos2 * inter_staff_line_gap * 0.5;

                    //adjust svgs for left facing notes 
                    if (!up) {
                        for (const noteIdx of groupData.noteIdxsInLayout) {
                            //don't have to snap to valid dur bc we alr did for groupData.dur
                            layout[noteIdx].svg = LEFT_STEMLESS_NOTE_SVGS[groupData.dur];
                        }
                    }

                    linkedChordsLayout.push({
                        xpos,
                        ypos1,
                        ypos2,
                        up,
                        part: linkedChord[0],
                        accentSvg: STEMLESS_NOTE_FLAG_SVGS[`${groupData.dur}-${up ? 'up' : 'down'}`] ?? null
                    })
                }

            }

            if (slot_idx === 64 - 1) {
                //catch overflow errs
                elapsed_times_map.forEach((entry) => {
                    if (entry.elapsed_time !== beats_per_measure) {
                        addErr(
                            `Measure ${curr_staff * measuresPerStaff + measure_idx + 1}, voice ${entry.part + 1} has ${entry.elapsed_time > beats_per_measure ? 'more' : 'less'} than ${beats_per_measure} beat${beats_per_measure !== 1 ? 's' : ''}`,
                            curr_staff * measuresPerStaff + measure_idx,
                            { xpos: -1, ypos: -1 }
                        );
                    }
                })
            }

        })

    }

    const errMessages = new Set<string>();
    const errsByMeasure = new Set<string>();
    const errsByPos = new Set<string>();
    for (const e of errList) {
        if (e.errPhysicalLoc.xpos !== -1 && e.errPhysicalLoc.ypos !== -1) {
            errsByPos.add(`${e.errPhysicalLoc.xpos},${e.errPhysicalLoc.ypos}`);
        }
        errsByMeasure.add(`${e.errMeasure}`);
        errMessages.add(e.mssg);
    }

    return {
        errs: errList,
        errsByPos,
        errsByMeasure,
        layout,
        barLayout,
        clefOverFlowBarLayout,
        linkedChordsLayout,
        staff_count: Math.max(Math.ceil(Object.entries(decoded_notes).length / measuresPerStaff), 1),
    }
}

const calculate_popup_xy = (note: NoteDisplay & { xpos: number, ypos: number }, containerRef: React.RefObject<HTMLDivElement | null>) => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return {
        top: 0,
        left: 0,
    };

    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const x_scale = svgRect.width / viewBox.width;
    const y_scale = svgRect.height / viewBox.height;

    return {
        top: svgRect.top + (note.ypos - viewBox.y) * y_scale,
        left: svgRect.left + (note.xpos - viewBox.x) * x_scale + (note_hitbox_width * x_scale / 2)
    }
}

const calculate_time_sig_xy = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return {
        top: 0,
        left: 0,
    };

    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const x_scale = svgRect.width / viewBox.width;
    const y_scale = svgRect.height / viewBox.height;

    return {
        top: svgRect.top + (0 - viewBox.y) * y_scale,
        left: svgRect.left + (starting_time_sig_offset + starting_inter_gap * 2 - viewBox.x) * x_scale + ((starting_clef_offset + 10) * x_scale / 2)
    }
}

const AddNoteButton = ({
    setNotes,
    setPopup,
    numerator,
    containerRef,
    stateManager,
}: {
    setNotes: Dispatch<SetStateAction<Note[]>>,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    numerator: number
    containerRef: React.RefObject<HTMLDivElement | null>,
    stateManager: StateManager,
}) => (
    <g className="add-note-btn-group">
        <defs>
            <filter id="button-shadow" x="-20%" y="-20%" width="500%" height="500%">
                <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation="20"
                    floodColor="#000000b2"
                    floodOpacity="1"
                />
            </filter>
        </defs>
        <rect
            x={starting_gap + measure_padding + starting_inter_gap * 2}
            y={-20}
            width={500}
            height={measure_height + 40}
            className='add-note-button'
            rx={20}
            ry={20}
            filter='url(#button-shadow)'
            onClick={() => {
                //no playback state check needed here for editting bc u can't play smth with no notes...
                const newNote = {
                    ...defaultNewNote,
                    duration: 4 / numerator,
                }
                stateManager.addAction(undefined, newNote.offset, newNote.part, newNote.duration);
                setNotes(prev => [...prev, newNote]);
            }}
        />
        <text
            x={starting_gap + measure_padding + starting_inter_gap * 2 + 250 - 130}
            y={measure_height / 2}
            fill="white"
            dominantBaseline="middle"
            fontSize={50}
            style={{ pointerEvents: 'none' }} // Prevents text selection cursor glitching
        >
            Add Note
        </text>
    </g>
)

const StaffGrid = React.memo(function StaffGrid({
    staff_count,
    used_clefs,
    layoutData,
    measureDividerHeight,
    parsed_time_sig,
    editor,
    notes,
    setPopup,
    setNotes,
    containerRef,
    measuresPerStaff,
    stateManager,

}: {
    staff_count: number;
    used_clefs: Clefs[];
    layoutData: ReturnType<typeof compute_note_layout>;
    measureDividerHeight: number;
    parsed_time_sig: ParsedTimeSig;
    editor?: boolean;
    notes: Note[];
    setPopup: Dispatch<SetStateAction<NewPopup>>;
    setNotes: Dispatch<SetStateAction<Note[]>> | undefined;
    containerRef: React.RefObject<HTMLDivElement | null>;
    measuresPerStaff: number;
    stateManager: StateManager,
}) {
    const total_width = measure_width * measuresPerStaff + starting_gap;

    return (
        <>
            {
                Array.from({ length: Math.max(staff_count, 1) }, (_, staffIdx) => {
                    return used_clefs.map((curr_clef, clefIdx) => {
                        const staffY = (used_clefs.length * staffIdx + clefIdx) * staff_height;
                        return (
                            <React.Fragment key={`${staffIdx}-${clefIdx}`}>
                                {/* render only on the first clef of each staff  */}
                                {clefIdx % used_clefs.length === 0 && (
                                    <text
                                        className='measure-number'
                                        x='10'
                                        y={`${staffY - 20}`}
                                    >{staffIdx * measuresPerStaff + 1}</text>
                                )}
                                {/* draw all the horizontal staff lines first*/}
                                {
                                    Array.from({ length: lines_per_clef }, (_, staffLineIdx) => {
                                        const lineY = staffY + inter_staff_line_gap * staffLineIdx;
                                        return (
                                            <line
                                                key={`line-${staffIdx}-${staffLineIdx}-${clefIdx}`}
                                                x1={0}
                                                x2={total_width}
                                                y1={lineY}
                                                y2={lineY}
                                                stroke={line_colour}
                                                strokeWidth={2}
                                            />
                                        )
                                    })
                                }
                                {/* err rendering  */}
                                {
                                    Array.from({ length: measuresPerStaff }, (_, measureIdx) => {
                                        if (layoutData.errsByMeasure.has(`${staffIdx * measuresPerStaff + measureIdx}`)) {
                                            return (
                                                <rect
                                                    key={`errbox-${staffIdx}-${clefIdx}-${measureIdx}`}
                                                    x={(measureIdx !== 0 ? starting_gap : 0) + measureIdx * measure_width}
                                                    y={staffY}
                                                    width={measureIdx == - 0 ? starting_gap + measure_width : measure_width}
                                                    height={measure_height}
                                                    fill={'rgba(255, 0, 0, 0.4)'}
                                                />
                                            )
                                        }
                                    })
                                }
                                {
                                    Array.from({ length: measuresPerStaff + 1 }, (_, measureIdx) => {
                                        // goes to +1 on measuresPerStaff so that we can draw the staff closing line 

                                        //add a tiny little gap at the beginning of the first measure of each staff so that we can draw the clefs
                                        //add an extra gap at the beginning of the very first measure to draw the time sig 
                                        if (measureIdx == 0) {
                                            return (
                                                <g key={`${staffIdx}-${clefIdx}-${measureIdx}`}>
                                                    {/* collision rect to edit the time sig as a popup  */}
                                                    {
                                                        staffIdx === 0 && editor && (
                                                            <rect
                                                                x={starting_clef_offset + 2 * starting_inter_gap}
                                                                y={-inter_staff_gap * 0.25 + (measure_height + inter_staff_gap) * staffIdx}
                                                                height={measure_height + inter_staff_gap * 0.5}
                                                                width={starting_time_sig_offset}
                                                                fill='transparent'
                                                                // style={{ cursor: 'pointer' }}
                                                                pointerEvents='all'
                                                                onClick={() => {
                                                                    //functionality left over for in the future changing the time sig 
                                                                    const popup_pos = calculate_time_sig_xy(containerRef);
                                                                    // setPopup(prev => ({
                                                                    //     ...prev,
                                                                    //     visible: true,
                                                                    //     left: popup_pos.left,
                                                                    //     top: popup_pos.top,
                                                                    // }));
                                                                }}
                                                            />
                                                        )
                                                    }
                                                    {/* the clef symbol  */}
                                                    <g transform={`translate(${starting_inter_gap}, ${staffY + measure_height / 2})`}>
                                                        {CLEF_SVGS[curr_clef]}
                                                    </g>
                                                    {/* drawing the time sig */}
                                                    {
                                                        staffIdx === 0 && (
                                                            <g>
                                                                <g transform={`translate(${starting_clef_offset * 2 + starting_inter_gap}, ${staffY + measure_height / 5})`}>
                                                                    {time_sig_svg(parsed_time_sig.numerator)}
                                                                </g>
                                                                <g transform={`translate(${starting_clef_offset * 2 + starting_inter_gap} ${staffY + 4 * measure_height / 5})`}>
                                                                    {time_sig_svg(parsed_time_sig.denom)}
                                                                </g>
                                                            </g>
                                                        )
                                                    }
                                                </g>
                                            )
                                        }
                                        // measure dividers
                                        else if (clefIdx % used_clefs.length === 0) {
                                            const x = starting_gap + measureIdx * measure_width;
                                            const lastMeasure = staffIdx === staff_count - 1 && measureIdx === measuresPerStaff;
                                            return (
                                                <g key={`measure-divider-${staffIdx}-${clefIdx}-${measureIdx}`}>
                                                    <line
                                                        key={`measure-line-${staffIdx}-${clefIdx}-${measureIdx}`}
                                                        x1={x}
                                                        x2={x}
                                                        y1={staffY}
                                                        y2={staffY + measureDividerHeight}
                                                        stroke={line_colour}
                                                        strokeWidth={lastMeasure ? 4 : 2}
                                                    />
                                                    {/*end of music marker */}
                                                    {
                                                        lastMeasure && (
                                                            <line
                                                                key={`measure-postline-${staffIdx}--${clefIdx}-${measureIdx}`}
                                                                x1={x - 13}
                                                                x2={x - 13}
                                                                y1={staffY}
                                                                y2={staffY + measureDividerHeight}
                                                                stroke={line_colour}
                                                                strokeWidth={2}
                                                            />
                                                        )
                                                    }
                                                </g>
                                            )
                                        }
                                    })
                                }
                            </React.Fragment>
                        )
                    })
                })
            }
            {
                notes.length === 0 && setNotes !== undefined && (
                    <AddNoteButton
                        setNotes={setNotes}
                        setPopup={setPopup}
                        numerator={parsed_time_sig.numerator}
                        containerRef={containerRef}
                        stateManager={stateManager}
                    />
                )
            }
        </>
    )
})

const NotesLayer = React.memo(function NotesLayer({
    layoutData,
    notes,
    editor,
    setPopup,
    containerRef,
    instrument,
    selectedNoteIdx,
    stateManager,
    used_clefs,
    playbackState,
    toaster,
}: {
    layoutData: ReturnType<typeof compute_note_layout>;
    notes: Note[];
    editor?: boolean;
    setPopup: Dispatch<SetStateAction<NewPopup>>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    instrument: Instruments;
    selectedNoteIdx: number | null;
    stateManager: StateManager;
    used_clefs: Clefs[],
    playbackState: PlaybackState,
    toaster?: Toaster,
}) {
    return (
        <>
            {/* draw the lines for notes if they overflow above a clef  */}
            {/* both bars and lines should be drawn before the notes so that the notes render on top */}
            {
                layoutData.clefOverFlowBarLayout.map((bar, idx) => {

                    return (
                        <g key={`clef-overflow-tick-${idx}`}>
                            {
                                Array.from({ length: bar.linesNeededAbove }, (_, aboveIdx) => {
                                    const ypos = (used_clefs.length * bar.staff + used_clefs.indexOf(bar.clef)) * staff_height
                                        - (aboveIdx + 1) * inter_staff_line_gap * 0.5
                                    return (
                                        <line
                                            key={`clef-overflow-tick-above-${idx}-${aboveIdx}`}
                                            x1={bar.xpos - 10}
                                            x2={bar.xpos + 50}
                                            y1={ypos}
                                            y2={ypos}
                                            strokeWidth={4}
                                            stroke={line_colour}
                                        />
                                    )
                                })
                            }
                            {
                                Array.from({ length: bar.linesNeededBelow }, (_, belowIdx) => {
                                    const ypos = (used_clefs.length * bar.staff + used_clefs.indexOf(bar.clef)) * staff_height
                                        + (lastLineOfClefRelYPos + belowIdx + 1) * inter_staff_line_gap * 0.5
                                    return (
                                        <line
                                            key={`clef-overflow-tick-below-${idx}-${belowIdx}`}
                                            x1={bar.xpos - 10}
                                            x2={bar.xpos + 50}
                                            y1={ypos}
                                            y2={ypos}
                                            strokeWidth={4}
                                            stroke={line_colour}
                                        />
                                    )
                                })
                            }
                        </g>
                    )
                })
            }
            {
                layoutData.barLayout.map((bar, idx) => {
                    const strokeColor = voiceColours[bar.part];

                    return (
                        <g
                            key={`bar-${idx}`}
                            transform={`translate(${bar.xpos}, ${bar.ypos})`}
                        >
                            <line
                                x1={-4}
                                x2={bar.width}
                                y1={0}
                                y2={0}
                                strokeWidth={10}
                                stroke={strokeColor}
                            />
                            {bar.doubled && (
                                <line
                                    x1={0}
                                    x2={bar.width}
                                    y1={20 * bar.doubled}
                                    y2={20 * bar.doubled}
                                    strokeWidth={7}
                                    stroke={strokeColor}
                                />
                            )}
                            {bar.cnxns.map((cnxn, cnxn_idx) => (
                                <line
                                    key={`cnxn-${idx}-${cnxn_idx}`}
                                    x1={cnxn_idx * bar.width - 2}
                                    x2={cnxn_idx * bar.width - 2}
                                    y1={-2}
                                    y2={cnxn}
                                    strokeWidth={4}
                                    stroke={strokeColor}
                                />
                            ))}
                        </g>
                    );
                })
            }
            {
                layoutData.linkedChordsLayout.map((bar, idx) => {
                    const strokeColor = voiceColours[bar.part];
                    const xpos = bar.xpos + (bar.up ? 28 : 0);
                    return (
                        <g key={`chord-link-${idx}`}>
                            <line
                                x1={xpos}
                                x2={xpos}
                                y1={bar.ypos1}
                                y2={bar.ypos2}
                                strokeWidth={4}
                                stroke={strokeColor}
                            />
                            {
                                bar.accentSvg && (
                                    <g
                                        key={`chord-link-flag-${idx}`}
                                        transform={`translate(${xpos}, ${bar.up ? bar.ypos1 : bar.ypos2})`}
                                        className='note-hitbox disabled'
                                        style={{
                                            ['--note-colour' as any]: strokeColor
                                        }}
                                    >
                                        {bar.accentSvg}
                                    </g>
                                )
                            }
                        </g>
                    );
                })
            }
            {
                layoutData.layout.map((note) => {
                    if (note.in_notes_idx === selectedNoteIdx) return null;
                    return (
                        <g
                            key={note.id}
                            transform={`translate(${note.xpos}, ${note.ypos})`}
                            width={40}
                            height={40}
                            overflow='visible'
                            className={`note-hitbox
                                        ${layoutData.errsByPos.has(`${note.xpos},${note.ypos}`) ? 'with-err' : ''}
                                        ${isValidElement(note.svg) && note.svg.key?.slice(0, 4) === 'left' ? 'left-facing' : ''}
                                        `}
                            style={{
                                ['--note-colour' as any]: voiceColours[note.part],
                            }}
                            pointerEvents='none'
                            onClick={(e) => {
                                e.stopPropagation();
                                const popup_pos = calculate_popup_xy(note, containerRef)
                                if (!editor) {
                                    setPopup({
                                        noteIdx: note.in_notes_idx,
                                        pitchIdx: note.pitch_idx,
                                        // visible: true,
                                        // left: popup_pos.left,
                                        // top: popup_pos.top,
                                        // type: 'non-editor',
                                        // noteData: notes[note.in_notes_idx],
                                        // pitch_idx: note.pitch_idx,
                                        // instrument
                                    })
                                }
                                else {
                                    if (playbackState === 'playing') {
                                        toaster?.add_message("Can't edit while playing song.", 'color-mix(brown 30%, var(--warning-colour) 70%)')
                                        return;
                                    }
                                    setPopup({
                                        noteIdx: note.in_notes_idx,
                                        pitchIdx: note.pitch_idx,
                                        // visible: true,
                                        // left: popup_pos.left,
                                        // top: popup_pos.top,
                                        // type: 'non-editor',
                                        // noteData: notes[note.in_notes_idx],
                                        // pitch_idx: note.pitch_idx,
                                        // instrument
                                    })
                                }
                            }}
                        >
                            <rect
                                x={-5}
                                y={-20}
                                width={40}
                                height={40}
                                pointerEvents='all'
                                style={{ cursor: 'pointer' }}
                                fill='transparent'
                            />
                            {note.svg}
                            {note.dotted}
                            {note.accidental}
                        </g>
                    )
                })
            }
        </>
    )
})

const SelectionOverlay = React.memo(function SelectionOverlay({
    layoutData,
    selectedNoteIdx,
    setPopup,
    containerRef,
    instrument,
    editor,
    notes,
    stateManager,
    popup,
    playbackState,
    toaster,
}: {
    layoutData: ReturnType<typeof compute_note_layout>;
    selectedNoteIdx: number | null;
    setPopup: Dispatch<SetStateAction<NewPopup>>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    instrument: Instruments;
    editor?: boolean;
    notes: Note[];
    stateManager: StateManager,
    popup: NewPopup,
    playbackState: PlaybackState,
    toaster?: Toaster
}) {
    if (selectedNoteIdx === null) return null;

    const selectedEntries = layoutData.layout.filter(n => n.in_notes_idx === selectedNoteIdx);
    if (selectedEntries.length === 0) return null;

    return (
        <>
            {selectedEntries.map((note, idx) => (
                <g
                    key={note.id}
                    transform={`translate(${note.xpos}, ${note.ypos})`}
                    overflow='visible'
                    className={`note-hitbox emphasis
                            // need to check popup bc we need the pitch_idx from popup to know which note of the chord specifically was clicked 
                            ${(note.type !== 'Singleton' && editor && popup.pitchIdx === idx) || note.type === 'Singleton' ? 'selected' : ''}
                            ${layoutData.errsByPos.has(`${note.xpos},${note.ypos}`) ? 'with-err' : ''}
                            ${isValidElement(note.svg) && note.svg.key?.slice(0, 4) === 'left' ? 'left-facing' : ''}
                            `}
                    style={{
                        ['--note-colour' as any]: voiceColours[note.part],
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        const popup_pos = calculate_popup_xy(note, containerRef)
                        if (!editor) {
                            setPopup({
                                noteIdx: note.in_notes_idx,
                                pitchIdx: note.pitch_idx,
                                // visible: true,
                                // left: popup_pos.left,
                                // top: popup_pos.top,
                                // type: 'non-editor',
                                // noteData: notes[note.in_notes_idx],
                                // pitch_idx: note.pitch_idx,
                                // instrument
                            })
                        }
                        else {
                            if (playbackState === 'playing') {
                                toaster?.add_message("Can't edit while playing song.", 'color-mix(brown 30%, var(--warning-colour) 70%)')
                                return;
                            }
                            setPopup({
                                noteIdx: note.in_notes_idx,
                                pitchIdx: note.pitch_idx,
                                // visible: true,
                                // left: popup_pos.left,
                                // top: popup_pos.top,
                                // type: 'editor',
                                // noteIdx: note.in_notes_idx,
                                // pitch_idx: note.pitch_idx,
                                // noteData: notes[note.in_notes_idx],
                                // stateManager,
                            });
                        }
                    }}
                >
                    {note.svg}
                    {note.dotted}
                    {note.accidental}
                </g>
            ))}
        </>
    )
})

const NotePopup = ({
    popup,
    layoutData,
    editor,
    notes,
    containerRef,
    instrument,
    setPopup,
    setNotes,
    parsed_time_sig,
    used_parts,
    stateManager,
    scrollRef,
    len_used_clefs
}: {
    popup: NewPopup,
    layoutData: ReturnType<typeof compute_note_layout>,
    editor: boolean,
    notes: Note[],
    containerRef: RefObject<HTMLDivElement | null> | null,
    instrument: Instruments,
    setPopup: Dispatch<SetStateAction<NewPopup>>,
    setNotes?: Dispatch<SetStateAction<Note[]>>,
    parsed_time_sig: ParsedTimeSig,
    used_parts: number,
    stateManager: StateManager,
    scrollRef: RefObject<HTMLDivElement | null>,
    len_used_clefs: number,
}) => {

    const [pos, setPos] = useState<{ top: number, left: number }>({ top: 0, left: 0 });
    const [popupVisible, setPopupVisible] = useState(false);

    useLayoutEffect(() => {
        const note = layoutData.layout.find((n) => n.in_notes_idx === popup.noteIdx && n.pitch_idx === popup.pitchIdx);
        if (!note || !containerRef?.current) {
            setPos({ top: 0, left: 0 });
            setPopupVisible(false);
            return;
        }

        const el = scrollRef.current;
        let initialPos = calculate_popup_xy(note, containerRef);

        if (!el) {
            setPos(initialPos);
            setPopupVisible(true);
            return;
        }

        const scrollRect = el.getBoundingClientRect();
        const maxScrollTop = el.scrollHeight - el.clientHeight;

        const targetTop = initialPos.top;
        const staffHeight = (measure_height * len_used_clefs) + (inter_staff_gap * (len_used_clefs - 1));
        const top = targetTop - staffHeight;
        const bottom = targetTop + staffHeight;

        let delta = 0;
        if (bottom > scrollRect.bottom) {
            delta = bottom - scrollRect.bottom;
        } else if (top < scrollRect.top) {
            delta = top - scrollRect.top;
        }

        const newScrollTop = Math.max(0, Math.min(maxScrollTop, el.scrollTop + delta));

        //if scroll not significant enough just display immediately
        if (Math.abs(newScrollTop - el.scrollTop) <= 1) {
            setPos(initialPos);
            setPopupVisible(true);
            return;
        }

        setPopupVisible(false);
        el.scrollTo({ top: newScrollTop, behavior: 'smooth' });

        let timerId: NodeJS.Timeout;
        const clear = () => {
            const updatedPos = calculate_popup_xy(note, containerRef);
            setPos(updatedPos);
            setPopupVisible(true);
        };

        if ('onscrollend' in el) {
            el.addEventListener('scrollend', clear, { once: true });
        } else {
            timerId = setTimeout(clear, 400);
        }

        return () => {
            if ('onscrollend' in el) {
                el.removeEventListener('scrollend', clear);
            }
            if (timerId) clearTimeout(timerId);
        };
    }, [popup, layoutData, containerRef?.current?.clientHeight]);

    if (popup.noteIdx === -1 || popup.pitchIdx === -1) return <></>

    return (
        <Popup
            x={pos.left}
            y={pos.top}
            height={editor ? 530 : getImgDimensionsFor(instrument).height + getTextHeightForWidth(getImgDimensionsFor(instrument).width, notes[popup.noteIdx], { font: '16px Bravura' }) + 75}
            width={editor ? 430 : getImgDimensionsFor(instrument).width + 40}
            visible={popupVisible}
            setVisible={() => setPopupVisible(false)}
            overrideBackgroundClick={() => setPopup({ noteIdx: -1, pitchIdx: -1 })}
            content={
                editor ? (
                    <NoteEditorPopupNoteDisplay
                        notes={notes}
                        popup={popup}
                        setPopup={setPopup}
                        setNotes={setNotes !== undefined ? setNotes : () => { }}
                        parsed_time_sig={parsed_time_sig}
                        sheet_accidental={'Natural'}
                        instrument={instrument}
                        used_parts={used_parts}
                        stateManager={stateManager}
                    />
                ) : (
                    // <></>
                    <SongNotePopupDisplay
                        popup={popup}
                        notes={notes}
                        instrument={instrument}
                    />
                )
            }
        />
    )
}

function SheetMusic({
    notes,
    editor,
    setNotes,
    cursor,
    setCursor,
    setErrMessages,
    clef,
    setClef,
    time_sig,
    setTimeSig,
    setInstrument,
    stateManager,
    instrument,
    wrapperRef,
    cursorMusicPlaybackControlFunc,
    playbackState,
    toaster,
}: SheetMusicProps) {

    const parsed_time_sig = useMemo(() => destructure_time_sig(time_sig), [time_sig]);

    const beats_per_measure = calculate_beats_per_measure(parsed_time_sig ?? { denom: 4, numerator: 4 });
    const allowed_clefs = INSTRUMENT_CLEF_TABLE[instrument];

    const [measuresPerStaff, setMeasuresPerStaff] = useState(3);

    const { decoded_notes, used_clefs, used_parts } = useSheetMusicProcessor({ notes, time_sig, sheet_accidental: 'Natural', allowed_clefs });

    const layoutData = useMemo(() =>
        decoded_notes ? compute_note_layout(decoded_notes, beats_per_measure, used_clefs, measuresPerStaff, notes)
            //fallback        
            : {
                layout: [],
                barLayout: [],
                clefOverFlowBarLayout: [],
                linkedChordsLayout: [],
                staff_count: 0,
                errs: [],
                errsByPos: new Set<string>(),
                errsByMeasure: new Set<string>(),
            }
        , [decoded_notes, notes, measuresPerStaff, beats_per_measure, used_clefs]);

    const staff_count = layoutData.staff_count;

    const [popup, setPopup] = useState<NewPopup>({ noteIdx: -1, pitchIdx: -1, });
    const [popupVisible, setPopupVisible] = useState(false);

    const [containerDimensions, setContainerDimensions] = useState({
        width: measure_width * measuresPerStaff + starting_gap,
        height: (measure_height + inter_staff_gap) * staff_count * used_clefs.length + standard_note_bar_height || (measure_height + inter_staff_gap) + standard_note_bar_height,
    })

    const [measureDividerHeight, setMeasureDividerHeight] = useState(allowed_clefs.length * staff_height - inter_staff_gap)

    useEffect(() => {
        setMeasureDividerHeight(used_clefs.length * staff_height - inter_staff_gap);
    }, [used_clefs])

    useEffect(() => {
        if (!setErrMessages) return;
        setErrMessages(layoutData.errs.map(err => ({
            mssg: err.mssg,
            scrollPos:
                //(measure pos on the screen / sheetmusic height)
                (used_clefs.length * Math.floor(err.errMeasure / measuresPerStaff) * staff_height) / containerDimensions.height
        })));
    }, [layoutData]);

    useEffect(() => {
        let height = (measure_height + inter_staff_gap) * staff_count * used_clefs.length + standard_note_bar_height;
        if (staff_count <= 0) {
            height = (measure_height + inter_staff_gap) + standard_note_bar_height;
        }
        setContainerDimensions(
            {
                width: measure_width * measuresPerStaff + starting_gap,
                height
            }
        )
    }, [measuresPerStaff, layoutData.staff_count, used_clefs])

    const lastWidthRef = useRef<number | null>(null);
    useLayoutEffect(() => {

        const el = containerRef.current;
        if (!el) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const width = entry.contentRect.width;

                if (lastWidthRef.current === width) continue;
                lastWidthRef.current = width;

                const new_measure_count = Math.max(Math.floor(width / min_scaled_measure_width), 1);
                if (new_measure_count !== measuresPerStaff) setMeasuresPerStaff(Math.min(5, new_measure_count));
                setPopup({ noteIdx: -1, pitchIdx: -1 });
            }
        })
        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, [containerDimensions.width]);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const keydownHandler = (e: KeyboardEvent) => {
            if (!parsed_time_sig) return;
            if (e.key === 'Tab') e.preventDefault();
            if (setNotes === undefined) return;

            const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
            if (isUndo && stateManager) {
                try {
                    stateManager.undo(setNotes, setInstrument);
                    setPopup({ noteIdx: -1, pitchIdx: -1 });
                }
                catch { }
            }

            if (playbackState === 'playing') {
                toaster.add_message("Can't edit while playing song.", 'color-mix(brown 30%, var(--warning-colour) 70%)')
                return;
            }
            keyboardNoteAlteration(
                e,
                notes,
                popup,
                setNotes,
                setPopup,
                parsed_time_sig,
                instrument,
                stateManager,
            )
        }
        window.addEventListener('keydown', keydownHandler);
        return () => {
            window.removeEventListener('keydown', keydownHandler);
        };
    }, [popup, parsed_time_sig, instrument, notes])

    useEffect(() => {
        if (popup.noteIdx === -1) return;
        setPopupVisible(true);
    }, [popup.noteIdx])

    const doubleClickRef = useRef<((e: React.MouseEvent) => void) | null>(null);
    const doubleClickCursorRepos = (e: React.MouseEvent) => {
        doubleClickRef.current?.(e);
    }

    if (!parsed_time_sig || !stateManager) return <></>

    return (
        <>
            <NotePopup
                popup={popup}
                layoutData={layoutData}
                editor={editor}
                notes={notes}
                containerRef={containerRef}
                instrument={instrument}
                setPopup={setPopup}
                setNotes={setNotes}
                parsed_time_sig={parsed_time_sig}
                used_parts={used_parts}
                stateManager={stateManager}
                scrollRef={wrapperRef}
                len_used_clefs={used_clefs.length}
            />
            <div
                className='sheet-music-container'
                ref={containerRef}
                onDoubleClick={(e) => doubleClickCursorRepos(e)}
            >
                <svg
                    width={`100%`}
                    style={{ maxWidth: '1800px' }}
                    //view box lets us pretend like he size is total_width, total_height, but it'll make sure it fits in the width
                    viewBox={`-20 -${standard_note_bar_height} ${containerDimensions.width + 100} ${containerDimensions.height}`}
                >
                    {/* memoizes this whole display so that it only rerenders when the props change... optimisation music play and no cursor delay */}
                    <StaffGrid
                        staff_count={staff_count}
                        used_clefs={used_clefs}
                        layoutData={layoutData}
                        measureDividerHeight={measureDividerHeight}
                        parsed_time_sig={parsed_time_sig}
                        editor={editor}
                        notes={notes}
                        setPopup={setPopup}
                        setNotes={setNotes}
                        containerRef={containerRef}
                        measuresPerStaff={measuresPerStaff}
                        stateManager={stateManager}
                    />
                    <NotesLayer
                        layoutData={layoutData}
                        notes={notes}
                        editor={editor}
                        setPopup={setPopup}
                        containerRef={containerRef}
                        instrument={instrument}
                        selectedNoteIdx={popup.noteIdx}
                        stateManager={stateManager}
                        used_clefs={used_clefs}
                        playbackState={playbackState}
                        toaster={toaster}
                    />
                    <SelectionOverlay
                        layoutData={layoutData}
                        selectedNoteIdx={popup.noteIdx}
                        setPopup={setPopup}
                        containerRef={containerRef}
                        instrument={instrument}
                        editor={editor}
                        notes={notes}
                        stateManager={stateManager}
                        popup={popup}
                        playbackState={playbackState}
                        toaster={toaster}
                    />
                    <DrawCursor
                        cursor={cursor}
                        setCursor={setCursor}
                        used_clefs={used_clefs}
                        beats_per_measure={beats_per_measure}
                        measuresPerStaff={measuresPerStaff}
                        staff_count={staff_count}
                        containerRef={containerRef}
                        scrollWrapperRef={wrapperRef}
                        toaster={toaster}
                        setNotes={setNotes}
                        notes={notes}
                        playbackState={playbackState}
                        measurementConstants={{
                            measure_height,
                            inter_staff_gap,
                            starting_gap,
                            measure_padding,
                            measure_width,
                            starting_clef_offset,
                            staff_height
                        }}
                        manuallyToggleMusicPlayback={cursorMusicPlaybackControlFunc}
                        doubleClickCursorRepos={(doubleClickCursorRepos) => doubleClickRef.current = doubleClickCursorRepos}
                        stateManager={stateManager}
                    />
                </svg>
            </div>
        </>
    );

}

export default SheetMusic;