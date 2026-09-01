
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows } from "./MusicEditorInstructions";
import './InstrumentPickerInstructions.css'

import { RiFileUploadLine } from "react-icons/ri";
import { instrumentPNGMap } from "../InstrumentPicker";
import { MockInstrumentPicker } from "./MockInstrumentPicker";

export function InstrumentPickerInstructions() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const rectAspectRatio = 1;
    const mockPickerAspectRatio = 1.75;
    const [rectSize, setrectSize] = useState({ w: 0, h: 0 })

    const [uploadButtonState, setUploadButtonState] = useState<'clicked' | 'hovered' | ''>('')
    const [showPicker, setShowPicker] = useState(false);
    const [hovered, setHovered] = useState(false);

    useLayoutEffect(() => {
        if (!svgContainerRef.current) return;

        const handleResize = () => {
            const w = svgContainerRef.current?.clientWidth ?? 0;
            const h = svgContainerRef.current?.clientHeight ?? 0;

            if (!w || !h) return;

            let targetW = Math.max(w * 0.5, 200 * rectAspectRatio);
            let targetH = targetW

            if (targetW > w * 0.9) {
                targetW = w * 0.9;
                targetH = targetW;
            }
            if (targetH > h * 0.9) {
                targetH = h * 0.9;
                targetW = targetH;
            }

            setSvgDimensions({ w, h });
            setrectSize({ w: targetW * 0.4, h: targetH * 0.4 });
        };

        handleResize();

        const observer = new ResizeObserver(handleResize);
        observer.observe(svgContainerRef.current);

        return () => observer.disconnect();
    }, []);

    const animDur = 6000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 5.2;

    useEffect(() => {
        const resetState = () => {
            setUploadButtonState('');
            setShowPicker(false);
            setHovered(false);
        };

        const runSequence = () => {
            resetState();

            const upload_hover = setTimeout(() => {
                setUploadButtonState('hovered')
            }, 1.2 / relativeTotal * animDur);

            const upload_click = setTimeout(() => {
                setUploadButtonState('clicked')
                setShowPicker(true);
            }, 1.8 / relativeTotal * animDur);

            //do it all in one step bc the upload img will show up 
            const upload_release_and_unhover = setTimeout(() => {
                setUploadButtonState('')
            }, 1.9 / relativeTotal * animDur);

            const hover_trumpet = setTimeout(() => {
                setHovered(true)
            }, 2.8 / relativeTotal * animDur);

            const unhover_trumpet = setTimeout(() => {
                setHovered(false)
            }, 3.7 / relativeTotal * animDur);

            const collapse_instruments = setTimeout(() => {
                setShowPicker(false);
            }, 5 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(upload_hover)
                clearTimeout(upload_click)
                clearTimeout(upload_release_and_unhover)
                clearTimeout(hover_trumpet)
                clearTimeout(unhover_trumpet)
                clearTimeout(collapse_instruments);
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

    const startingCursorFactors = { x: 0.95, y: 0.8 }

    return (
        <div
            className="instructions-container instrument-picker-instructions"
            style={{
                ['--moveDistX1' as any]: svgDimensions.w * (startingCursorFactors.x - 0.5),
                ['--moveDistY1' as any]: svgDimensions.w * (startingCursorFactors.y - 0.8),
                ['--moveDistX2' as any]: svgDimensions.w * (startingCursorFactors.x - 0.5),
                ['--moveDistY2' as any]: svgDimensions.w * (startingCursorFactors.y - 0.45),
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
                                <g
                                    transform={`translate(${svgDimensions.w / 2 - rectSize.w * 0.5}, ${svgDimensions.h * 0.95 - rectSize.h})`}
                                >
                                    <g className={`upload-button ${uploadButtonState}`}>
                                        <rect
                                            width={rectSize.w}
                                            height={rectSize.h}
                                            rx={rectSize.w / 8}
                                            filter="url(#drop-shadow-lighter)"
                                            fill="white"
                                        />
                                        <image
                                            width={rectSize.w * 0.8}
                                            height={rectSize.h * 0.8}
                                            x={0.1 * rectSize.w}
                                            y={0.1 * rectSize.h}
                                            href={`${instrumentPNGMap[0].img}`}
                                        />
                                    </g>
                                </g>
                                <MockInstrumentPicker
                                    open={showPicker}
                                    pos={{ x: svgDimensions.w / 2 - svgDimensions.h * 0.5 * mockPickerAspectRatio / 2, y: svgDimensions.h * 0.9 - rectSize.h - svgDimensions.h * 0.4 * 1.3 }}
                                    aspectRatio={mockPickerAspectRatio}
                                    scaleH={svgDimensions.h * 0.5}
                                    hovered={hovered}
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
                <div>
                    <p>
                        At the bottom left of the screen there's a button with an instrument. That's the instrument your song is currently being rendered in.
                    </p>
                    <p>To change the render instrument, click on the button and from popup select the instrument you'd like.</p>
                </div>
            </div>
        </div >
    )
}
