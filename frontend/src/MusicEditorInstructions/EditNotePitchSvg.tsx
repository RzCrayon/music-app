import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay } from "./MusicEditorInstructions";
import { MockPopupSvg } from "./MockPopupSvg";
import './EditNotePitchSvg.css'

export function EditNotePitchSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const measureAspectRatio = 2.5;
    const [measureSize, setMeasureSize] = useState({ w: 0, h: 0 })

    const [currPitch, setCurrPitch] = useState('B4');
    const [pitchOffsetRatio, setPitchOffsetRatio] = useState(0);

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
    const relativeTotal = 19.2;

    useEffect(() => {
        const resetState = () => {
            setCurrPitch('B4');
        };

        const runSequence = () => {
            resetState();

            const t1 = setTimeout(() => {
                setCurrPitch('C5');
                setPitchOffsetRatio(0.125)
            }, 5.2 / relativeTotal * animDur);
            const t2 = setTimeout(() => {
                setCurrPitch('D5')
                setPitchOffsetRatio(0.25)
            }, 5.8 / relativeTotal * animDur);
            const t3 = setTimeout(() => {
                setCurrPitch('C5');
                setPitchOffsetRatio(0.125)
            }, 14.9 / relativeTotal * animDur);
            const t4 = setTimeout(() => {
                setCurrPitch('B4');
                setPitchOffsetRatio(0);
            }, 15.5 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
                clearTimeout(t4);
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
            className="instructions-container edit-note-pitch"
            style={{
                ['--moveDistX1' as any]: measureSize.w * (startingCursorFactors.x - 0.48),
                ['--moveDistY1' as any]: measureSize.h * (startingCursorFactors.y - 0.48),
                ['--moveDistX2' as any]: measureSize.w * (startingCursorFactors.x + 0.1),
                ['--moveDistY2' as any]: measureSize.h * (startingCursorFactors.y - 4.5),
                ['--moveDistX3' as any]: measureSize.w * (startingCursorFactors.x + 0.1),
                ['--moveDistY3' as any]: measureSize.h * (startingCursorFactors.y - 5.2),
                ['--scrollDist' as any]: svgDimensions.h * 0.6,
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
                                transform={`translate(${(svgDimensions.w - measureSize.w) / 2}, ${measureSize.h / 2})`}
                            >
                                <g className="scroll-group" key={`${svgDimensions.w}-${svgDimensions.h}`}>                            <MeasureInstructionsDisplay
                                    measureSize={measureSize}
                                />
                                    <NoteInstructionsDisplay
                                        pos={{ x: measureSize.w * 0.5, y: measureSize.h * (0.5 - pitchOffsetRatio) }}
                                        fontSize={measureSize.w / 4}
                                        duration={1}
                                        flipped={pitchOffsetRatio > 0}
                                    />
                                    <MockPopupSvg
                                        startPos={{ x: (-(svgDimensions.w - measureSize.w) / 2) + (svgDimensions.w / 2 - measureSize.w * 1.68 / 2), y: measureSize.h + measureSize.h * 0.1 }}
                                        scaleW={measureSize.w * 1.68}
                                        alterableVals={{
                                            displayPitch: currPitch
                                        }}
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
                <p style={{ fontSize: 'medium' }}>
                    Click on any note.
                </p>
                {"Then, use the up / down icons under the Pitch section to increase and decrease the note's pitch."}
            </div>
        </div>
    )
}