import { DropShadows } from "./MusicEditorInstructions"
import './MockPlayerSvg.css'

import { FaVolumeMute } from "react-icons/fa";
import { FaPause, FaPlay, FaVolumeHigh, FaVolumeLow } from "react-icons/fa6";
import { IoPlayBack } from "react-icons/io5";
import { MdForward5, MdReplay5 } from "react-icons/md";
import type { PlaybackState } from "../services/types";
import { PiMetronome } from "react-icons/pi";
import { useEffect, type Dispatch, type SetStateAction } from "react";

type AlterableVals = {
    volume?: number, // 0 - 1
    playbackState?: PlaybackState,
    metronome?: boolean,
}

type ButtonState = 'clicked' | 'hovered' | ''

export type ButtonStates = {
    volume: ButtonState,
    slider: 'active' | 'inactive',
    restart: ButtonState,
    rewind: ButtonState,
    forward: ButtonState,
    metronome: ButtonState,
    pause: ButtonState,
}

const ratios = {
    buttonSize: 0.07,
    interButtonPadding: 0.02,
    volume: 0.2,
    borderPadding: 0.095
}
const lineSize = 0.01;
const buttonSvgSize = ratios.buttonSize * 0.6

export function MockPlayerSvg({
    scaleW,
    startPos,
    buttonStates,
    setButtonStates,
    alterableVals,
}: {
    scaleW: number
    startPos: { x: number, y: number }
    buttonStates: ButtonStates,
    setButtonStates: Dispatch<SetStateAction<ButtonStates>>
    alterableVals?: AlterableVals,
}) {

    const aspectRatio = 0.12
    const height = scaleW * aspectRatio;

    useEffect(() => {
        if (buttonStates.volume === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, volume: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.volume]);

    useEffect(() => {
        if (buttonStates.restart === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, restart: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.restart]);

    useEffect(() => {
        if (buttonStates.rewind === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, rewind: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.rewind]);

    useEffect(() => {
        if (buttonStates.forward === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, forward: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.forward]);

    useEffect(() => {
        if (buttonStates.metronome === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, metronome: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.metronome]);

    useEffect(() => {
        if (buttonStates.pause === 'clicked') {
            const timer = setTimeout(() => {
                setButtonStates(prev => ({ ...prev, pause: 'hovered' }))
            }, 200)
            return () => clearTimeout(timer);
        }
    }, [buttonStates.pause]);

    return (
        <svg
            viewBox={`0 0 ${scaleW} ${height}`}
            className="mock-music-player"
            width={scaleW}
            height={height}
        >
            <DropShadows />
            <g
                transform={`translate(${startPos.x} ${startPos.y})`}
            >
                <rect
                    x={0}
                    y={0}
                    width={scaleW}
                    height={height}
                    rx={height / 4}
                    fill="var(--tertiary-accent)"
                    filter="url(#drop-shadow-light)"
                />
                <g
                    transform={`translate(${scaleW * ratios.borderPadding}, ${height / 2})`}
                >
                    <g className={`player-button ${buttonStates.volume}`}>
                        {(() => {
                            const size = scaleW * buttonSvgSize;
                            const iconProps = {
                                size,
                                x: 0,
                                y: -size / 2
                            }

                            if (alterableVals?.volume) {
                                if (alterableVals.volume <= 0.5) {
                                    if (alterableVals.volume <= 0.1) {
                                        return <FaVolumeMute {...iconProps} />
                                    }
                                    return <FaVolumeLow {...iconProps} />
                                }
                                return <FaVolumeHigh {...iconProps} />
                            }
                            return <FaVolumeMute {...iconProps} />
                        })()}
                    </g>
                </g>
                <g transform={`translate(${scaleW * (ratios.borderPadding + ratios.buttonSize + ratios.interButtonPadding)} ${height / 2})`}>
                    <line
                        x1={0}
                        y1={0}
                        x2={scaleW * ratios.volume * 0.8}
                        y2={0}
                        strokeWidth={lineSize * scaleW}
                        strokeLinecap="round"
                    />
                    <g className={`player-button ${buttonStates.slider}`}>
                        <rect
                            x={(scaleW * ratios.volume * 0.8) * (alterableVals?.volume ?? 0) - 1.5 * lineSize * scaleW}
                            y={-1.5 * lineSize * scaleW}
                            width={3 * lineSize * scaleW}
                            height={3 * lineSize * scaleW}
                            rx={1.5 * lineSize * scaleW}
                            fill="var(--primary-text)"
                        />
                    </g>
                </g>
                <g
                    transform={`translate(${scaleW * (ratios.borderPadding + ratios.buttonSize + 2 * ratios.interButtonPadding + ratios.volume)}, ${height / 2})`}
                >
                    <g className={`player-button ${buttonStates.restart}`}>

                        <IoPlayBack
                            size={buttonSvgSize * scaleW}
                            x={0}
                            y={-buttonSvgSize * scaleW / 2}
                        />
                    </g>
                </g>
                <g
                    transform={`translate(${scaleW * (2 * ratios.borderPadding + ratios.buttonSize + 3 * ratios.interButtonPadding + ratios.volume)}, ${height / 2})`}
                >
                    <g className={`player-button ${buttonStates.rewind}`}>
                        <MdReplay5
                            size={buttonSvgSize * scaleW}
                            x={0}
                            y={-buttonSvgSize * scaleW / 2}
                        />
                    </g>
                </g>
                <g
                    transform={`translate(${scaleW * (3 * ratios.borderPadding + ratios.buttonSize + 4 * ratios.interButtonPadding + ratios.volume)}, ${height / 2})`}
                >
                    <g className={`player-button ${buttonStates.pause}`}>
                        {
                            alterableVals?.playbackState === 'playing' ? (
                                <FaPause
                                    size={buttonSvgSize * scaleW}
                                    x={0}
                                    y={-buttonSvgSize * scaleW / 2}
                                />
                            ) : (
                                <FaPlay
                                    size={buttonSvgSize * scaleW}
                                    x={0}
                                    y={-buttonSvgSize * scaleW / 2}
                                />
                            )
                        }
                    </g>
                </g>
                <g
                    transform={`translate(${scaleW * (4 * ratios.borderPadding + ratios.buttonSize + 5 * ratios.interButtonPadding + ratios.volume)}, ${height / 2})`}
                >
                    <g className={`player-button ${buttonStates.forward}`}>
                        <MdForward5
                            size={buttonSvgSize * scaleW}
                            x={0}
                            y={-buttonSvgSize * scaleW / 2}
                        />
                    </g>
                </g>
                <g
                    transform={`translate(${scaleW * (5 * ratios.borderPadding + ratios.buttonSize + 6 * ratios.interButtonPadding + ratios.volume)}, ${height / 2})`}
                    className={`metronome ${alterableVals?.metronome ? 'selected' : ''}`}
                >
                    <g className={`player-button ${buttonStates.metronome}`}>
                        <rect
                            x={-buttonSvgSize * 0.4 * scaleW}
                            y={-buttonSvgSize * 0.9 * scaleW}
                            width={buttonSvgSize * 1.8 * scaleW}
                            height={buttonSvgSize * 1.8 * scaleW}
                            stroke="var(--primary-text)"
                            strokeWidth={lineSize / 3 * scaleW}
                            rx={buttonSvgSize * scaleW * 0.3}
                        />
                        <PiMetronome
                            size={buttonSvgSize * scaleW}
                            x={0}
                            y={-buttonSvgSize * scaleW / 2}
                        />
                    </g>
                </g>
            </g>
        </svg>
    )
}