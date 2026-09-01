
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay, PlaybackCursorInstructionsDisplay } from "./MusicEditorInstructions";
import { MockPopupSvg } from "./MockPopupSvg";
import './MusicPlayerMovingPlaybackInstructionsSvg.css'
import { type ButtonStates, MockPlayerSvg } from "./MockPlayerSvg";
import type { PlaybackState } from "../services/types";

export function MusicPlayerMovingPlaybackSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const measureAspectRatio = 2.5;
    const [measureSize, setMeasureSize] = useState({ w: 0, h: 0 })

    const [playerButtonStates, setPlayerButtonStates] = useState<ButtonStates>({
        volume: '',
        slider: 'inactive',
        restart: '',
        rewind: '',
        forward: '',
        metronome: '',
        pause: '',
    })

    const [playerPlaybackStates, setPlaybackState] = useState<PlaybackState>('paused');
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

    const animDur = 9000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 9.1;
    const playBackDur = (3 - 1.6) / relativeTotal * animDur

    useEffect(() => {
        const resetState = () => {
            setPlayerButtonStates({
                volume: '',
                slider: 'inactive',
                restart: '',
                rewind: '',
                forward: '',
                metronome: '',
                pause: '',
            });
            setPlaybackState('paused')
            setPlaybackCursorOffset(0);
        };

        const runSequence = () => {
            resetState();

            const pause_hover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    pause: 'hovered'
                }));
            }, 1.5 / relativeTotal * animDur);

            let animFrameId;
            const pause_click = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    pause: 'clicked'
                }));
                setPlaybackState('playing')

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

            }, 1.8 / relativeTotal * animDur);
            const pause_click2 = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    pause: 'clicked'
                }));
                setPlaybackState('paused')
                setPlaybackCursorOffset(1);
            }, 3 / relativeTotal * animDur);

            const pause_unhover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    pause: ''
                }));
                setPlaybackState('paused')
            }, 3.4 / relativeTotal * animDur);

            const rewind_hover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    rewind: 'hovered'
                }));
            }, 3.8 / relativeTotal * animDur);
            const rewind_click = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    rewind: 'clicked'
                }));
                setPlaybackCursorOffset(prev => prev - 0.6);
            }, 4.1 / relativeTotal * animDur);
            const rewind_unhover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    rewind: ''
                }));
            }, 4.4 / relativeTotal * animDur);

            const forward_hover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    forward: 'hovered'
                }));
            }, 5.4 / relativeTotal * animDur);
            const forward_click = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    forward: 'clicked'
                }));
                setPlaybackCursorOffset(prev => prev + 0.6);
            }, 5.7 / relativeTotal * animDur);
            const forward_unhover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    forward: ''
                }));
            }, 6.1 / relativeTotal * animDur);

            const restart_hover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    restart: 'hovered'
                }));
            }, 6.5 / relativeTotal * animDur);
            const restart_click = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    restart: 'clicked'
                }));
                setPlaybackCursorOffset(0);
            }, 6.8 / relativeTotal * animDur);
            const restart_unhover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    restart: ''
                }));
            }, 7.2 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(pause_hover)
                clearTimeout(pause_click)
                clearTimeout(pause_click2)
                clearTimeout(pause_unhover)
                clearTimeout(rewind_hover)
                clearTimeout(rewind_click)
                clearTimeout(rewind_unhover)
                clearTimeout(forward_hover)
                clearTimeout(forward_click)
                clearTimeout(forward_unhover)
                clearTimeout(restart_hover)
                clearTimeout(restart_click)
                clearTimeout(restart_unhover)
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
            className="instructions-container music-player-playback"
            style={{
                ['--moveDistX1' as any]: measureSize.w * (startingCursorFactors.x - 0.68),
                ['--moveDistY1' as any]: measureSize.h * (startingCursorFactors.y - 1.65),
                ['--moveDistX2' as any]: measureSize.w * (startingCursorFactors.x - 0.51),
                ['--moveDistY2' as any]: measureSize.h * (startingCursorFactors.y - 1.65),
                ['--moveDistX3' as any]: measureSize.w * (startingCursorFactors.x - 0.87),
                ['--moveDistY3' as any]: measureSize.h * (startingCursorFactors.y - 1.65),
                ['--moveDistX4' as any]: measureSize.w * (startingCursorFactors.x - 0.34),
                ['--moveDistY4' as any]: measureSize.h * (startingCursorFactors.y - 1.65),
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
                                        pos={{ x: measureSize.w * 0.5, y: measureSize.h * 0.5 }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                    />
                                    <PlaybackCursorInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.1 + (measureSize.w * 0.8) * playBackCursorOffset, y: measureSize.h * 0 }}
                                        size={measureSize.h}
                                    />
                                    <MockPlayerSvg
                                        startPos={{ x: (-(svgDimensions.w - measureSize.w) / 2) + (svgDimensions.w / 2 - measureSize.w * 1.68 / 2), y: measureSize.h + svgDimensions.h / 10 }}
                                        scaleW={measureSize.w * 1.6}
                                        alterableVals={{
                                            playbackState: playerPlaybackStates
                                        }}
                                        buttonStates={playerButtonStates}
                                        setButtonStates={setPlayerButtonStates}
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
                <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '8px' }}>
                    <li>Use the pause / unpause button to pause / and resume playback.</li>
                    <li>Use the replay and forward buttons to rewind the cursor 5 beats or move it 5 beats forwards.</li>
                    <li>Use the restart button to set the cursor back at the beginning of the song.</li>
                </ul>
            </div>
        </div>
    )
}