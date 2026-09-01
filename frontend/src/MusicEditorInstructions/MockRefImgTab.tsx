import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { DropShadows } from "./MusicEditorInstructions";
import { IoIosClose } from "react-icons/io";
import './MockRefImgTab.css'

import { RiFileUploadLine } from "react-icons/ri";
import { PiMagnifyingGlassBold } from "react-icons/pi";
import { FaMinus, FaPlus } from "react-icons/fa6";

type ButtonState = 'hovered' | 'clicked' | ''
export type RefImgButtonStates = {
    close: ButtonState,
    upload: ButtonState,
    shrink: ButtonState,
    expand: ButtonState,
};

const borderPaddingRatio = 0.03;
const buttonSizeRatio = 0.12

export function MockRefImgTab({
    open,
    pos,
    buttonStates,
    setButtonStates,
    scaleH,
    alterableVals,
}: {
    open: boolean
    pos: { x: number, y: number }
    buttonStates: RefImgButtonStates
    setButtonStates: Dispatch<SetStateAction<RefImgButtonStates>>
    scaleH: number,
    alterableVals?: {
        refImgScale?: number
    }
}) {

    const aspectRatio = 0.7;
    const width = scaleH * aspectRatio;
    const fontSize = scaleH * 0.04;

    const refImgSpace = {
        w: (width - scaleH * borderPaddingRatio * 2),
        h: ((1 - (2 * buttonSizeRatio + 4 * borderPaddingRatio)) * scaleH)
    }

    useEffect(() => {
        if (buttonStates.close === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, close: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.close]);
    useEffect(() => {
        if (buttonStates.upload === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, upload: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.upload]);
    useEffect(() => {
        if (buttonStates.shrink === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, shrink: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.shrink]);
    useEffect(() => {
        if (buttonStates.expand === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, expand: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.expand]);

    const refImgScale = useMemo(() => alterableVals?.refImgScale ?? 1, [alterableVals?.refImgScale])

    return (
        < svg
            viewBox={`${pos.x} ${pos.y} ${width} ${scaleH}`}
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            width={width}
            height={scaleH}
        >
            <DropShadows />
            <defs>
                <clipPath id="ref-img-clip">
                    <rect
                        x={0}
                        y={0}
                        width={refImgSpace.w}
                        height={refImgSpace.h}
                    />
                </clipPath>
                <clipPath id="rounded-image-clip">
                    <rect
                        x={refImgSpace.w * 0.05}
                        y={refImgSpace.w * 0.05}
                        width={(refImgSpace.w * 0.9) * refImgScale}
                        height={(refImgSpace.w * 0.9) * refImgScale * 1.5}
                        rx={refImgSpace.w / 20}
                    />
                </clipPath>
            </defs>
            <g
                className={`mock-ref-img-tab ${open ? 'open' : ''}`}
                transform={`translate(${-width / 2} ${-scaleH / 2})`}
            >
                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={scaleH}
                    fill='rgba(200, 200, 200, 0.75)'
                />
                <text
                    transform={`translate(
                        ${borderPaddingRatio * 2 * scaleH}, 
                        ${borderPaddingRatio * scaleH + buttonSizeRatio * scaleH / 2}
                    )`}
                    fill='rgba(0, 0, 0, 0.7)'
                    fontSize={fontSize}
                    dominantBaseline="central"
                >
                    sample_song.png
                </text>

                <g
                    transform={`translate(
                        ${(1 - borderPaddingRatio / aspectRatio) * width},
                        ${borderPaddingRatio * scaleH}
                    )`}
                >
                    <g className={`mock-ref-img-button ${buttonStates.close}`}>
                        <rect
                            x={-buttonSizeRatio * scaleH}
                            y={0}
                            fill='rgba(0, 0, 0, 0.7)'
                            width={buttonSizeRatio * scaleH}
                            height={buttonSizeRatio * scaleH}
                            rx={buttonSizeRatio * scaleH / 2}
                        />
                        <IoIosClose
                            x={-buttonSizeRatio * scaleH + buttonSizeRatio * scaleH / 2 - fontSize * 2 / 2}
                            y={buttonSizeRatio * scaleH / 2 - fontSize * 2 / 2}
                            size={fontSize * 2}
                        />
                    </g>
                </g>

                <g
                    transform={`translate(
                        ${borderPaddingRatio * scaleH}, 
                        ${borderPaddingRatio * scaleH}
                    )`}
                >
                    <g
                        transform={`translate(0, ${(buttonSizeRatio + borderPaddingRatio) * scaleH})`}
                        style={{ transformOrigin: `${refImgSpace.w * 0.05}px ${refImgSpace.w * 0.05}px` }}
                        clipPath="url(#ref-img-clip)"
                    >
                        <g clipPath="url(#ref-img-clip)">
                            <rect
                                x={refImgSpace.w * 0.05}
                                y={refImgSpace.w * 0.05}
                                width={(refImgSpace.w * 0.9) * refImgScale}
                                height={(refImgSpace.w * 0.9) * refImgScale * 1.5}
                                rx={refImgSpace.w / 20}
                                filter="url(#drop-shadow-light)"
                                fill="white"
                            />
                            <image
                                x={refImgSpace.w * 0.05}
                                y={refImgSpace.w * 0.05}
                                width={(refImgSpace.w * 0.9) * refImgScale}
                                height={(refImgSpace.w * 0.9) * refImgScale * 1.5}
                                clipPath="url(#rounded-image-clip)"
                                href="sample_song.svg"
                            />
                        </g>
                    </g>
                </g>

                <g
                    transform={`translate(
                        ${(borderPaddingRatio / aspectRatio) * width},
                        ${(1 - borderPaddingRatio) * scaleH}
                    )`}
                >
                    <g className={`mock-ref-img-button  ${buttonStates.upload}`}>

                        <rect
                            x={0}
                            y={-buttonSizeRatio * scaleH}
                            fill='rgba(0, 0, 0, 0.7)'
                            width={buttonSizeRatio * scaleH}
                            height={buttonSizeRatio * scaleH}
                            rx={buttonSizeRatio * scaleH / 2}
                        />
                        <RiFileUploadLine
                            x={buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                            y={-buttonSizeRatio * scaleH + buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                            size={fontSize * 1.5}
                        />
                    </g>
                </g>

                <g
                    transform={`translate(
                        ${(1 - borderPaddingRatio / aspectRatio) * width},
                        ${(1 - borderPaddingRatio) * scaleH}
                    )`}
                >
                    <g className={`mock-ref-img-button`}>
                        <rect
                            x={-buttonSizeRatio * scaleH * 4}
                            y={-buttonSizeRatio * scaleH}
                            fill='rgba(0, 0, 0, 0.7)'
                            width={buttonSizeRatio * scaleH * 4}
                            height={buttonSizeRatio * scaleH}
                            rx={buttonSizeRatio * scaleH / 2}
                        />
                        <PiMagnifyingGlassBold
                            x={-buttonSizeRatio * scaleH * 4 + buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                            y={-buttonSizeRatio * scaleH + buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                            size={fontSize * 1.5}
                        />
                        <g
                            transform={`translate(${-buttonSizeRatio * scaleH * 3 + buttonSizeRatio * scaleH / 4 - fontSize * 1.5 / 2}, ${-buttonSizeRatio * scaleH + buttonSizeRatio * scaleH / 4 - fontSize * 1.5 / 2})`}
                        >
                            <g
                                className={`mock-ref-img-button ${buttonStates.shrink}`}
                            >
                                <FaMinus
                                    x={buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                                    y={buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                                    size={fontSize * 1.5}
                                />
                            </g>
                        </g>
                        <text
                            x={-buttonSizeRatio * scaleH * 2.2 + buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                            y={-buttonSizeRatio * scaleH + buttonSizeRatio * scaleH / 1.3 - fontSize * 1.5 / 2}
                            fontSize={fontSize}
                            dominantBaseline="central"
                        >
                            {`${refImgScale * 100}%`}
                        </text>
                        <g
                            transform={`translate(${-buttonSizeRatio * scaleH * 1 + buttonSizeRatio * scaleH / 4 - fontSize * 1.5 / 2}, ${-buttonSizeRatio * scaleH + buttonSizeRatio * scaleH / 4 - fontSize * 1.5 / 2})`}
                        >
                            <g
                                className={`mock-ref-img-button ${buttonStates.expand}`}
                            >
                                <FaPlus
                                    x={buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                                    y={buttonSizeRatio * scaleH / 2 - fontSize * 1.5 / 2}
                                    size={fontSize * 1.5}
                                />
                            </g>
                        </g>
                    </g>
                </g>
            </g>
        </svg >
    )

}