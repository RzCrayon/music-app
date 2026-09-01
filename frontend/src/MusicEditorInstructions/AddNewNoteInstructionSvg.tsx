import { useEffect, useRef, useState } from 'react';
import './AddNewNoteInstructionSvg.css'
import { MockPopupSvg } from './MockPopupSvg';
import { CursorInstructionsDisplay, DropShadows, MeasureInstructionsDisplay, NoteInstructionsDisplay } from './MusicEditorInstructions';

export function AddNewNoteNoNotes() {

    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const rectAspectRatio = 2.5 //width to height
    const [rectSize, setRectSize] = useState({ w: 0, h: 0 })

    useEffect(() => {
        if (!svgContainerRef.current) return;
        const handleResize = () => {
            const w = svgContainerRef.current?.clientWidth ?? 0;
            const h = svgContainerRef.current?.clientHeight ?? 0;

            if (!w || !h) return;

            let targetW = Math.max(w * 0.5, 200 * rectAspectRatio);
            let targetH = targetW / rectAspectRatio;

            if (targetW > w * 0.9) {
                targetW = w * 0.9;
                targetH = targetW / rectAspectRatio;
            }
            if (targetH > h * 0.9) {
                targetH = h * 0.9;
                targetW = targetH * rectAspectRatio;
            }

            setSvgDimensions({ w, h });
            setRectSize({ w: targetW, h: targetH });
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [])

    return (
        <div
            className="instructions-container add-note-with-no-notes"
            style={{
                ['--moveDistX' as any]: rectSize.w * 0.2,
                ['--moveDistY' as any]: rectSize.h * 0.4
            } as React.CSSProperties}
        >
            <div className="svg-wrapper" ref={svgContainerRef}>
                <svg
                    viewBox={`0 0 ${svgDimensions.w} ${svgDimensions.h}`}
                    width="100%"
                    height="100%"
                >
                    <DropShadows />
                    <g>
                        <g
                            transform={`translate(${(svgDimensions.w - rectSize.w) / 2}, ${(svgDimensions.h - rectSize.h) / 2})`}
                        >
                            <rect
                                x={0}
                                y={0}
                                width={rectSize.w}
                                height={rectSize.h}
                                rx={16}
                                ry={16}
                                fill="var(--primary-accent)"
                                filter='url(#drop-shadow)'
                                className='button no-notes'
                            >
                            </rect>
                            <text
                                x={rectSize.w * 0.5}
                                y={rectSize.h * 0.5}
                                dominantBaseline="central"
                                textAnchor="middle"
                                fill="var(--primary-text)"
                                fontSize={rectSize.w / 12}
                                className='button-text no-notes'
                            >
                                Add Note
                            </text>
                            <CursorInstructionsDisplay
                                dimensions={{
                                    x: rectSize.w * 0.8,
                                    y: rectSize.h * 1.2,
                                    size: rectSize.w / 10
                                }}
                            />
                        </g>
                    </g>
                </svg>
            </div>
            <div className='description'>
                Press the Add Note button at the start of the first measure to add your first note.
            </div>
        </div>
    )
}

export function AddNewNotePopup() {
    const svgContainerRef = useRef<HTMLDivElement>(null);

    const [svgDimensions, setSvgDimensions] = useState({ w: 0, h: 0 });
    const measureAspectRatio = 2.5;
    const [measureSize, setMeasureSize] = useState({ w: 0, h: 0 })

    useEffect(() => {
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
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [])

    const startingCursorFactors = { x: 1.1, y: 0.6 }

    return (
        <div
            className="instructions-container add-note-with-notes"
            style={{
                ['--moveDistX1' as any]: measureSize.w * (startingCursorFactors.x - 0.48),
                ['--moveDistY1' as any]: measureSize.h * (startingCursorFactors.y - 0.48),
                ['--moveDistX2' as any]: measureSize.w * (startingCursorFactors.x),
                ['--moveDistY2' as any]: measureSize.h * (startingCursorFactors.y - 1.9),
                ['--moveDistX3' as any]: measureSize.w * (startingCursorFactors.x - 0.5),
                ['--moveDistY3' as any]: measureSize.h * (startingCursorFactors.y - 1.9),
            } as React.CSSProperties}
        >
            <div className="svg-wrapper" ref={svgContainerRef}>
                <svg
                    viewBox={`0 0 ${svgDimensions.w} ${svgDimensions.h}`}
                    width="100%"
                    height="100%"
                >
                    <DropShadows />
                    <g
                        transform={`translate(${(svgDimensions.w - measureSize.w) / 2}, ${measureSize.h / 2})`}
                    >
                        <MeasureInstructionsDisplay
                            measureSize={measureSize}
                        />
                        <NoteInstructionsDisplay
                            pos={{ x: measureSize.w * 0.5, y: measureSize.h * 0.5 }}
                            fontSize={measureSize.w / 4}
                        />
                        <MockPopupSvg
                            startPos={{ x: -((svgDimensions.w - measureSize.w) / 2) + svgDimensions.w * 0.05, y: measureSize.h + measureSize.h * 0.1 }}
                            scaleW={svgDimensions.w * 0.9}
                        />
                        <CursorInstructionsDisplay
                            dimensions={{
                                x: measureSize.w * startingCursorFactors.x,
                                y: measureSize.h * startingCursorFactors.y,
                                size: measureSize.w / 8
                            }}
                        />
                    </g>
                </svg>
            </div>
            <div className='description'>
                <p style={{ fontSize: 'medium' }}>
                    Click on any note.
                </p>
                {'Then, use the Add Left or Add Right buttons in the popup to add more notes to your music.'}
            </div>
        </div>
    )

}