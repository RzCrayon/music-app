
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay, PlaybackCursorInstructionsDisplay } from "./MusicEditorInstructions";
import { MockPopupSvg } from "./MockPopupSvg";
import './MusicPlayerVolumeInstructions.css'
import { type ButtonStates, MockPlayerSvg } from "./MockPlayerSvg";
import type { PlaybackState } from "../services/types";

export function MusicPlayerVolumeSvg() {

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

    //percentage
    const [volume, setVolume] = useState(1);

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

    const animDur = 7000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 8.2;
    const playBackDur = 0.8 / relativeTotal * animDur

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
            setVolume(1);
        };

        const runSequence = () => {
            resetState();

            const volume_hover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    volume: 'hovered'
                }));
            }, 1.5 / relativeTotal * animDur);

            const volume_click = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    volume: 'clicked'
                }));
                setVolume(0);
            }, 1.8 / relativeTotal * animDur);

            const volume_click2 = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    volume: 'clicked'
                }));
                setVolume(1);
            }, 2.4 / relativeTotal * animDur);

            const volume_unhover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    volume: ''
                }));
            }, 3.1 / relativeTotal * animDur);

            let animFrameId: number;
            const slider_activate = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    slider: 'active'
                }));

                const startTime = performance.now();
                const animatePlaybackCursor = (currTime: number) => {

                    const elapsed = currTime - startTime;

                    const normalized = elapsed / playBackDur;
                    const progress = Math.min(1, Math.abs(1 - normalized));

                    setVolume(progress);

                    if (elapsed < playBackDur * 2) {
                        animFrameId = requestAnimationFrame(animatePlaybackCursor);
                    }
                }
                animFrameId = requestAnimationFrame(animatePlaybackCursor);

            }, 3.9 / relativeTotal * animDur);

            const slider_unactive = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    slider: 'inactive'
                }));
                setVolume(1);
            }, 5.6 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(volume_hover)
                clearTimeout(volume_click)
                clearTimeout(volume_click2)
                clearTimeout(volume_unhover)
                clearTimeout(slider_activate)
                clearTimeout(slider_unactive)
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

    const startingCursorFactors = { x: 0.6, y: 0.6 }

    return (
        <div
            className="instructions-container music-player-volume"
            style={{
                ['--moveDistX1' as any]: svgDimensions.w * (startingCursorFactors.x - 0.15),
                ['--moveDistY1' as any]: svgDimensions.h * (startingCursorFactors.y - 0.47),
                ['--moveDistX2' as any]: svgDimensions.w * (startingCursorFactors.x - 0.35),
                ['--moveDistY2' as any]: svgDimensions.h * (startingCursorFactors.y - 0.46),
                ['--moveDistX3' as any]: svgDimensions.w * (startingCursorFactors.x - 0.2),
                ['--moveDistY3' as any]: svgDimensions.h * (startingCursorFactors.y - 0.46),
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
                            <g className="scroll-group" key={`${svgDimensions.w}-${svgDimensions.h}`}>
                                <MockPlayerSvg
                                    startPos={{ x: svgDimensions.w / 2 - svgDimensions.w * 0.9 / 2, y: svgDimensions.h / 2.5 }}
                                    scaleW={svgDimensions.w * 0.9}
                                    alterableVals={{ volume }}
                                    buttonStates={playerButtonStates}
                                    setButtonStates={setPlayerButtonStates}
                                />
                                <CursorInstructionsDisplay
                                    dimensions={{
                                        x: svgDimensions.w * startingCursorFactors.x,
                                        y: svgDimensions.h * startingCursorFactors.y,
                                        size: svgDimensions.w / 20
                                    }}
                                />
                            </g>
                        </svg>
                    )
                }
            </div>
            <div className='description'>
                <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '8px' }}>
                    <li>Click on the speakerphone to toggle muted vs unmutted.</li>
                    <li>Then, use the slider for more precise volume control.</li>
                    <li style={{ fontSize: 'small' }}>Note: The volume controls only change the sound of your composition, not the volume of the metronome.</li>
                </ul>
            </div>
        </div >
    )
}