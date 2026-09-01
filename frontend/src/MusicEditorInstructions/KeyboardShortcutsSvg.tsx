import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay } from "./MusicEditorInstructions";
import './KeyboardShortcutsSvg.css'
import { MockKeyboardSvg } from "./MockKeyboardSvg";

export function KeyboardShortcutsSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const measureAspectRatio = 2.5;
    const [measureSize, setMeasureSize] = useState({ w: 0, h: 0 })

    useLayoutEffect(() => {
        if (!svgContainerRef.current) return;

        const handleResize = () => {
            const w = svgContainerRef.current?.clientWidth ?? 0;
            const h = svgContainerRef.current?.clientHeight ?? 0;

            if (!w || !h) return;

            let targetW = Math.max(w * 0.5, 200 * measureAspectRatio);
            let targetH = targetW / measureAspectRatio;

            if (targetW > w * 0.9) {
                targetW = w * 0.9;
                targetH = targetW / measureAspectRatio;
            }
            if (targetH > h * 0.9) {
                targetH = h * 0.9;
                targetW = targetH * measureAspectRatio;
            }

            setSvgDimensions({ w, h });
            setMeasureSize({ w: targetW * 0.6, h: targetH * 0.6 });
        };

        handleResize();

        const observer = new ResizeObserver(handleResize);
        observer.observe(svgContainerRef.current);

        return () => observer.disconnect();
    }, []);

    const [currNoteData, setCurrNoteData] = useState({
        heightOffsetRatio: 0,
        duration: 1,
    })

    const animDur = 14000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 15.3;

    useEffect(() => {
        const resetState = () => {
            setCurrNoteData({
                heightOffsetRatio: 0,
                duration: 1,
            })
        };

        const runSequence = () => {
            resetState();

            const t1 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    heightOffsetRatio: 0.125,
                }))
            }, 8.1 / relativeTotal * animDur);
            const t2 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    heightOffsetRatio: 0.25,
                }))
            }, 8.7 / relativeTotal * animDur);
            const t3 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    heightOffsetRatio: 0.125,
                }))
            }, 9.6 / relativeTotal * animDur);
            const t4 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    heightOffsetRatio: 0,
                }))
            }, 10.2 / relativeTotal * animDur);
            const t5 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    duration: 0.5
                }))
            }, 11.1 / relativeTotal * animDur);
            const t6 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    duration: 1
                }))
            }, 12 / relativeTotal * animDur);
            const t7 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    duration: 1.5
                }))
            }, 12.5 / relativeTotal * animDur);
            const t8 = setTimeout(() => {
                setCurrNoteData(prev => ({
                    ...prev,
                    duration: 1
                }))
            }, 13.4 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
                clearTimeout(t4);
                clearTimeout(t5);
                clearTimeout(t6);
                clearTimeout(t7);
                clearTimeout(t8);
            };
        };

        let cancelTimeouts = runSequence();

        const intervalId = setInterval(() => {
            cancelTimeouts();
            cancelTimeouts = runSequence();
        }, animDur);

        return () => {
            clearInterval(intervalId);
            cancelTimeouts();
        };
    }, []);

    const startingCursorFactors = { x: 1.1, y: 0.6 }

    return (
        <div
            className="instructions-container keyboard-shortcuts"
            style={{
                ['--moveDistX1' as any]: measureSize.w * (startingCursorFactors.x - 0.48),
                ['--moveDistY1' as any]: measureSize.h * (startingCursorFactors.y - 0.48),
                ['--moveDistX2' as any]: measureSize.w * (startingCursorFactors.x - 0.18),
                ['--moveDistY2' as any]: measureSize.h * (startingCursorFactors.y - 0.48),
                ['--moveDistX3' as any]: measureSize.w * (startingCursorFactors.x - 0.78),
                ['--moveDistY3' as any]: measureSize.h * (startingCursorFactors.y - 0.48),
                ['--animDur' as any]: `${animDur / 1000}s`
            } as React.CSSProperties}
        >
            <div className="svg-wrapper" ref={svgContainerRef}>
                {
                    svgDimensions.h > 0 && (
                        <svg
                            viewBox={`0 0 ${svgDimensions.w} ${svgDimensions.h}`}
                            width="100%"
                            height="100%"
                        >
                            <DropShadows />
                            <g
                                transform={`translate(${(svgDimensions.w - measureSize.w) / 2}, ${svgDimensions.h / 2 - measureSize.h})`}
                            >
                                <g className="scroll-group" key={`${svgDimensions.w}-${svgDimensions.h}`}>
                                    <MeasureInstructionsDisplay
                                        measureSize={measureSize}
                                    />
                                    <NoteInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.5, y: measureSize.h * (0.5 - currNoteData.heightOffsetRatio) }}
                                        fontSize={measureSize.w / 4}
                                        duration={currNoteData.duration}
                                        flipped={currNoteData.heightOffsetRatio > 0}
                                        id={'M'}
                                    />
                                    <NoteInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.2, y: measureSize.h * 0.5 }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                        id={'L'}
                                    />
                                    <NoteInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.8, y: measureSize.h * 0.5 }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                        id={'R'}
                                    />
                                    <MockKeyboardSvg
                                        startPos={{ x: (-(svgDimensions.w - measureSize.w) / 2) + (svgDimensions.w / 2 - measureSize.w * 1.68 / 2), y: measureSize.h + svgDimensions.h / 10 }}
                                        scaleW={measureSize.w * 1.68}
                                    />
                                    <CursorInstructionsDisplay
                                        dimensions={{
                                            x: measureSize.w * startingCursorFactors.x,
                                            y: measureSize.h * startingCursorFactors.y,
                                            size: measureSize.w / 8
                                        }}
                                    />
                                </g>
                            </g>
                        </svg>
                    )
                }
            </div>
            <div className='description'>
                <div>
                    <p style={{ fontSize: 'medium' }}>
                        Certain keys on the keyboard can be used to edit the notes too. <strong>Click any note,</strong> then:
                    </p>
                    <ul style={{ fontSize: 'small', listStyleType: 'none', paddingLeft: 0, marginTop: '8px' }}>
                        <li><strong>A</strong> / <strong>D</strong> add notes to the left and right.</li>
                        <li><strong>W</strong> / <strong>S</strong> increase and decrease the pitch.</li>
                        <li><strong>Q</strong> / <strong>E</strong> decrease and increase the note's duration.</li>
                        <li><strong>R</strong> toggles whether or not the note is dotted.</li>
                        <li><strong>Backspace</strong> deletes a note.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}