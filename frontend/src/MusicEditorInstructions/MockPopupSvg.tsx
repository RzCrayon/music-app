import { useEffect, useState } from "react";
import './MockPopupSvg.css'
import { FaCaretDown, FaTrash } from "react-icons/fa6";
import { DropShadows } from "./MusicEditorInstructions";
import { HiMinus, HiPlus } from "react-icons/hi2";
import React from "react";
import { IoIosArrowDown, IoIosArrowUp, IoIosSettings, IoMdCheckmark } from "react-icons/io";
import { snap_to_valid_dur } from "../SheetMusic/sheetmusic_processor";

//all scales in terms of scaleW
const FIRST_ROW_BUTTON_SIZE_RATIOS = {
    addLeftButton: { w: 0.28, h: 0.14 },
    addRightButton: { w: 0.28, h: 0.14 },
    deleteButton: { w: 0.14, h: 0.14 },
    firstRowGaps: { w: 0.05, h: 0.08 },
}
const SECOND_ROW_BUTTON_SIZE_RATIOS = {
    boundingRect: { w: 0.8, h: 0.11 },
    buttonGroupRect: { w: 0.35, h: 0.1 },
    buttonSize: { w: 0.1, h: 0.1 }
}
const THIRD_ROW_SIZE_RATIOS = {
    indentPadding: { w: 0.05, h: 0.04 },
    boundingRect: { w: 0.725, h: 0.07 },
    buttonSize: { w: 0.07, h: 0.07 }
}
const PITCH_CONTROL_SIZE_RATIOS = {
    indentPadding: { w: 0, h: 0.08 },
    boundingRect: { w: 0.08, h: 0.27 },
    buttonSize: { w: 0.08, h: 0.08 },
}
const TYPE_CONTROL_SIZE_RATIOS = {
    indentPadding: { w: 0.02, h: 0.02 },
    buttonSize: { w: 0.12, h: 0.12 }
}
const ADVANCED_CONTROL_SIZE_RATIOS = {
    indentPadding: { w: 0.03, h: 0.04 },
    buttonSize: { w: 0.04, h: 0.04 }
}
const PADDING_RATIO = 0.1;

export type AlterableVals = {
    duration?: number,
    dotted?: boolean,
    displayPitch?: string,
    typeMatrix?: {
        sharp: 'selected' | 'disabled' | 'not-selected',
        flat: 'selected' | 'disabled' | 'not-selected'
        natural: 'selected' | 'disabled' | 'not-selected'
        rest: 'selected' | 'disabled' | 'not-selected'
    }
    advancedOptions?: {
        extraChord: boolean,
        extraVoice: boolean,
        voiceNumber: number,
    }
}

export function MockPopupSvg({
    scaleW,
    startPos,
    alterableVals,
}: {
    scaleW: number
    startPos: { x: number, y: number }
    alterableVals?: AlterableVals
}) {

    const aspectRatio = 1.23;
    const height = scaleW * aspectRatio;
    const fontSize = FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.w * scaleW * 0.2;

    return (
        <svg
            viewBox={`0 0 ${scaleW} ${height}`}
            className="mock-popup-container"
            width={scaleW}
            height={height}
        >
            <DropShadows />
            <g
                transform={`translate(${startPos.x} ${startPos.y})`}
            >
                <g filter="url(#drop-shadow)">
                    <rect
                        x={0}
                        y={0}
                        width={scaleW}
                        height={height}
                        rx={scaleW * 0.05}
                        fill="var(--tertiary-accent)"
                    />
                    <polygon
                        points={`
                            ${scaleW * 0.45},${1}
                            ${scaleW * 0.5},${-scaleW * 0.05}
                            ${scaleW * 0.55},${1}
                        `}
                        fill="var(--tertiary-accent)"
                    />
                </g>
                <FirstRowButtons scaleW={scaleW} fontSize={fontSize} />
                <SecondRowButtons scaleW={scaleW} fontSize={fontSize * 1.6} duration={alterableVals?.duration} />
                <ThirdRowButtons scaleW={scaleW} fontSize={fontSize * 1.3} dotted={alterableVals?.dotted} />
                <PitchControlButtons scaleW={scaleW} fontSize={fontSize * 1.6} displayPitch={alterableVals?.displayPitch} />
                <NoteTypeButtons scaleW={scaleW} fontSize={fontSize * 2.5} typeMatrix={alterableVals?.typeMatrix} />
                <AdvancedOptionsButtons scaleW={scaleW} fontSize={fontSize * 1.6} advancedOptionsAlterableVals={alterableVals?.advancedOptions} />
            </g>
        </svg>
    )
}

const FirstRowButtons = React.memo(function FirstRowButtons({
    scaleW,
    fontSize,
}: {
    scaleW: number,
    fontSize: number
}) {
    return (
        <>
            <DropShadows />
            <g
                transform={`translate(${PADDING_RATIO * scaleW} ${PADDING_RATIO * scaleW})`}
                className="button-type1"
            >
                <g className="mock-add-left">
                    <rect
                        width={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.w}
                        height={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h}
                        fill="var(--primary-text)"
                        rx={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.w * 0.3}
                        filter="url(#drop-shadow-light)"
                    />
                    <text
                        x={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.w / 2}
                        y={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h / 2}
                        fontSize={`${fontSize}px`}
                    >
                        Add Left
                    </text>
                </g>
            </g>
            <g
                transform={`translate(${(PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.w + FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.w) * scaleW} ${PADDING_RATIO * scaleW})`}
                className="button-type1"
            >
                <g className="mock-add-right">
                    <rect
                        width={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addRightButton.w}
                        height={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addRightButton.h}
                        fill="var(--primary-text)"
                        rx={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.w * 0.3}
                        filter="url(#drop-shadow-light)"
                    />
                    <text
                        x={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addRightButton.w / 2}
                        y={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.addRightButton.h / 2}
                        fontSize={`${fontSize}px`}
                    >
                        Add Right
                    </text>
                </g>
            </g>
            <g
                transform={`translate(${(PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.w + FIRST_ROW_BUTTON_SIZE_RATIOS.addRightButton.w + 2 * FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.w) * scaleW} ${PADDING_RATIO * scaleW})`}
                className="button-type1"
            >
                <rect
                    width={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.w}
                    height={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.h}
                    fill="var(--primary-text)"
                    rx={scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.w * 0.3}
                    filter="url(#drop-shadow-light)"
                />
                <FaTrash
                    size={`${fontSize * 2}px`}
                    style={{
                        fill: 'var(--tertiary-text)',
                        transform: `translate(${scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.w / 2 - fontSize}px, ${scaleW * FIRST_ROW_BUTTON_SIZE_RATIOS.deleteButton.h / 2 - fontSize}px)`
                    }}
                />
            </g>
        </>
    )
})

const SecondRowButtons = React.memo(function SecondRowButtons({
    scaleW,
    fontSize,
    duration,
}: {
    scaleW: number,
    fontSize: number,
    duration?: number,
}) {
    return (
        <g
            transform={`translate(${PADDING_RATIO * scaleW} ${scaleW * (PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h + FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.h)})`}
            className="button-type2"
        >
            <text
                x={0}
                y={scaleW * (SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.h / 2)}
                fontSize={`${fontSize}px`}
                style={{ textAnchor: 'start' }}
            >
                Duration:
            </text>
            <g
                transform={`translate(${scaleW * (SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.w - SECOND_ROW_BUTTON_SIZE_RATIOS.buttonGroupRect.w)} ${scaleW * (SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.h / 2 - SECOND_ROW_BUTTON_SIZE_RATIOS.buttonGroupRect.h / 2)})`}
            >
                <g className="mock-dec-dur">
                    <rect
                        x={0}
                        y={0}
                        rx={scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w / 2}
                        width={scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w}
                        height={scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.h}
                        fill="var(--tertiary-accent)"
                        filter="url(#drop-shadow-light)"
                    />
                    <HiMinus
                        size={`${fontSize}px`}
                        style={{
                            fill: 'var(--primary-text)',
                            transform: `translate(${scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w / 2 - fontSize / 2}px, ${(scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.h / 2) - fontSize / 2}px)`
                        }}
                    />
                </g>
                <text
                    x={scaleW * (SECOND_ROW_BUTTON_SIZE_RATIOS.buttonGroupRect.w / 2)}
                    y={scaleW * (SECOND_ROW_BUTTON_SIZE_RATIOS.buttonGroupRect.h / 2)}
                >
                    {duration ? snap_to_valid_dur(duration) : 1}
                </text>
                <g
                    transform={`translate(${scaleW * (SECOND_ROW_BUTTON_SIZE_RATIOS.buttonGroupRect.w - SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w)} 0)`}
                >
                    <g
                        className="mock-inc-dur"
                    >
                        <rect
                            x={0}
                            y={0}
                            rx={scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w / 2}
                            width={scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w}
                            height={scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.h}
                            fill="var(--tertiary-accent)"
                            filter="url(#drop-shadow-light)"
                        />
                        <HiPlus
                            size={`${fontSize}px`}
                            style={{
                                fill: 'var(--primary-text)',
                                transform: `translate(${scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.w / 2 - fontSize / 2}px, ${(scaleW * SECOND_ROW_BUTTON_SIZE_RATIOS.buttonSize.h / 2) - fontSize / 2}px)`
                            }}
                        />
                    </g>
                </g>
            </g>
        </g>
    )
})

const ThirdRowButtons = React.memo(function ThirdRowButtons({
    scaleW,
    fontSize,
    dotted,
}: {
    scaleW: number,
    fontSize: number,
    dotted?: boolean
}) {
    return (
        <g
            transform={`translate(${scaleW * (PADDING_RATIO + THIRD_ROW_SIZE_RATIOS.indentPadding.w)} ${scaleW * (PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h + FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.h + SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.h + THIRD_ROW_SIZE_RATIOS.indentPadding.h)})`}
            className="button-type2"
        >
            <text
                x={0}
                y={scaleW * (THIRD_ROW_SIZE_RATIOS.boundingRect.h / 2)}
                fontSize={`${fontSize}px`}
                style={{ textAnchor: 'start' }}
            >
                Dotted?
            </text>
            <g
                transform={`translate(${scaleW * (THIRD_ROW_SIZE_RATIOS.boundingRect.w - THIRD_ROW_SIZE_RATIOS.buttonSize.w)} 0)`}
                className={`mock-dotted-button ${dotted ? 'dotted' : ''}`}
            >
                <rect
                    x={0}
                    y={0}
                    stroke="var(--primary-text)"
                    strokeWidth={scaleW * THIRD_ROW_SIZE_RATIOS.buttonSize.w / 20}
                    rx={scaleW * THIRD_ROW_SIZE_RATIOS.buttonSize.w / 5}
                    width={scaleW * THIRD_ROW_SIZE_RATIOS.buttonSize.w}
                    height={scaleW * THIRD_ROW_SIZE_RATIOS.buttonSize.h}
                />
                <IoMdCheckmark
                    size={`${fontSize}px`}
                    style={{
                        transform: `translate(${scaleW * THIRD_ROW_SIZE_RATIOS.buttonSize.w / 2 - fontSize / 2}px, ${(scaleW * THIRD_ROW_SIZE_RATIOS.buttonSize.h / 2) - fontSize / 2}px)`
                    }}
                />
            </g>
        </g>
    )
})

const PitchControlButtons = React.memo(function PitchControlButtons({
    scaleW,
    fontSize,
    displayPitch
}: {
    scaleW: number,
    fontSize: number,
    displayPitch?: string,
}) {
    return (
        <g
            transform={`translate(${scaleW * (PADDING_RATIO)} ${scaleW * (PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h + 2 * FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.h + SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.h + 2 * THIRD_ROW_SIZE_RATIOS.indentPadding.h + THIRD_ROW_SIZE_RATIOS.boundingRect.h)})`}
            className="button-type2"
        >
            <text
                x={0}
                y={0}
                fontSize={`${fontSize}px`}
                style={{ textAnchor: 'start' }}
            >
                Pitch:
            </text>
            <g
                transform={`translate(0 ${scaleW * PITCH_CONTROL_SIZE_RATIOS.indentPadding.h})`}
            >
                <g className="mock-inc-pitch">
                    <rect
                        x={0}
                        y={0}
                        width={scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.w}
                        height={scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.h}
                        fill="var(--tertiary-accent)"
                        rx={scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.w / 2}
                        filter="url(#drop-shadow-light)"
                    />
                    <IoIosArrowUp
                        size={`${fontSize * 0.75}px`}
                        style={{
                            fill: 'var(--primary-text)',
                            transform: `translate(${scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.w / 2 - (fontSize * 0.75) / 2}px, ${(scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.h / 2) - (fontSize * 0.75) / 2}px)`
                        }}
                    />
                </g>
                <text
                    x={scaleW * (PITCH_CONTROL_SIZE_RATIOS.boundingRect.w / 2)}
                    y={scaleW * (PITCH_CONTROL_SIZE_RATIOS.boundingRect.h / 2)}
                    fontSize={`${fontSize}px`}
                >
                    {displayPitch ?? 'B4'}
                </text>
                <g
                    transform={`translate(0, ${scaleW * (PITCH_CONTROL_SIZE_RATIOS.boundingRect.h - PITCH_CONTROL_SIZE_RATIOS.buttonSize.h)})`}
                >
                    <g className="mock-dec-pitch">
                        <rect
                            x={0}
                            y={0}
                            width={scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.w}
                            height={scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.h}
                            fill="var(--tertiary-accent)"
                            rx={scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.w / 2}
                            filter="url(#drop-shadow-light)"
                        />
                        <IoIosArrowDown
                            size={`${fontSize * 0.75}px`}
                            style={{
                                fill: 'var(--primary-text)',
                                transform: `translate(${scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.w / 2 - (fontSize * 0.75) / 2}px, ${(scaleW * PITCH_CONTROL_SIZE_RATIOS.buttonSize.h / 2) - (fontSize * 0.75) / 2}px)`
                            }}
                        />
                    </g>
                </g>

            </g>
        </g>
    )
})

const NoteTypeButtons = React.memo(function NoteTypeButtons({
    scaleW,
    fontSize,
    typeMatrix,
}: {
    scaleW: number,
    fontSize: number,
    typeMatrix?: AlterableVals['typeMatrix']
}) {
    return (
        <g
            transform={`translate(${scaleW * (1 - (PADDING_RATIO + TYPE_CONTROL_SIZE_RATIOS.buttonSize.w * 2 + TYPE_CONTROL_SIZE_RATIOS.indentPadding.w))} ${scaleW * (PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h + 2 * FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.h + SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.h + 2 * THIRD_ROW_SIZE_RATIOS.indentPadding.h + THIRD_ROW_SIZE_RATIOS.boundingRect.h + PITCH_CONTROL_SIZE_RATIOS.indentPadding.h)})`}
        >
            <g
                className={`mock-type-rect ${typeMatrix?.sharp === 'selected' ? 'selected' : (typeMatrix?.sharp === 'disabled' ? 'disabled' : '')}`}
            >
                <g className="mock-sharp">
                    <rect
                        x={0}
                        y={0}
                        width={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w}
                        height={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h}
                        rx={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 10}
                        strokeWidth={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 25}
                    />
                    <text
                        x={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 2}
                        y={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h / 2}
                        fontFamily="Bravura"
                        fontSize={fontSize}
                    >
                        {'\u266F'}
                    </text>
                </g>
            </g>
            <g
                transform={`translate(${scaleW * (TYPE_CONTROL_SIZE_RATIOS.buttonSize.w + TYPE_CONTROL_SIZE_RATIOS.indentPadding.w)} 0)`}
                className={`mock-type-rect ${typeMatrix?.flat === 'selected' ? 'selected' : (typeMatrix?.flat === 'disabled' ? 'disabled' : '')}`}
            >
                <rect
                    x={0}
                    y={0}
                    width={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w}
                    height={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h}
                    rx={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 10}
                    strokeWidth={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 25}
                />
                <text
                    x={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 2}
                    y={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h / 2}
                    fontFamily="Bravura"
                    fontSize={fontSize}
                >
                    {'\u266D'}
                </text>
            </g>
            <g
                transform={`translate(0  ${scaleW * (TYPE_CONTROL_SIZE_RATIOS.buttonSize.h + TYPE_CONTROL_SIZE_RATIOS.indentPadding.h)})`}
                className={`mock-type-rect ${typeMatrix?.natural === 'selected' ? 'selected' : (typeMatrix?.natural === 'disabled' ? 'disabled' : '')}`}
            >
                <rect
                    x={0}
                    y={0}
                    width={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w}
                    height={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h}
                    rx={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 10}
                    strokeWidth={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 25}
                />
                <text
                    x={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 2}
                    y={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h / 2}
                    fontFamily="Bravura"
                    fontSize={fontSize}
                >
                    {'\u266E'}
                </text>
            </g>
            <g
                transform={`translate(${scaleW * (TYPE_CONTROL_SIZE_RATIOS.buttonSize.w + TYPE_CONTROL_SIZE_RATIOS.indentPadding.w)}  ${scaleW * (TYPE_CONTROL_SIZE_RATIOS.buttonSize.h + TYPE_CONTROL_SIZE_RATIOS.indentPadding.h)})`}
                className={`mock-type-rect ${typeMatrix?.rest === 'selected' ? 'selected' : (typeMatrix?.rest === 'disabled' ? 'disabled' : '')}`}
            >
                <g className="mock-rest">
                    <rect
                        x={0}
                        y={0}
                        width={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w}
                        height={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h}
                        rx={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 10}
                        strokeWidth={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 25}
                    />
                    <text
                        x={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.w / 2}
                        y={scaleW * TYPE_CONTROL_SIZE_RATIOS.buttonSize.h / 2}
                        fontFamily="Bravura"
                        fontSize={fontSize}
                    >
                        {'\uE4E5'}
                    </text>
                </g>
            </g>
        </g>
    )
})

const AdvancedOptionsButtons = React.memo(function AdvancedOptionsButtons({
    scaleW,
    fontSize,
    advancedOptionsAlterableVals,
}: {
    scaleW: number,
    fontSize: number
    advancedOptionsAlterableVals?: AlterableVals['advancedOptions']
}) {
    return (
        <g
            transform={`translate(${scaleW * PADDING_RATIO} ${scaleW * (PADDING_RATIO + FIRST_ROW_BUTTON_SIZE_RATIOS.addLeftButton.h + 3 * FIRST_ROW_BUTTON_SIZE_RATIOS.firstRowGaps.h + SECOND_ROW_BUTTON_SIZE_RATIOS.boundingRect.h + 2 * THIRD_ROW_SIZE_RATIOS.indentPadding.h + THIRD_ROW_SIZE_RATIOS.boundingRect.h + PITCH_CONTROL_SIZE_RATIOS.boundingRect.h + 1.5 * PITCH_CONTROL_SIZE_RATIOS.indentPadding.h)})`}
            className="button-type2"
        >
            <FaCaretDown
                style={{
                    transform: `translate(0px, ${scaleW * -ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.h / 2}px) rotate(${advancedOptionsAlterableVals ? '0deg' : '-90deg'})`,
                    transformOrigin: `${scaleW * ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.w / 2}px ${scaleW * ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.w / 2}px`,
                    fill: 'var(--primary-text)',
                    transition: 'transform 0.2s ease'
                }}
                size={`${scaleW * ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.w}px`}
            />
            <text
                x={scaleW * (ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.w + ADVANCED_CONTROL_SIZE_RATIOS.indentPadding.w)}
                y={0}
                fontSize={`${fontSize}px`}
                style={{ textAnchor: 'start' }}
            >
                Advanced Options
            </text>
            <IoIosSettings
                style={{
                    transform: `translate(${scaleW * (1 - 2 * PADDING_RATIO - ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.w)}px, ${scaleW * -ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.h / 2 - fontSize / 4}px)`,
                    fill: 'var(--primary-text)',
                }}
                size={`${scaleW * ADVANCED_CONTROL_SIZE_RATIOS.buttonSize.w}px`}
            />
        </g>
    )
})