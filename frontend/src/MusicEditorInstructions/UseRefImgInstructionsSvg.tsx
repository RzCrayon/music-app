
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay, PlaybackCursorInstructionsDisplay } from "./MusicEditorInstructions";
import './UseRefImgInstructionsSvg.css'

import { RiFileUploadLine } from "react-icons/ri";
import { MockRefImgTab, type RefImgButtonStates } from "./MockRefImgTab";

export function EmptyRefImgSvg() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const rectAspectRatio = 1;
    const [rectSize, setrectSize] = useState({ w: 0, h: 0 })

    const [uploadButtonState, setUploadButtonState] = useState<'clicked' | 'hovered' | ''>('')
    const [showMockDir, setShowMockDir] = useState(false);

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
            setrectSize({ w: targetW * 0.6, h: targetH * 0.6 });
        };

        handleResize();

        const observer = new ResizeObserver(handleResize);
        observer.observe(svgContainerRef.current);

        return () => observer.disconnect();
    }, []);

    const animDur = 6000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 5;

    useEffect(() => {
        const resetState = () => {
            setUploadButtonState('');
            setShowMockDir(false);
        };

        const runSequence = () => {
            resetState();

            const upload_hover = setTimeout(() => {
                setUploadButtonState('hovered')
            }, 1.2 / relativeTotal * animDur);

            const upload_click = setTimeout(() => {
                setUploadButtonState('clicked')
                setShowMockDir(true);
            }, 1.8 / relativeTotal * animDur);

            //do it all in one step bc the upload img will show up 
            const upload_release_and_unhover = setTimeout(() => {
                setUploadButtonState('')
                setShowMockDir(true);
            }, 1.9 / relativeTotal * animDur);

            const cancel_click = setTimeout(() => {
                setShowMockDir(false);
            }, 3.8 / relativeTotal * animDur);

            // Return clear functions for cleanup
            return () => {
                clearTimeout(upload_hover)
                clearTimeout(upload_click)
                clearTimeout(upload_release_and_unhover)
                clearTimeout(cancel_click)
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
            className="instructions-container no-ref-img"
            style={{
                ['--moveDistX1' as any]: svgDimensions.w * (startingCursorFactors.x - 0.6),
                ['--moveDistY1' as any]: svgDimensions.w * (startingCursorFactors.y - 0.6),
                ['--moveDistX2' as any]: svgDimensions.w * (startingCursorFactors.x - 0.95),
                ['--moveDistY2' as any]: (svgDimensions.h * startingCursorFactors.y) - (svgDimensions.h / 2 + (svgDimensions.w * 0.55) * 0.47),
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
                                    transform={`translate(${svgDimensions.w / 2 - rectSize.w * 0.5}, ${svgDimensions.h / 2 - rectSize.h * 0.5})`}
                                >
                                    <g className={`upload-button ${uploadButtonState}`}>
                                        <rect
                                            width={rectSize.w}
                                            height={rectSize.h}
                                            rx={rectSize.w / 8}
                                            filter="url(#drop-shadow)"
                                        />
                                        <RiFileUploadLine
                                            x={rectSize.w / 2 - rectSize.w * 0.3}
                                            y={rectSize.h / 2 - rectSize.h * 0.3}
                                            size={rectSize.w * 0.6}
                                        />
                                    </g>
                                </g>
                                <image
                                    className={`mock-file-input ${showMockDir ? 'open' : ''}`}
                                    href="mock_file_dir.png"
                                    width={svgDimensions.w * 2 * 0.5}
                                    height={svgDimensions.w * 0.55}
                                    x={svgDimensions.w / 2 - (svgDimensions.w * 2 * 0.5) / 2}
                                    y={svgDimensions.h / 2 - (svgDimensions.w * 0.55) / 2}
                                    preserveAspectRatio="none"
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
                        Click on the upload button at the bottom left of your screen.
                    </p>
                    <p>Then select any PNG or JPG from your files to use as a reference.</p>
                </div>
            </div>
        </div >
    )
}


export function SelectedRefImgInstructions() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const rectAspectRatio = 1;
    const [rectSize, setrectSize] = useState({ w: 0, h: 0 })

    const [uploadButtonState, setUploadButtonState] = useState<'clicked' | 'hovered' | ''>('')
    const [showRefImgTab, setShowRefImgTab] = useState(false);
    const [showMockDir, setShowMockDir] = useState(false);
    const [buttonStates, setButtonStates] = useState<RefImgButtonStates>({
        close: '',
        upload: '',
        expand: '',
        shrink: '',
    })
    const [refImgScale, setRefImgScale] = useState(1);

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
            setrectSize({ w: targetW * 0.6, h: targetH * 0.6 });
        };

        handleResize();

        const observer = new ResizeObserver(handleResize);
        observer.observe(svgContainerRef.current);

        return () => observer.disconnect();
    }, []);

    const animDur = 12000;
    //total len of the animDur as mapped out in the keyframes
    const relativeTotal = 12.2;
    // const playBackDur = 0.71 / relativeTotal * animDur

    useEffect(() => {
        const resetState = () => {
            setUploadButtonState('');
            setShowMockDir(false);
            setShowRefImgTab(false);
            setButtonStates({
                close: '',
                upload: '',
                expand: '',
                shrink: '',
            })
            setRefImgScale(1);
        };

        const runSequence = () => {
            resetState();

            const upload_hover = setTimeout(() => {
                setUploadButtonState('hovered')
            }, 1.2 / relativeTotal * animDur);

            const upload_click = setTimeout(() => {
                setUploadButtonState('clicked')
                setShowRefImgTab(true);
            }, 1.8 / relativeTotal * animDur);

            //do it all in one step bc the upload img will show up 
            const upload_release_and_unhover = setTimeout(() => {
                setUploadButtonState('')
            }, 1.9 / relativeTotal * animDur);

            const expand_hover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    expand: 'hovered'
                }))
            }, 2.6 / relativeTotal * animDur)
            const expand_click = setTimeout(() => {
                setRefImgScale(1.25);
            }, 3 / relativeTotal * animDur);
            const expand_unhover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    expand: ''
                }))
            }, 3.5 / relativeTotal * animDur)

            const shrink_hover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    shrink: 'hovered'
                }))
            }, 3.6 / relativeTotal * animDur)
            const shrink_click = setTimeout(() => {
                setRefImgScale(1);
            }, 4.1 / relativeTotal * animDur);
            const shrink_unhover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    shrink: ''
                }))
            }, 4.6 / relativeTotal * animDur)

            const upload_tab_hover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    upload: 'hovered'
                }))
            }, 5.3 / relativeTotal * animDur)
            const upload_tab_click = setTimeout(() => {
                setShowMockDir(true);
            }, 5.7 / relativeTotal * animDur);

            const cancel_click = setTimeout(() => {
                setShowMockDir(false);
                setButtonStates(prev => ({
                    ...prev,
                    upload: ''
                }))
            }, 8.2 / relativeTotal * animDur);

            const close_hover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    close: 'hovered'
                }))
            }, 9.8 / relativeTotal * animDur)
            const close_click = setTimeout(() => {
                setShowRefImgTab(false);
            }, 10.3 / relativeTotal * animDur);
            const close_unhover = setTimeout(() => {
                setButtonStates(prev => ({
                    ...prev,
                    close: ''
                }))
            }, 10.6 / relativeTotal * animDur)

            // Return clear functions for cleanup
            return () => {
                clearTimeout(upload_hover)
                clearTimeout(upload_click)
                clearTimeout(upload_release_and_unhover)
                clearTimeout(expand_click)
                clearTimeout(shrink_click)
                clearTimeout(upload_tab_click)
                clearTimeout(cancel_click)
                clearTimeout(close_click)
                clearTimeout(expand_hover);
                clearTimeout(expand_unhover);
                clearTimeout(shrink_hover);
                clearTimeout(shrink_unhover);
                clearTimeout(upload_tab_hover);
                clearTimeout(close_hover);
                clearTimeout(close_unhover)
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
    const startingCursorFactors = { x: 0.8, y: 0.8 }

    return (
        <div
            className="instructions-container ref-img"
            style={{
                ['--moveDistX1' as any]: svgDimensions.w * (startingCursorFactors.x - 0.6),
                ['--moveDistY1' as any]: svgDimensions.w * (startingCursorFactors.y - 0.6),
                ['--moveDistX2' as any]: svgDimensions.w * (startingCursorFactors.x - 0.5),
                ['--moveDistY2' as any]: svgDimensions.w * (startingCursorFactors.y - 0.86),
                ['--moveDistX3' as any]: svgDimensions.w * (startingCursorFactors.x - 0.67),
                ['--moveDistY3' as any]: svgDimensions.w * (startingCursorFactors.y - 0.85),
                ['--moveDistX4' as any]: svgDimensions.w * (startingCursorFactors.x - 0.32),
                ['--moveDistY4' as any]: svgDimensions.w * (startingCursorFactors.y - 0.85),
                ['--moveDistX5' as any]: svgDimensions.w * (startingCursorFactors.x - 0.95),
                ['--moveDistY5' as any]: (svgDimensions.h * startingCursorFactors.y) - (svgDimensions.h / 2 + (svgDimensions.w * 0.55) * 0.47),
                ['--moveDistX6' as any]: svgDimensions.w * (startingCursorFactors.x - 0.67),
                ['--moveDistY6' as any]: svgDimensions.w * (startingCursorFactors.y - 0.3),
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
                                    transform={`translate(${svgDimensions.w / 2 - rectSize.w * 0.5}, ${svgDimensions.h / 2 - rectSize.h * 0.5})`}
                                >
                                    <g className={`upload-button ${showRefImgTab ? 'hidden' : ''} ${uploadButtonState}`}>
                                        <defs>
                                            <clipPath id="rounded-clip">
                                                <rect
                                                    width={rectSize.w}
                                                    height={rectSize.h}
                                                    rx={rectSize.w / 8}
                                                />
                                            </clipPath>
                                        </defs>
                                        <image
                                            className={`upload-button ${uploadButtonState}`}
                                            width={rectSize.w}
                                            height={rectSize.h}
                                            filter="url(#drop-shadow)"
                                            href="sample_song.svg"
                                            preserveAspectRatio="xMidYMid slice"
                                            clipPath="url(#rounded-clip)"
                                        />
                                    </g>
                                </g>
                                <MockRefImgTab
                                    scaleH={svgDimensions.h}
                                    pos={{
                                        x: -svgDimensions.w / 2,
                                        y: -svgDimensions.h / 2
                                    }}
                                    open={showRefImgTab}
                                    buttonStates={buttonStates}
                                    setButtonStates={setButtonStates}
                                    alterableVals={{ refImgScale }}
                                />
                                <image
                                    className={`mock-file-input ${showMockDir ? 'open' : ''}`}
                                    href="mock_file_dir.png"
                                    width={svgDimensions.w * 2 * 0.5}
                                    height={svgDimensions.w * 0.55}
                                    x={svgDimensions.w / 2 - (svgDimensions.w * 2 * 0.5) / 2}
                                    y={svgDimensions.h / 2 - (svgDimensions.w * 0.55) / 2}
                                    preserveAspectRatio="none"
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
                        Click on the your reference image icon at the bottom left of your screen to bring up the reference image tab.
                    </p>
                    <ul style={{ fontSize: 'small' }}>
                        <li>Use the zoom buttons to make the image larger or smaller.</li>
                        <li>Drag on the image to move it around</li>
                        <li>Use the upload button to change the reference image.</li>
                        <li>Press the X to close the reference image tab.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}