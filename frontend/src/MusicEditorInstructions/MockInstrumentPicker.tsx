import { instrumentPNGMap } from "../InstrumentPicker";
import { DropShadows } from "./MusicEditorInstructions";

const paddingRatio = 0.03;
const boxSize = 0.25

export function MockInstrumentPicker({
    open,
    pos,
    scaleH,
    aspectRatio,
    hovered,
}: {
    open: boolean,
    pos: { x: number, y: number },
    scaleH: number
    aspectRatio: number,
    hovered: boolean
}) {

    const width = scaleH * aspectRatio;
    const fontSize = scaleH * 0.07;

    const initPadding = (width - ((2 * paddingRatio) + (3 * boxSize)) * width) / 2;

    return (
        <svg
            viewBox={`0 0 ${width} ${scaleH}`}
            width={width}
            height={scaleH}
        >
            <defs>
                <clipPath id="instrument-slider-clip">
                    <rect
                        x={0}
                        y={scaleH * 0.45 - boxSize * width / 2 - (scaleH * 0.55 - width * boxSize) / 2}
                        width={width}
                        height={scaleH * 0.55}
                    />
                </clipPath>
                <filter id="drop-shadow-instrument" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow
                        dx="0"
                        dy="0"
                        stdDeviation="6"
                        floodColor="black"
                        floodOpacity="1"
                    />
                </filter>
            </defs>
            <DropShadows />
            <g
                transform={`translate(${pos.x} ${pos.y})`}
            >
                <g
                    filter="url(#drop-shadow)"
                    scale={open ? 1 : 0.5}
                    style={{
                        scale: open ? 1 : 0.5,
                        opacity: open ? 1 : 0,
                        transition: 'opacity 0.1s ease, scale 0.25s ease',
                        transformOrigin: 'bottom'
                    }}
                >
                    <rect
                        width={width}
                        height={scaleH}
                        x={0}
                        y={0}
                        fill="var(--tertiary-accent)"
                        rx={width / 10}
                    />
                    <polygon
                        points={`
                        ${width * 0.45},${scaleH - 1}
                        ${width * 0.5},${scaleH + width * 0.05}
                        ${width * 0.55},${scaleH - 1}
                    `}
                        fill="var(--tertiary-accent)"
                    />
                    <text
                        x={width / 2}
                        y={scaleH * 0.1}
                        fontSize={fontSize}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--primary-text)"
                    >
                        Choose your Instrument
                    </text>

                    <rect
                        width={width * 0.8}
                        height={scaleH * 0.2}
                        x={width / 2 - width * 0.4}
                        y={scaleH * 0.75}
                        fill="var(--disabled-colour)"
                        rx={scaleH * 0.2 / 2}
                    />
                    <text
                        x={width / 2}
                        y={scaleH * 0.85}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--primary-text)"
                    >
                        PIANO
                    </text>
                    <g
                        clipPath="url(#instrument-slider-clip)"
                    >
                        {
                            instrumentPNGMap.map((instrument, idx) => (
                                <g
                                    transform={`translate(${initPadding + idx * (boxSize + paddingRatio) * width}, ${scaleH * 0.45 - boxSize * width / 2})`}
                                >
                                    <g
                                        style={{
                                            scale: instrument.name === 'trumpet' && hovered ? 1.1 : 1,
                                            transformBox: 'fill-box',
                                            transformOrigin: 'center',
                                            transition: 'scale 0.2s ease'
                                        }}
                                    >
                                        <rect
                                            x={0}
                                            y={0}
                                            height={width * boxSize}
                                            width={width * boxSize}
                                            stroke={instrument.name === 'piano' ? "var(--primary-text)" : 'transparent'}
                                            strokeWidth={width * boxSize / 50}
                                            rx={width * boxSize / 7}
                                            fill={instrument.name === 'trumpet' && hovered ? "var(--tertiary-text)" : 'var(--tertiary-accent)'}
                                            filter="url(#drop-shadow-instrument)"
                                            style={{
                                                transition: 'fill 0.2s ease'
                                            }}
                                        />
                                        <image
                                            width={width * boxSize * 0.8}
                                            height={width * boxSize * 0.8}
                                            x={width * boxSize * 0.1}
                                            y={width * boxSize * 0.1}
                                            href={`${instrument.img}`}
                                        />
                                    </g>
                                </g>
                            ))
                        }
                    </g>
                </g>
            </g>
        </svg>
    )
}