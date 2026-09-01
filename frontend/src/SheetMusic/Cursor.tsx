import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { Clefs, Note, PlaybackState, StateManager, Toaster } from "../services/types";
import './SheetMusicRenderer.css'
import { copyNotesOffsetJustified, deleteAllInRange, pasteNotesRangeSelected } from "./sheetmusic_mod_funcs";

type MeasurementConstants = {
    measure_height: number,
    inter_staff_gap: number,
    starting_gap: number,
    measure_padding: number,
    measure_width: number,
    starting_clef_offset: number,
    staff_height: number,
}

type CursorPos = { xpos: number, ypos: number }

const emptyNoteMap = new Map<number, Note[]>()

function SelectRegions({
    cursor_pos,
    selectCursor_pos,
    used_clefs,
    measurementConstants,
    measuresPerStaff
}: {
    cursor_pos: CursorPos,
    selectCursor_pos: CursorPos,
    used_clefs: Clefs[],
    measurementConstants: MeasurementConstants,
    measuresPerStaff: number,
}) {
    //needs to be +1 at the end to draw the line when the cursors are on the same line 
    const totalStaffsToBeDrawn = Math.abs(cursor_pos.ypos - selectCursor_pos.ypos) / (measurementConstants.staff_height * used_clefs.length) + 1
    return Array.from({ length: totalStaffsToBeDrawn }, (_, staffIdx) => {
        //on the staff with the cursor 
        const y = cursor_pos.ypos + staffIdx * (measurementConstants.staff_height * used_clefs.length);
        const height = measurementConstants.measure_height * used_clefs.length +
            measurementConstants.inter_staff_gap * (used_clefs.length - 1)

        let staffStartX = 0;
        let staffEndX = measurementConstants.measure_width * measuresPerStaff + measurementConstants.measure_padding * measuresPerStaff;
        //on the staff with the cursor
        if (staffIdx === 0) {
            staffStartX = cursor_pos.xpos;
        }
        //on the staff with the selectCursor
        if (staffIdx === totalStaffsToBeDrawn - 1) {
            staffEndX = selectCursor_pos.xpos
        }

        let width = staffEndX - staffStartX;
        if (width < 0) width = 0;

        return (
            <rect
                key={`select-region-${staffIdx}`}
                x={staffStartX}
                y={y}
                width={width}
                height={height}
                className="select-region"
            />
        )
    })
}


export default function DrawCursor({
    cursor,
    setCursor,
    used_clefs,
    beats_per_measure,
    measuresPerStaff,
    staff_count,
    containerRef,
    scrollWrapperRef,
    toaster,
    setNotes,
    measurementConstants,
    notes,
    playbackState,
    doubleClickCursorRepos,
    manuallyToggleMusicPlayback,
    stateManager,
}: {
    cursor: number,
    setCursor: Dispatch<SetStateAction<number>>,
    used_clefs: Clefs[],
    beats_per_measure: number,
    measuresPerStaff: number,
    staff_count: number,
    containerRef: React.RefObject<HTMLDivElement | null>,
    scrollWrapperRef: React.RefObject<HTMLDivElement | null>,
    toaster?: Toaster,
    measurementConstants: MeasurementConstants,
    setNotes?: Dispatch<SetStateAction<Note[]>>,
    notes: Note[],
    playbackState: PlaybackState,
    manuallyToggleMusicPlayback?: (play: boolean) => Promise<void>,
    stateManager: StateManager,
    doubleClickCursorRepos?: (reposFunc: (e: React.MouseEvent) => void) => void //callback func to trigger double click cursor repos manually from the sheetmusic renderer div so that double clicks are bounded and can't just happen from anywhere 
}) {

    const tipHeight = useMemo(() => measurementConstants.measure_height / 3, [measurementConstants.measure_height])

    const [playingSong, setPlayingSong] = useState(playbackState === 'playing');
    //if u scroll while playingSong and the cursor is no longer in view screenlocked means the cursor no longer moves with the screen
    //but as soon as u bring the cursor back into view ur all good again and the cursor takes over control
    const [screenLocked, setScreenLocked] = useState(false);

    const [cursor_pos, setCursorPos] = useState<CursorPos>(calculate_cursor_xypos(cursor, beats_per_measure, used_clefs, measuresPerStaff));
    const cursorPosRef = useRef(cursor_pos);
    const isDragging = useRef(false);

    const [showSelectCursor, setShowSelectCursor] = useState(false);
    const [selectCursor, setSelectCursor] = useState(-1)
    const [selectCursor_pos, setSelectCursorPos] = useState<CursorPos>(calculate_cursor_xypos(selectCursor, beats_per_measure, used_clefs, measuresPerStaff));
    const isDraggingSelect = useRef(false);

    //part to note set 
    const [clipBoard, setClipBoard] = useState<Map<number, Note[]>>(emptyNoteMap);

    const [clickedAnywhere, setClickedAnywhere] = useState(false);
    const [clickedSelectCursor, setClickedSelectCursor] = useState<React.PointerEvent | null>(null);

    const lastMovementOfCursorTriggeredBy = useRef<'automatically' | 'manually'>('automatically');

    useEffect(() => {
        return () => {
            if (scrollRafId.current !== null) cancelAnimationFrame(scrollRafId.current);
        };
    }, []);

    useEffect(() => {
        cursorPosRef.current = cursor_pos
    }, [cursor_pos]);

    useEffect(() => {
        //makes sure that only pauses explicitly triggered by the player can pause the cursor's view of whether or not the song is playing
        //if the pause was triggered by the player moving the cursor while the song was playing, then ignore that pause and don't update our
        //state of playingsong here
        if (playbackState !== 'playing') {
            if (lastMovementOfCursorTriggeredBy.current === 'automatically') {
                setPlayingSong(false);
                setScreenLocked(false);
            }
            //change the state of who controls the cursor here 
            else lastMovementOfCursorTriggeredBy.current = 'automatically';
        }
        else setPlayingSong(true);
    }, [playbackState])

    const isAutoScrollingRef = useRef(false);
    const isUserScrollingRef = useRef(false);

    const evaluateLock = () => {
        if (!playingSong || isAutoScrollingRef.current) return;

        const pos = cursorPosRef.current;
        const staffBlockHeight =
            measurementConstants.measure_height * used_clefs.length +
            measurementConstants.inter_staff_gap * (used_clefs.length - 1);

        const cursorScreenTop = svg_y_to_pointer_coord(containerRef, pos.ypos - tipHeight);
        const cursorScreenBottom = svg_y_to_pointer_coord(containerRef, pos.ypos + staffBlockHeight + tipHeight);

        const wrapperRect = scrollWrapperRef.current?.getBoundingClientRect();
        if (wrapperRect && cursorScreenBottom !== undefined && cursorScreenTop !== undefined) {
            if (cursorScreenBottom < wrapperRect.top || cursorScreenTop > wrapperRect.bottom) setScreenLocked(true);
            else if (cursorScreenTop > wrapperRect.top && cursorScreenBottom < wrapperRect.bottom) setScreenLocked(false);
        }
    }

    //keeps the isuserscrolling state always in sync
    useEffect(() => {
        const el = scrollWrapperRef.current;
        if (!el) return;

        let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

        const markUserScrollStart = () => {
            isUserScrollingRef.current = true;

            //user input always wins -- if we're mid autoscroll, kill our animation immediately
            //rather than let it fight the user's native scroll
            if (isAutoScrollingRef.current) {
                isAutoScrollingRef.current = false;
                el.scrollTo({ top: el.scrollTop, behavior: 'auto' }); //cancels any in-flight smooth scroll
            }

            //safety valve: if no actual scroll materializes shortly after this signal
            //(e.g. wheel event with nowhere to scroll, or any future stray trigger),
            //don't let the flag get stuck forever
            if (safetyTimeout) clearTimeout(safetyTimeout);
            safetyTimeout = setTimeout(() => {
                isUserScrollingRef.current = false;
            }, 500);
        };

        //deliberately NOT listening to pointerdown here -- it bubbles up from
        //interactive children (like the draggable cursor <g> elements), which
        //have nothing to do with scrolling and would wedge isUserScrollingRef
        //permanently true after any click
        el.addEventListener('wheel', markUserScrollStart, { passive: true });
        el.addEventListener('touchstart', markUserScrollStart, { passive: true });

        return () => {
            el.removeEventListener('wheel', markUserScrollStart);
            el.removeEventListener('touchstart', markUserScrollStart);
            if (safetyTimeout) clearTimeout(safetyTimeout);
        };
    }, []);

    //handles lock state during user scrolling
    useEffect(() => {
        const el = scrollWrapperRef.current;
        if (!el) return;

        evaluateLock();

        let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

        const handleScroll = () => {
            isUserScrollingRef.current = true;
            //only used as a fallback for browsers without native scrollend
            if ('onscrollend' in el) return;
            if (fallbackTimeout) clearTimeout(fallbackTimeout);
            fallbackTimeout = setTimeout(() => {
                isUserScrollingRef.current = false;
                evaluateLock();
            }, 150);
        };

        const handleScrollEnd = () => {
            isUserScrollingRef.current = false;
            evaluateLock();
        };

        el.addEventListener('scroll', handleScroll);
        //use scrollend to figure out if we've actually stopped scrolling bc if u use event scroll alone then if we're 
        //just passing by the cursor but not actually locking on the auto scroll will still snap us to where it thinks we should be
        el.addEventListener('scrollend', handleScrollEnd);

        return () => {
            el.removeEventListener('scroll', handleScroll);
            el.removeEventListener('scrollend', handleScrollEnd);
            if (fallbackTimeout) clearTimeout(fallbackTimeout);
        }
    }, [playingSong])

    //actually executes the auto scrolling
    useEffect(() => {
        if (!playingSong || screenLocked || isUserScrollingRef.current) return;

        const el = scrollWrapperRef.current;
        const svg = containerRef.current?.querySelector('svg');
        if (!el || !svg) return;

        const maxScrollTop = el.scrollHeight - el.clientHeight;

        const currentStaff = Math.round(cursor_pos.ypos / (measurementConstants.staff_height * used_clefs.length));
        const isLastStaff = currentStaff >= staff_count - 1;
        const isFirstStaff = currentStaff === 0;

        const staffBlockHeight =
            measurementConstants.measure_height * used_clefs.length +
            measurementConstants.inter_staff_gap * (used_clefs.length - 1);

        const staffTopPixelY = svg_y_to_pointer_coord(containerRef, cursor_pos.ypos - measurementConstants.inter_staff_gap);
        const staffBottomPixelY = svg_y_to_pointer_coord(containerRef, cursor_pos.ypos + staffBlockHeight + measurementConstants.inter_staff_gap);

        const wrapperRect = el.getBoundingClientRect();
        if (staffBottomPixelY === undefined || staffTopPixelY === undefined) return;

        const alreadyInView = staffTopPixelY >= wrapperRect.top && staffBottomPixelY <= wrapperRect.bottom;

        let newScrollTop: number;

        if (isLastStaff && !alreadyInView) newScrollTop = maxScrollTop;
        else if (isFirstStaff && !alreadyInView) newScrollTop = 0;
        else if (alreadyInView) return; // nothing to do, don't fight the user's position
        else {
            let delta = 0;
            //cursor's staff is out of the bottom of the screen
            if (staffBottomPixelY > wrapperRect.bottom) {
                delta = staffBottomPixelY - wrapperRect.bottom;
            }
            //cursors staff is out of the top of the screen
            else if (staffTopPixelY < wrapperRect.top) {
                delta = staffTopPixelY - wrapperRect.top;
            }

            if (delta === 0) return;

            newScrollTop = Math.max(0, Math.min(maxScrollTop, el.scrollTop + delta));
        }

        //use this to mark computer scrolling vs human scrolling so that the two scroll events can tell the dif 
        if (Math.abs(newScrollTop - el.scrollTop) > 1) {
            isAutoScrollingRef.current = true;
            el.scrollTo({ top: newScrollTop, behavior: 'smooth' });
            //should auto set screen locked to be false bc we know that after we scroll we'll be able to see the cursor
            setScreenLocked(false);

            // clear the flag once the smooth scroll settles
            const clear = () => { isAutoScrollingRef.current = false; };
            if ('onscrollend' in el) {
                el.addEventListener('scrollend', clear, { once: true });
            } else {
                setTimeout(clear, 500); //fallback for browsers without scrollend
            }
        }
    }, [cursor_pos.ypos, playingSong, screenLocked, staff_count]);

    useEffect(() => {
        if (clickedSelectCursor !== null) {
            handleCursorPointerDown(clickedSelectCursor, lastPointerYSelect, scrollRafIdSelect, isDraggingSelect);
            setClickedSelectCursor(null);
        }
        else if (clickedAnywhere) {
            setClickedAnywhere(false);
            if (showSelectCursor) {
                setSelectCursor(-1);
                setShowSelectCursor(false);
            }
        }
    }, [clickedAnywhere, clickedSelectCursor, showSelectCursor])

    useEffect(() => {
        doubleClickCursorRepos?.(handleDoubleClickRepos);
        return () => doubleClickCursorRepos?.(() => { })
    }, [doubleClickCursorRepos])

    function calculate_cursor_xypos(cursor: number, beats_per_measure: number, used_clefs: Clefs[], measuresPerStaff: number) {
        if (cursor === undefined) return { xpos: measurementConstants.starting_gap + measurementConstants.measure_padding, ypos: 0 };

        const beats_per_staff = measuresPerStaff * beats_per_measure;
        const current_staff = Math.floor(cursor / beats_per_staff);
        const beat_in_staff = cursor % beats_per_staff;

        const current_measure = Math.floor(beat_in_staff / beats_per_measure);
        const beat_in_measure = beat_in_staff % beats_per_measure;

        let left_edge = 0;
        let alloted_note_width = 0;

        if (current_staff === 0) {
            left_edge = measurementConstants.starting_gap + measurementConstants.measure_padding + (current_measure * measurementConstants.measure_width);
            alloted_note_width = (measurementConstants.measure_width - 2 * measurementConstants.measure_padding) / beats_per_measure;
        } else {
            if (current_measure === 0) {
                left_edge = measurementConstants.starting_clef_offset + measurementConstants.measure_padding;
                alloted_note_width = ((measurementConstants.measure_width + measurementConstants.starting_gap - measurementConstants.starting_clef_offset) - 2 * measurementConstants.measure_padding) / beats_per_measure;
            } else {
                const expanded_measure_width = measurementConstants.measure_width + measurementConstants.starting_gap - measurementConstants.starting_clef_offset;
                left_edge = measurementConstants.starting_clef_offset + expanded_measure_width + ((current_measure - 1) * measurementConstants.measure_width) + measurementConstants.measure_padding;
                alloted_note_width = (measurementConstants.measure_width - 2 * measurementConstants.measure_padding) / beats_per_measure;
            }
        }

        return {
            xpos: left_edge + beat_in_measure * alloted_note_width,
            ypos: current_staff * used_clefs.length * measurementConstants.staff_height
        };
    }

    function calculate_cursor_beat_inverse(
        svgX: number,
        svgY: number,
        beats_per_measure: number,
        used_clefs: Clefs[],
        measuresPerStaff: number,
        staff_count: number
    ) {
        const beats_per_staff = measuresPerStaff * beats_per_measure;
        const staff_block_height = used_clefs.length * measurementConstants.staff_height;

        let current_staff = Math.floor(svgY / staff_block_height);
        current_staff = Math.max(0, Math.min(staff_count - 1, current_staff));

        let current_measure = 0;
        let beat_in_measure = 0;

        //4 sixteenth notes slots per beat
        const subdivisions_per_beat = 4;
        //width of a single sixteenth note 
        const alloted_slot_width =
            (measurementConstants.measure_width - 2 * measurementConstants.measure_padding) /
            (beats_per_measure * subdivisions_per_beat);

        if (current_staff === 0) {
            //clamp so if we're in the starting gap then we won't move to the end of the measure 
            const relToDivider = Math.max(0, svgX - measurementConstants.starting_gap);

            const raw_measure = Math.floor(relToDivider / measurementConstants.measure_width);

            if (raw_measure >= measuresPerStaff) {
                //past the end of the staff -- pin to the last beat of the last measure
                current_measure = measuresPerStaff - 1;
                beat_in_measure = beats_per_measure;
            } else {
                current_measure = raw_measure;
                const contentLeftEdge =
                    measurementConstants.starting_gap +
                    measurementConstants.measure_padding +
                    current_measure * measurementConstants.measure_width;
                const remInMeasure = Math.max(0, svgX - contentLeftEdge);
                beat_in_measure = (remInMeasure / alloted_slot_width) / subdivisions_per_beat;
            }
        } else {
            const first_measure_full_width = measurementConstants.measure_width + measurementConstants.starting_gap - measurementConstants.starting_clef_offset;
            const first_left_edge = measurementConstants.starting_clef_offset + measurementConstants.measure_padding;
            const first_alloted_slot_width =
                (first_measure_full_width - 2 * measurementConstants.measure_padding) /
                (beats_per_measure * subdivisions_per_beat);

            if (svgX < measurementConstants.starting_clef_offset + first_measure_full_width) {
                current_measure = 0;
                const slot_idx = Math.max(0, svgX - first_left_edge) / first_alloted_slot_width;
                beat_in_measure = slot_idx / subdivisions_per_beat;
            } else {
                //true divider for measures >= 1 in this row
                const dividerOrigin = measurementConstants.starting_clef_offset + first_measure_full_width;
                const relToDivider = svgX - dividerOrigin;
                const raw_measure = Math.floor(relToDivider / measurementConstants.measure_width) + 1;

                if (raw_measure >= measuresPerStaff) {
                    //past the end of the staff -- pin to the last beat of the last measure
                    current_measure = measuresPerStaff - 1;
                    beat_in_measure = beats_per_measure;
                } else {
                    current_measure = raw_measure;
                    //content-left-edge of this measure = divider + padding
                    const contentLeftEdge =
                        dividerOrigin +
                        (current_measure - 1) * measurementConstants.measure_width +
                        measurementConstants.measure_padding;
                    const remInMeasure = Math.max(0, svgX - contentLeftEdge);
                    beat_in_measure = (remInMeasure / alloted_slot_width) / subdivisions_per_beat;
                }
            }
        }

        current_measure = Math.max(0, Math.min(measuresPerStaff - 1, current_measure));

        //snap to nearest 16th note 
        const snapped_beat_in_measure = Math.round(beat_in_measure * subdivisions_per_beat) / subdivisions_per_beat;
        const beat = Math.max(0, Math.min(beats_per_measure - 0.25, snapped_beat_in_measure));

        return current_staff * beats_per_staff + current_measure * beats_per_measure + beat;
    }

    function pointer_coords_to_svg_xy(clientX: number, clientY: number, containerRef: React.RefObject<HTMLDivElement | null>) {
        const svg = containerRef.current?.querySelector('svg');
        if (!svg) return { x: 0, y: 0 };

        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const x_scale = svgRect.width / viewBox.width;
        const y_scale = svgRect.height / viewBox.height;

        return {
            x: (clientX - svgRect.left) / x_scale + viewBox.x,
            y: (clientY - svgRect.top) / y_scale + viewBox.y,
        };
    }

    function svg_y_to_pointer_coord(containerRef: React.RefObject<HTMLDivElement | null>, y: number) {
        const svg = containerRef.current?.querySelector('svg');
        if (!svg) return;

        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const y_scale = svgRect.height / viewBox.height;

        return svgRect.top + (y - viewBox.y) * y_scale;
    }

    //measured in pixels
    const scrollThreshold = 60;
    const maxScrollSpeed = 15;

    const lastPointerY = useRef<number | null>(null);
    const lastPointerYSelect = useRef<number | null>(null);
    const scrollRafId = useRef<number | null>(null);
    const scrollRafIdSelect = useRef<number | null>(null);

    const runEdgeScroll = (
        lastPointerY: RefObject<number | null>,
        scrollRafId: RefObject<number | null>,
        isDragging: RefObject<boolean>
    ) => {
        const el = scrollWrapperRef.current;
        if (!el || lastPointerY.current === null || !isDragging.current) {
            scrollRafId.current = null;
            return;
        }

        const rect = el.getBoundingClientRect();
        const y = lastPointerY.current;

        let delta = 0;

        if (y < rect.top + scrollThreshold) {
            //near top edge... closeness determines speed
            const intensity = (rect.top + scrollThreshold - y) / scrollThreshold;
            delta = -Math.ceil(maxScrollSpeed * Math.min(1, intensity));
        } else if (y > rect.bottom - scrollThreshold) {
            const intensity = (y - (rect.bottom - scrollThreshold)) / scrollThreshold;
            delta = Math.ceil(maxScrollSpeed * Math.min(1, intensity));
        }

        if (delta !== 0) {
            const maxScrollTop = el.scrollHeight - el.clientHeight;
            const nextScrollTop = Math.max(0, Math.min(maxScrollTop, el.scrollTop + delta));
            if (nextScrollTop !== el.scrollTop) {
                el.scrollTop = nextScrollTop;
            }
        }

        scrollRafId.current = requestAnimationFrame(() => runEdgeScroll(lastPointerY, scrollRafId, isDragging));
    };

    const handleCursorPointerDown = (
        e: React.PointerEvent,
        lastPointerY: RefObject<number | null>,
        scrollRafId: RefObject<number | null>,
        isDragging: RefObject<boolean>
    ) => {
        if (!setCursor) return;
        isDragging.current = true;

        if (playingSong && manuallyToggleMusicPlayback) {
            lastMovementOfCursorTriggeredBy.current = 'manually'
            manuallyToggleMusicPlayback(false); //pause no need to synchronise the wait
        }

        lastPointerY.current = e.clientY;
        (e.target as Element).setPointerCapture(e.pointerId);
        e.stopPropagation();

        if (scrollRafId.current === null) {
            scrollRafId.current = requestAnimationFrame(() => runEdgeScroll(lastPointerY, scrollRafId, isDragging));
        }
    };

    const handleCursorPointerMove = (
        e: React.PointerEvent,
        setCursor: Dispatch<SetStateAction<number>>,
        lastPointerY: RefObject<number | null>,
        isDragging: RefObject<boolean>
    ) => {
        if (!isDragging.current || !setCursor) return;

        lastPointerY.current = e.clientY;

        const { x, y } = pointer_coords_to_svg_xy(e.clientX, e.clientY + tipHeight, containerRef);
        const newBeat = calculate_cursor_beat_inverse(
            x, y, beats_per_measure, used_clefs, measuresPerStaff, staff_count
        );
        setCursor(newBeat);

    };

    const handleCursorPointerUp = async (
        e: React.PointerEvent,
        lastPointerY: RefObject<number | null>,
        isDragging: RefObject<boolean>
    ) => {
        isDragging.current = false;
        lastPointerY.current = null;
        (e.target as Element).releasePointerCapture(e.pointerId);
        if (scrollRafId.current !== null) {
            cancelAnimationFrame(scrollRafId.current);
            scrollRafId.current = null;
        }

        if (playingSong && manuallyToggleMusicPlayback) {
            await manuallyToggleMusicPlayback(true);
        }
    };

    const handleDoubleClick = () => {

        lastMovementOfCursorTriggeredBy.current = 'automatically';

        isDragging.current = false;
        isDraggingSelect.current = false;
        lastPointerY.current = null;
        lastPointerYSelect.current = null;
        if (scrollRafId.current !== null) { cancelAnimationFrame(scrollRafId.current); scrollRafId.current = null; }
        if (scrollRafIdSelect.current !== null) {
            cancelAnimationFrame(scrollRafIdSelect.current); scrollRafIdSelect.current = null;
        }

        if (!showSelectCursor) {
            setShowSelectCursor(true);
            setSelectCursor(cursor + 1);
        }
        else {
            setShowSelectCursor(false);
            setSelectCursor(-1);
        }
    }

    const handleDoubleClickRepos = (e: React.MouseEvent) => {
        lastPointerY.current = e.clientY;

        const { x, y } = pointer_coords_to_svg_xy(e.clientX, e.clientY + tipHeight, containerRef);
        const newBeat = calculate_cursor_beat_inverse(
            x, y, beats_per_measure, used_clefs, measuresPerStaff, staff_count
        );
        setCursor(newBeat);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'backspace' && setNotes !== undefined) {
            setNotes(deleteAllInRange(cursor, selectCursor, notes, stateManager, toaster).updatedNotes);
            setShowSelectCursor(false);
            setSelectCursor(-1);
        }
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'c') {
                if (!showSelectCursor) return;
                const copiedNotes = copyNotesOffsetJustified(cursor, selectCursor, notes);
                const len = Array.from(copiedNotes.values()).flat().length;
                if (len > 0) {
                    setClipBoard(copiedNotes);
                    if (toaster) toaster.add_message(`${len} note${len !== 1 ? 's' : ''} copied to clipboard.`, 'var(--success-colour)');
                }
            }
            else if (e.key.toLowerCase() === 'v' && setNotes !== undefined && clipBoard !== emptyNoteMap) {
                setNotes(pasteNotesRangeSelected(cursor, selectCursor, notes, clipBoard, stateManager, toaster).updatedNotes);
            }
            else if (e.key.toLowerCase() === 'a') {
                const maxOffsetNote = notes.reduce<Note | undefined>((max, note) => {
                    return (!max || note.offset > max.offset) ? note : max;
                }, undefined);
                if (maxOffsetNote) {
                    setCursor(0);
                    setSelectCursor(maxOffsetNote.offset + maxOffsetNote.duration);
                    setShowSelectCursor(true);
                }
            }
        }
    }

    useEffect(() => {

        const handleWindowPointerDown = () => setClickedAnywhere(true);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('pointerdown', handleWindowPointerDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('pointerdown', handleWindowPointerDown);
        }
    }, [handleKeyDown])

    useEffect(() => {
        setCursorPos(calculate_cursor_xypos(cursor, beats_per_measure, used_clefs, measuresPerStaff));
    }, [cursor, measuresPerStaff, used_clefs, beats_per_measure])

    useLayoutEffect(() => {
        if (selectCursor <= cursor && showSelectCursor) {
            setShowSelectCursor(false);
            setSelectCursor(-1);
            if (toaster) toaster.add_message('Select cursor has to always come after the play cursor.', 'color-mix(brown 30%, var(--warning-colour) 70%)')
        }
        else {
            setSelectCursorPos(calculate_cursor_xypos(selectCursor, beats_per_measure, used_clefs, measuresPerStaff))
        }
    }, [cursor, selectCursor, showSelectCursor, measuresPerStaff, used_clefs, beats_per_measure])

    return (
        <>
            {
                showSelectCursor && (
                    <SelectRegions
                        cursor_pos={cursor_pos}
                        selectCursor_pos={selectCursor_pos}
                        used_clefs={used_clefs}
                        measurementConstants={measurementConstants}
                        measuresPerStaff={measuresPerStaff}
                    />
                )
            }
            <g
                onPointerDown={(e) => handleCursorPointerDown(e, lastPointerY, scrollRafId, isDragging)}
                onPointerMove={(e) => handleCursorPointerMove(e, setCursor, lastPointerY, isDragging)}
                onPointerUp={async (e) => await handleCursorPointerUp(e, lastPointerY, isDragging)}
                onDoubleClick={handleDoubleClick}
                style={{ cursor: 'grab', touchAction: 'none' }}
            >
                <line
                    x1={cursor_pos.xpos}
                    x2={cursor_pos.xpos}
                    y1={cursor_pos.ypos - tipHeight}
                    y2={cursor_pos.ypos + measurementConstants.measure_height * used_clefs.length + measurementConstants.inter_staff_gap * (used_clefs.length - 1) + tipHeight}
                    className='cursor'
                />
                <path
                    d="M -30 -25 L 30 -25 L 0 15 Z"
                    style={{
                        '--x': `${cursor_pos.xpos}px`,
                        '--y': `${cursor_pos.ypos - tipHeight}px`
                    } as React.CSSProperties}
                    transform={`translate(${cursor_pos.xpos}, ${cursor_pos.ypos - tipHeight})`}
                    className='cursor tip'
                />
            </g>
            {
                showSelectCursor && (
                    <>
                        <g
                            onPointerDown={(e) => setClickedSelectCursor(e)}
                            onPointerMove={(e) => handleCursorPointerMove(e, setSelectCursor, lastPointerYSelect, isDraggingSelect)}
                            onPointerUp={(e) => handleCursorPointerUp(e, lastPointerYSelect, isDraggingSelect)}
                            onDoubleClick={handleDoubleClick}
                            style={{ cursor: 'grab', touchAction: 'none' }}
                        >
                            <line
                                x1={selectCursor_pos.xpos}
                                x2={selectCursor_pos.xpos}
                                y1={selectCursor_pos.ypos - tipHeight}
                                y2={selectCursor_pos.ypos + measurementConstants.measure_height * used_clefs.length + measurementConstants.inter_staff_gap * (used_clefs.length - 1) + tipHeight}
                                className='cursor select'
                            />
                            <path
                                d="M -30 -25 L 30 -25 L 0 15 Z"
                                style={{
                                    '--x': `${selectCursor_pos.xpos}px`,
                                    '--y': `${selectCursor_pos.ypos - tipHeight}px`
                                } as React.CSSProperties}
                                transform={`translate(${selectCursor_pos.xpos}, ${selectCursor_pos.ypos - tipHeight})`}
                                className='cursor select tip'
                            />
                        </g>
                    </>
                )
            }
        </>
    )
}