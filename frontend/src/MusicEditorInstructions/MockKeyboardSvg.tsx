import { DropShadows } from "./MusicEditorInstructions";
import './MockKeyboardSvg.css'

export function MockKeyboardSvg({
    scaleW,
    startPos,
}: {
    scaleW: number
    startPos: { x: number, y: number }
}) {

    const boxSize = (1 / 4) * (1 / 2) * scaleW;
    const paddingSize = (1 / 5) * (boxSize);

    const firstRowChars = ['Q', 'W', 'E', 'R'];
    const secondRowChars = ['A', 'S', 'D'];

    const aspectRatio = 0.5;
    const height = scaleW * aspectRatio;

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
                {/*first row*/}
                {
                    firstRowChars.map((char, idx) => (
                        <g
                            transform={`translate(${idx * (boxSize + paddingSize)}, 0)`}
                        >
                            <g
                                className={`key ${char}`}
                            >
                                <rect
                                    x={0}
                                    y={0}
                                    width={boxSize}
                                    height={boxSize}
                                    fill='var(--tertiary-accent)'
                                    rx={boxSize / 5}
                                    filter='url(#note-drop-shadow)'
                                />
                                <text
                                    x={boxSize / 2}
                                    y={boxSize / 2}
                                    fontSize={boxSize / 2}
                                >
                                    {char}
                                </text>
                            </g>
                        </g>
                    ))
                }
                {/* second row */}
                {
                    secondRowChars.map((char, idx) => (
                        <g
                            transform={`translate(${(idx + 0.33) * (boxSize + paddingSize)}, ${boxSize + paddingSize})`}
                        >
                            <g
                                className={`key ${char}`}
                            >
                                <rect
                                    x={0}
                                    y={0}
                                    width={boxSize}
                                    height={boxSize}
                                    fill='var(--tertiary-accent)'
                                    rx={boxSize / 5}
                                    filter='url(#note-drop-shadow)'
                                />
                                <text
                                    x={boxSize / 2}
                                    y={boxSize / 2}
                                    fontSize={boxSize / 2}
                                >
                                    {char}
                                </text>
                            </g>
                        </g>
                    ))
                }
                <g
                    transform={`translate(${scaleW - boxSize * 3}, 0)`}
                >
                    <g
                        className={`key backspace`}
                    >
                        <rect
                            x={0}
                            y={0}
                            width={boxSize * 3}
                            height={boxSize}
                            fill='var(--tertiary-accent)'
                            rx={boxSize / 5}
                            filter='url(#note-drop-shadow)'
                        />
                        <text
                            x={boxSize * 1.5}
                            y={boxSize / 2.1}
                            fontSize={boxSize / 3}
                        >
                            backspace
                        </text>
                    </g>
                </g>

            </g>
        </svg>
    )
}