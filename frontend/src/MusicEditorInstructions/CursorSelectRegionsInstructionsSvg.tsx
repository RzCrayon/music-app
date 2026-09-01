
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay, PlaybackCursorInstructionsDisplay } from "./MusicEditorInstructions";
import './CursorSelectRegionsInstructionsSvg.css'
import { type ButtonStates, MockPlayerSvg } from "./MockPlayerSvg";
import type { PlaybackState } from "../services/types";

export function CursorRegionsSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const measureAspectRatio = 2.5;
    const [measureSize, setMeasureSize] = useState({ w: 0, h: 0 })

    const [cursorTipState, setCursorTipState] = useState<'active' | 'inactive' | 'hovered'>('inactive');
    const [cursorSelectTipState, setCursorSelectTipState] = useState<'active' | 'inactive' | 'hovered'>('inactive');
    //percentage
    const [playBackCursorOffset, setPlaybackCursorOffset] = useState(0);

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

    const animDur = 6000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 6.8;
    const playBackDur = 0.71 / relativeTotal * animDur

    useEffect(() => {
        const resetState = () => {
            setCursorTipState('inactive')
            setCursorSelectTipState('inactive')
            setPlaybackCursorOffset(0);
        };

        const runSequence = () => {
            resetState();

            const cursor_hover = setTimeout(() => {
                setCursorTipState('hovered')
            }, 1.5 / relativeTotal * animDur);

            const cursor_click1 = setTimeout(() => {
                setCursorTipState('active')
            }, 1.8 / relativeTotal * animDur);

            const cursor_release1 = setTimeout(() => {
                setCursorTipState('inactive')
            }, 1.9 / relativeTotal * animDur);

            const cursor_click2 = setTimeout(() => {
                setCursorTipState('active');
            }, 2.1 / relativeTotal * animDur);

            const cursor_release2 = setTimeout(() => {
                setCursorTipState('hovered')
                setPlaybackCursorOffset(0.5);
            }, 2.2 / relativeTotal * animDur);

            const cursor_unhover = setTimeout(() => {
                setCursorTipState('inactive')
            }, 2.5 / relativeTotal * animDur);

            let animFrameId;
            const select_cursor_click = setTimeout(() => {
                setCursorSelectTipState('active')

                const startTime = performance.now();
                const gapDur = 200;
                const totalDur = playBackDur * 2 + gapDur;

                const animatePlaybackCursor = (currTime: number) => {
                    const elapsed = currTime - startTime;
                    let progress: number;

                    if (elapsed <= playBackDur) {
                        progress = 0.5 + 0.5 * (elapsed / playBackDur);
                    } else if (elapsed <= playBackDur + gapDur) {
                        progress = 1.0;
                    } else if (elapsed < totalDur) {
                        const phase3Elapsed = elapsed - (playBackDur + gapDur);
                        progress = 1.0 - 0.5 * (phase3Elapsed / playBackDur);
                    } else {
                        progress = 0.5;
                    }

                    setPlaybackCursorOffset(progress);

                    if (elapsed < totalDur) {
                        animFrameId = requestAnimationFrame(animatePlaybackCursor);
                    }
                };

                animFrameId = requestAnimationFrame(animatePlaybackCursor);

            }, 3.5 / relativeTotal * animDur);

            const select_cursor_lift = setTimeout(() => {
                setCursorSelectTipState('inactive')
            }, 5.4 / relativeTotal * animDur);

            const select_cursor_snap = setTimeout(() => {
                setPlaybackCursorOffset(0)
            }, 6.5 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(cursor_hover)
                clearTimeout(cursor_click1)
                clearTimeout(cursor_release1)
                clearTimeout(cursor_click2)
                clearTimeout(cursor_release2)
                clearTimeout(cursor_unhover)
                clearTimeout(select_cursor_click);
                clearTimeout(select_cursor_lift);
                clearTimeout(select_cursor_snap)
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
            className="instructions-container cursor-regions"
            style={{
                ['--moveDistX1' as any]: measureSize.w * (startingCursorFactors.x - 0.07),
                ['--moveDistY1' as any]: measureSize.h * (startingCursorFactors.y + 0.3),
                ['--moveDistX2' as any]: measureSize.w * (startingCursorFactors.x - 0.5),
                ['--moveDistY2' as any]: measureSize.h * (startingCursorFactors.y + 0.3),
                ['--moveDistX3' as any]: measureSize.w * (startingCursorFactors.x - 0.9),
                ['--moveDistY3' as any]: measureSize.h * (startingCursorFactors.y + 0.3),
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
                                transform={`translate(${(svgDimensions.w - measureSize.w) / 2}, ${svgDimensions.h / 2 - measureSize.h / 2})`}
                            >
                                <g className="scroll-group" key={`${svgDimensions.w}-${svgDimensions.h}`}>
                                    <MeasureInstructionsDisplay
                                        measureSize={measureSize}
                                    />
                                    <NoteInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.67, y: measureSize.h * 0.5 }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                    />
                                    <NoteInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.33, y: measureSize.h * 0.5 }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                    />
                                    <rect
                                        x={measureSize.w * 0.1}
                                        y={0}
                                        width={measureSize.w * 0.8 * playBackCursorOffset}
                                        height={measureSize.h}
                                        fill='color-mix(in srgb, var(--select-colour) 40%, transparent)'
                                    />
                                    <PlaybackCursorInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.1, y: measureSize.h * 0 }}
                                        size={measureSize.h}
                                        tipState={cursorTipState}
                                    />
                                    <g
                                        style={{
                                            opacity: playBackCursorOffset > 0 ? 1 : 0
                                        }}
                                    >
                                        <PlaybackCursorInstructionsDisplay
                                            pos={{ x: measureSize.w * 0.1 + (measureSize.w * 0.8) * playBackCursorOffset, y: measureSize.h * 0 }}
                                            size={measureSize.h}
                                            tipState={cursorSelectTipState}
                                            fill="var(--select-colour)"
                                        />
                                    </g>
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
                    <p>
                        Double-click the <strong>playback cursor</strong> to bring up the <strong>select cursor</strong>, then highlight the desired region.
                    </p>
                    <ul>
                        <li><kbd>Backspace</kbd> Delete region</li>
                        <li><kbd>Ctrl</kbd> + <kbd>C</kbd> Copy region</li>
                        <li><kbd>Ctrl</kbd> + <kbd>V</kbd> Paste region</li>
                    </ul>
                    <p>To close the select cursor, click anywhere on the screen.</p>
                </div>
            </div>
        </div>
    )
}