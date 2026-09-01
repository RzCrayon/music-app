
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows } from "./MusicEditorInstructions";
import './MusicPlayerMetronomeInstructionsSvg.css'
import { type ButtonStates, MockPlayerSvg } from "./MockPlayerSvg";

export function MusicPlayerMetronomeSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });

    const [playerButtonStates, setPlayerButtonStates] = useState<ButtonStates>({
        volume: '',
        slider: 'inactive',
        restart: '',
        rewind: '',
        forward: '',
        metronome: '',
        pause: '',
    })
    const [metronome, setMetronome] = useState(false);

    useLayoutEffect(() => {
        if (!svgContainerRef.current) return;

        const handleResize = () => {
            const w = svgContainerRef.current?.clientWidth ?? 0;
            const h = svgContainerRef.current?.clientHeight ?? 0;

            if (!w || !h) return;

            setSvgDimensions({ w, h });
        };

        handleResize();

        const observer = new ResizeObserver(handleResize);
        observer.observe(svgContainerRef.current);

        return () => observer.disconnect();
    }, []);

    const animDur = 4000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 3.6;

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
            setMetronome(false);
        };

        const runSequence = () => {
            resetState();

            const metronome_hover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    metronome: 'hovered'
                }));
            }, 1 / relativeTotal * animDur);

            const metronome_on = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    metronome: 'clicked'
                }));
                setMetronome(true);
            }, 1.3 / relativeTotal * animDur);

            const metronome_off = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    metronome: 'clicked'
                }));
                setMetronome(false);
            }, 2.1 / relativeTotal * animDur);

            const metronome_unhover = setTimeout(() => {
                setPlayerButtonStates(prev => ({
                    ...prev,
                    metronome: ''
                }));
            }, 2.5 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(metronome_hover)
                clearTimeout(metronome_on)
                clearTimeout(metronome_off)
                clearTimeout(metronome_unhover)
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
            className="instructions-container music-player-metronome"
            style={{
                ['--moveDistX1' as any]: svgDimensions.w * (startingCursorFactors.x - 0.85),
                ['--moveDistY1' as any]: svgDimensions.h * (startingCursorFactors.y - 0.47),
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
                                    buttonStates={playerButtonStates}
                                    setButtonStates={setPlayerButtonStates}
                                    alterableVals={{ metronome }}
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
                Click on the metronome button to toggle the metronome on and off.
            </div>
        </div >
    )
}