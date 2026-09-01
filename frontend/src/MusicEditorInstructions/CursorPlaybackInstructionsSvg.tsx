
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay, PlaybackCursorInstructionsDisplay } from "./MusicEditorInstructions";
import './CursorPlaybackInstructionsSvg.css'
import { type ButtonStates, MockPlayerSvg } from "./MockPlayerSvg";
import type { PlaybackState } from "../services/types";

export function CursorPlaybackSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const measureAspectRatio = 2.5;
    const [measureSize, setMeasureSize] = useState({ w: 0, h: 0 })

    const [cursorTipState, setCursorTipState] = useState<'active' | 'inactive' | 'hovered'>('inactive');
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
    const relativeTotal = 7.7;
    const playBackDur = 1.5 / relativeTotal * animDur

    useEffect(() => {
        const resetState = () => {
            setCursorTipState('inactive')
            setPlaybackCursorOffset(0);
        };

        const runSequence = () => {
            resetState();

            const cursor_hover = setTimeout(() => {
                setCursorTipState('hovered')
            }, 1.5 / relativeTotal * animDur);

            let animFrameId;
            const cursor_click = setTimeout(() => {
                setCursorTipState('active')

                const startTime = performance.now();
                const animatePlaybackCursor = (currTime: number) => {
                    const elapsed = currTime - startTime;
                    const progress = Math.min(1, elapsed / playBackDur);
                    setPlaybackCursorOffset(progress);
                    if (progress < 1) {
                        animFrameId = requestAnimationFrame(animatePlaybackCursor);
                    }
                }
                animFrameId = requestAnimationFrame(animatePlaybackCursor);

            }, 1.9 / relativeTotal * animDur);


            const cursor_lift = setTimeout(() => {
                setCursorTipState('inactive')
            }, 3.4 / relativeTotal * animDur);

            const cursor_snap = setTimeout(() => {
                setPlaybackCursorOffset(0)
            }, 5.8 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(cursor_hover)
                clearTimeout(cursor_click)
                clearTimeout(cursor_lift)
                clearTimeout(cursor_snap)
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
            className="instructions-container cursor-playback"
            style={{
                ['--moveDistX1' as any]: measureSize.w * (startingCursorFactors.x - 0.07),
                ['--moveDistY1' as any]: measureSize.h * (startingCursorFactors.y + 0.3),
                ['--moveDistX2' as any]: measureSize.w * (startingCursorFactors.x - 0.9),
                ['--moveDistY2' as any]: measureSize.h * (startingCursorFactors.y + 0.3),
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
                                        pos={{ x: measureSize.w * 0.5, y: measureSize.h * 0.5 }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                    />
                                    <PlaybackCursorInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.1 + (measureSize.w * 0.8) * playBackCursorOffset, y: measureSize.h * 0 }}
                                        size={measureSize.h}
                                        tipState={cursorTipState}
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
                {'Click and drag the cursor to move the playback.\nAlternatively, double click anywhere to snap the cursor to that position.'}
            </div>
        </div>
    )
}