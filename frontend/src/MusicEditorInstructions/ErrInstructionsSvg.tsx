
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows } from "./MusicEditorInstructions";
import './ErrInstructionsSvg.css'

import { TfiSave } from "react-icons/tfi";
import { AiOutlineExclamationCircle } from "react-icons/ai";
import { MockToaster } from "./MockToasters";

export function DealingWithErrsSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const rectAspectRatio = 2.7;
    const rectAspectRatio2 = 1;
    const [rectSize, setRectSize] = useState({ w: 0, h: 0 })
    //warning button
    const [rectSize2, setRectSize2] = useState({ w: 0, h: 0 });
    const widthScaleUpRatio = 4;
    const rectSize2Ref = useRef(rectSize2);

    const [warningButtonState, setWarningButtonState] = useState<'hovered' | 'clicked' | ''>('');
    const [addButtonState, setAddButtonState] = useState<'hovered' | 'clicked' | ''>('');
    const [toasterCount, setToasterCount] = useState(0);
    const [lastToasterButtonState, setLastToasterButtonState] = useState<'hovered' | 'clicked' | ''>('');

    useEffect(() => { rectSize2Ref.current = rectSize2; }, [rectSize2]);

    useEffect(() => {
        if (!svgContainerRef.current) return;
        const handleResize = () => {
            const w = svgContainerRef.current?.clientWidth ?? 0;
            const h = svgContainerRef.current?.clientHeight ?? 0;

            if (!w || !h) return;

            let targetW = Math.max(w * 0.5, 200 * rectAspectRatio);
            let targetH = targetW / rectAspectRatio;

            let targetW2 = Math.max(w * 0.5, 200 * rectAspectRatio);
            let targetH2 = targetW / rectAspectRatio;

            if (targetW > w * 0.9) {
                targetW = w * 0.9;
                targetH = targetW / rectAspectRatio;
            }
            if (targetH > h * 0.9) {
                targetH = h * 0.9;
                targetW = targetH * rectAspectRatio;
            }

            if (targetW2 > w * 0.9) {
                targetW2 = w * 0.9;
                targetH2 = targetW2 / rectAspectRatio2;
            }
            if (targetH2 > h * 0.9) {
                targetH2 = h * 0.9;
                targetW2 = targetH2 * rectAspectRatio2;
            }

            setSvgDimensions({ w, h });
            setRectSize({ w: targetW * 0.6, h: targetH * 0.6 });
            setRectSize2({ w: targetW2 * 0.23, h: targetH2 * 0.23 });
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [])

    const animDur = 6000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 9.4;

    useEffect(() => {
        const resetState = () => {
            setAddButtonState('');
            setWarningButtonState('');
            setToasterCount(0);
            setLastToasterButtonState('');
        };

        //duration in ms
        //linear interpolation
        const animateWidth = (startW: number, targetW: number, duration: number) => {
            const startTime = performance.now();

            const step = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const currentW = startW + (targetW - startW) * progress;
                setRectSize2(prev => ({ ...prev, w: currentW }));
                if (progress < 1) requestAnimationFrame(step);
            };

            requestAnimationFrame(step);
        };

        const runSequence = () => {
            resetState();

            const warning_hover = setTimeout(() => {
                setWarningButtonState('hovered')
                const currentH = rectSize2Ref.current.h;
                animateWidth(currentH, currentH * widthScaleUpRatio, 200);
            }, 1.2 / relativeTotal * animDur);

            //do it all in one step bc the upload img will show up 
            const warning_unhover = setTimeout(() => {
                setWarningButtonState('')
                const currentH = rectSize2Ref.current.h;
                animateWidth(currentH * widthScaleUpRatio, currentH, 200);
            }, 3.6 / relativeTotal * animDur);

            const add_hover = setTimeout(() => {
                setAddButtonState('hovered')
            }, 4.0 / relativeTotal * animDur);

            const add_click = setTimeout(() => {
                setAddButtonState('clicked')
                setToasterCount(3);
            }, 4.8 / relativeTotal * animDur);

            const add_hover2 = setTimeout(() => {
                setAddButtonState('hovered')
            }, 4.9 / relativeTotal * animDur);

            const add_unhover = setTimeout(() => {
                setAddButtonState('');
            }, 5.7 / relativeTotal * animDur);

            const delete_hover = setTimeout(() => {
                setLastToasterButtonState('hovered')
            }, 5.6 / relativeTotal * animDur);

            const delete1 = setTimeout(() => {
                setToasterCount(2)
            }, 6.2 / relativeTotal * animDur);

            const delete2 = setTimeout(() => {
                setToasterCount(1)
            }, 6.9 / relativeTotal * animDur);

            const delete3 = setTimeout(() => {
                setToasterCount(0)
            }, 7.6 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(warning_hover)
                clearTimeout(warning_unhover)
                clearTimeout(add_hover)
                clearTimeout(add_hover2)
                clearTimeout(add_click)
                clearTimeout(add_unhover)
                clearTimeout(delete_hover)
                clearTimeout(delete1)
                clearTimeout(delete2)
                clearTimeout(delete3)
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
            className="instructions-container dealing-with-errs"
            style={{
                ['--moveDistX1' as any]: svgDimensions.w * (startingCursorFactors.x - 0.7),
                ['--moveDistY1' as any]: svgDimensions.w * (startingCursorFactors.y - 0.55),
                ['--moveDistX2' as any]: svgDimensions.w * (startingCursorFactors.x - 0.6),
                ['--moveDistY2' as any]: svgDimensions.w * (startingCursorFactors.y - 0.8),
                ['--moveDistX3' as any]: svgDimensions.w * (startingCursorFactors.x - 0.8),
                ['--moveDistY3' as any]: svgDimensions.w * (startingCursorFactors.y - 0.83),
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
                            <defs>
                                <clipPath id='warning-button-clip'>
                                    <rect
                                        width={rectSize2.w}
                                        height={rectSize2.h}
                                        rx={rectSize2.h / 2}
                                    />
                                </clipPath>
                            </defs>
                            <DropShadows />
                            <g className="scroll-group" key={`${svgDimensions.w}-${svgDimensions.h}`}>
                                <g
                                    transform={`translate(
                                        ${svgDimensions.w / 2 + rectSize.w / 2 - rectSize2.w}, 
                                        ${svgDimensions.h * 0.95 - rectSize.h - svgDimensions.h * 0.15 - rectSize2.h}
                                    )`}
                                >
                                    <g className={`warning-button ${warningButtonState}`}>
                                        <rect
                                            width={rectSize2.w}
                                            height={rectSize2.h}
                                            rx={rectSize2.h / 2}
                                            filter="url(#drop-shadow)"
                                            fill="var(--err-colour)"
                                        />
                                        <AiOutlineExclamationCircle
                                            x={rectSize2.h / 2 - rectSize2.h / 5}
                                            y={rectSize2.h / 2 - rectSize2.h / 5}
                                            size={rectSize2.h / 2.5}
                                            style={{
                                                fill: "var(--primary-text)"
                                            }}
                                        />
                                        <g
                                            clipPath="url(#warning-button-clip)"
                                            style={{
                                                opacity: warningButtonState === 'hovered' ? 1 : 0,
                                                transition: 'opacity 0.2s ease'
                                            }}
                                        >
                                            <g transform={`translate(${rectSize2.h * 0.9} ${rectSize2.h / 2 + rectSize2.h / 16})`}>
                                                <text
                                                    y={-rectSize2.h / 8}
                                                    fontSize={rectSize2.h / 5}
                                                    fill="var(--primary-text)"
                                                >
                                                    Issues exist in sheetmusic
                                                </text>
                                                <text
                                                    y={rectSize2.h / 8}
                                                    fontSize={rectSize2.h / 7}
                                                    fill="var(--primary-text)"
                                                >
                                                    Click to take me there
                                                </text>
                                            </g>
                                        </g>
                                    </g>
                                </g>
                                <g
                                    transform={`translate(${svgDimensions.w / 2 - rectSize.w * 0.5}, ${svgDimensions.h * 0.95 - rectSize.h})`}
                                >
                                    <g className={`add-button ${addButtonState}`}>
                                        <rect
                                            width={rectSize.w}
                                            height={rectSize.h}
                                            rx={rectSize.w / 13}
                                            filter="url(#drop-shadow)"
                                            fill="var(--err-colour)"
                                        />
                                        <text
                                            transform={`translate(${rectSize.w / 2 + rectSize.w * 0.05}, ${rectSize.h / 2})`}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fill='var(--primary-text)'
                                        >
                                            Add Song
                                        </text>
                                        <TfiSave
                                            x={rectSize.w / 2 - rectSize.w / 20 - rectSize.w / 3 / 2 - rectSize.w * 0.05}
                                            y={rectSize.h / 2 - rectSize.w / 17}
                                            size={rectSize.w / 10}
                                            style={{
                                                fill: "var(--primary-text)"
                                            }}
                                        />
                                    </g>
                                </g>
                                <MockToaster
                                    toasterCount={toasterCount}
                                    setToasterCount={setToasterCount}
                                    lastToasterButtonState={lastToasterButtonState}
                                    scaleH={0.2 * svgDimensions.h}
                                    pos={{
                                        x: svgDimensions.w / 2 + rectSize.w / 2,
                                        y: svgDimensions.h * 0.95
                                    }}
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
                    <p>If there are errors in your song and you can't find them, click on the red exclamation mark in the bottom right to take you to the closest one.</p>
                    <p>If you don't understand why a note might be marked as an error, click the Add Song button to get more information about specific errors.</p>
                </div>
            </div>
        </div >
    )
}
