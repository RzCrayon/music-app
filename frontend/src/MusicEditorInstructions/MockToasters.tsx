import type { Dispatch, SetStateAction } from "react";
import { DropShadows } from "./MusicEditorInstructions";
import { IoIosClose } from "react-icons/io";

type ButtonState = 'clicked' | 'hovered' | ''

export function MockToaster({
    toasterCount,
    setToasterCount,
    lastToasterButtonState,
    scaleH,
    pos,
}: {
    toasterCount: number,
    setToasterCount: Dispatch<SetStateAction<number>>,
    lastToasterButtonState: ButtonState
    scaleH: number,
    pos: { x: number, y: number }
}) {

    const aspectRatio = 6;
    const width = scaleH * aspectRatio;
    const fontSize = scaleH * 0.22;

    const interToasterPadding = scaleH * 0.15
    const errMssgs = [
        "Silly goose, there's errors in your song.",
        "Do or do not there is no try.",
        "To err is human to forgive is divine."
    ]

    return (
        <svg
            viewBox={`0 0 ${width} ${scaleH}`}
            width={width}
            height={scaleH}
        >
            <DropShadows />
            <g
                transform={`translate(${pos.x - width * 0.9} ${pos.y - (scaleH * toasterCount + interToasterPadding * (toasterCount - 1))})`}
            >
                {
                    Array.from({ length: toasterCount }, (_, idx) => (
                        <g transform={`translate(0, ${idx * (scaleH + interToasterPadding)})`} key={idx}>
                            <rect
                                width={width}
                                height={scaleH}
                                rx={scaleH / 5}
                                fill="var(--err-colour)"
                                filter="url(#drop-shadow)"
                            />
                            <g
                                style={{
                                    scale: idx === toasterCount - 1 && lastToasterButtonState === 'hovered' ? 1.3 : 1,
                                    transition: 'scale 0.2s ease',
                                    fill: 'var(--primary-text)',
                                    transformBox: 'fill-box',
                                    transformOrigin: 'center'
                                }}
                            >
                                <IoIosClose
                                    x={width - scaleH / 1.5}
                                    y={scaleH / 2 - scaleH / 3}
                                    size={scaleH / 1.5}
                                />
                            </g>
                            <text
                                x={scaleH / 3.5}
                                y={scaleH / 2 + fontSize / 8}
                                dominantBaseline="middle"
                                fontSize={fontSize}
                                fill="var(--primary-text)"
                            >
                                {errMssgs[idx % errMssgs.length]}
                            </text>
                        </g>
                    ))
                }
            </g>
        </svg>
    )
}