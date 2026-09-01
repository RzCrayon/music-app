import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import './Popup.css'
import { Scale } from 'tone';
import { createPortal } from 'react-dom';
import { globalZCounter, incGlobalZCounter } from '../main';
import type { Toaster } from '../services/types';

function Popup({
    x,
    y,
    height = 300,
    width = 300,
    visible,
    setVisible,
    content,
    overrideBackgroundClick,
    cutoutRect,
    forceDir,
    bgColor = 'var(--tertiary-accent)',
    toaster,
}: {
    x: number,
    y: number,
    height?: number,
    width?: number
    visible: boolean,
    setVisible: (state: boolean) => void,
    content: ReactElement<any, any>,
    overrideBackgroundClick?: () => void,
    cutoutRect?: DOMRect,
    forceDir?: 'top' | 'right' | 'left' | 'right',
    bgColor?: string,
    toaster?: Toaster,
}) {

    interface Range {
        minX: number,
        maxX: number,
        minY: number,
        maxY: number,
        type: 'bottom' | 'top' | 'right' | 'left',
    }

    const dimensions = { width, height }
    const arrow_dimensions = 10;

    const realXRef = useRef(0);

    const [newPos, setNewPos] = useState<{ x: number, y: number }>({ x, y });
    const border_radius = 20;
    const padding_size = arrow_dimensions + border_radius;

    const [arrowSide, setArrowSide] = useState<'top' | 'bottom' | 'left' | 'right'>('top')
    const [clipPath, setClipPath] = useState('');

    const [renderedZ, setRenderedZ] = useState(0);

    const [ranges, setRanges] = useState<Range[]>([]);

    const fade_dur = 150;

    useEffect(() => {
        setNewPos({ x: 0, y: 0 })
        setRenderedZ(-1);
    }, [])

    //so modals stack properly
    useEffect(() => {
        if (visible) {
            const newZ = incGlobalZCounter();
            setRenderedZ(newZ);
        }
        else {
            //keeps the zindex in place until the modal completely fades out 
            //so that it doesn't just disappear
            if (!overrideBackgroundClick) {
                const t = setTimeout(() => {
                    setNewPos({ x: 0, y: 0 })
                    setRenderedZ(-1);
                }, fade_dur + 50);
                return () => clearTimeout(t);
            }
        }
    }, [visible])

    useLayoutEffect(() => {
        //doesnt need to scroll shift the y bc the popup will move with the page if the 
        //page scrolls in the y
        if (visible) realXRef.current = x + window.scrollX;
    }, [x, visible])

    useLayoutEffect(() => {

        if (!visible) return;

        const handle_repos = () => {

            const innerWidth = window.innerWidth;
            const innerHeight = window.innerHeight;

            //trying to display a popup for something that's off the screen 
            if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) {
                setVisible(false);
                return;
            }

            const ranges: Range[] = [
                {
                    minX: realXRef.current + padding_size - dimensions.width,
                    maxX: realXRef.current - padding_size + dimensions.width,
                    minY: y + padding_size,
                    maxY: y + padding_size + dimensions.height,
                    type: 'bottom',
                },
                {
                    minX: realXRef.current + padding_size - dimensions.width,
                    maxX: realXRef.current - padding_size + dimensions.width,
                    maxY: y - padding_size,
                    minY: y - padding_size - dimensions.height,
                    type: 'top',
                },
                {
                    minX: realXRef.current + padding_size,
                    maxX: realXRef.current + padding_size + dimensions.width,
                    minY: y + padding_size - dimensions.height,
                    maxY: y - padding_size + dimensions.height,
                    type: 'right',
                },
                {
                    minX: realXRef.current - padding_size - dimensions.width,
                    maxX: realXRef.current - padding_size,
                    minY: y + padding_size - dimensions.height,
                    maxY: y - padding_size + dimensions.height,
                    type: 'left'
                }
            ]

            const restrictedRanges = ranges.map((range) => (
                {
                    type: range.type,
                    minX: Math.round(Math.max(window.scrollX, range.minX)),
                    minY: Math.round(Math.max(0, range.minY)),
                    maxX: Math.round(Math.min(innerWidth + window.scrollX, range.maxX)),
                    maxY: Math.round(Math.min(innerHeight, range.maxY))
                }
            ))

            const matchRanges: ('bottom' | 'top' | 'right' | 'left')[] = [];
            const matchedRanges: Range[] = [];
            const evaluateFit = (range: Range) => {
                const allowedWidth = Math.abs(range.maxX - range.minX);
                const allowedHeight = Math.abs(range.maxY - range.minY);
                if (range.type === 'bottom' || range.type === 'top') {
                    if (allowedWidth >= dimensions.width && allowedHeight >= dimensions.height) {
                        matchRanges.push(range.type);
                        matchedRanges.push(range);
                    }
                }
                else {
                    if (allowedWidth >= dimensions.width && allowedHeight >= dimensions.height) {
                        matchRanges.push(range.type);
                        matchedRanges.push(range);
                    }
                }
            }

            setRanges(matchedRanges);

            if (forceDir) {
                const range = ranges.find(r => r.type === forceDir) ?? ranges[0];
                evaluateFit(range);
            }
            else restrictedRanges.forEach(range => evaluateFit(range))


            const flipMap = {
                'bottom': 'top',
                'top': 'bottom',
                'right': 'left',
                'left': 'right'
            } as const;
            const range = restrictedRanges.find(range => range.type === matchRanges[0])
            if (range) {
                setNewPos({ x: range.minX, y: range.minY })
                setArrowSide(flipMap[range.type])
            }
            else {
                //couldn't render no space
                toaster?.add_message("Couldn't load the popup; Screen size too small.", 'color-mix(brown 30%, var(--warning-colour) 70%)')
                setVisible(false);
            }
        }

        handle_repos();

        window.addEventListener('scroll', handle_repos);
        window.addEventListener('resize', handle_repos);
        return () => {
            window.removeEventListener('resize', handle_repos);
            window.removeEventListener('scroll', handle_repos);
        }

    }, [x, y, visible]);

    useEffect(() => {

        const innerWidth = window.innerWidth;
        const innerHeight = window.innerHeight;

        if (!cutoutRect) return;

        setClipPath(
            `polygon(
                    0px 0px, ${innerWidth}px 0px, ${innerWidth}px ${innerHeight}px, 0px ${innerHeight}px, 0px 0px,
                    ${cutoutRect.left}px ${cutoutRect.top}px,
                    ${cutoutRect.left}px ${cutoutRect.bottom}px,
                    ${cutoutRect.right}px ${cutoutRect.bottom}px,
                    ${cutoutRect.right}px ${cutoutRect.top}px,
                    ${cutoutRect.left}px ${cutoutRect.top}px
                )`
        );

    }, [cutoutRect])

    return createPortal(
        <>
            <div
                onClick={overrideBackgroundClick ?
                    () => {
                        overrideBackgroundClick();
                        setNewPos({ x: 0, y: 0 })
                        setRenderedZ(-1);
                    }
                    : () => setVisible(false)}
                className="screen-overlay"
                style={{
                    zIndex: renderedZ,
                    clipPath,
                    // backgroundColor: 'green'
                }}
            />
            <div
                className={`popup ${arrowSide}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                    left: newPos.x,
                    top: newPos.y,
                    transform: visible ? 'scale(1)' : 'scale(0.2)',
                    visibility: visible ? 'visible' : 'hidden',
                    zIndex: renderedZ,
                    opacity: visible ? 1 : 0,
                    transition: visible
                        ? 'transform 0.2s ease, opacity 0.15s ease'
                        : 'transform 0.15s ease, opacity 0.15s ease, visibility 0s 0.15s',
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    minWidth: border_radius * 2 + arrow_dimensions,
                    minHeight: border_radius * 2 + arrow_dimensions,
                    borderRadius: border_radius,
                    maxWidth: '90%',

                    ['--bg-colour' as any]: bgColor,
                    ['--arrow-width' as any]: `${arrow_dimensions}px`,
                    ['--arrow-height' as any]: `${arrow_dimensions}px`,
                    ['--arrow-x-recalc' as any]: `${arrowSide === 'bottom' || arrowSide === 'top' ? Math.abs(realXRef.current - newPos.x) : 0}px`,
                    ['--arrow-y-recalc' as any]: `${arrowSide === 'left' || arrowSide == 'right' ? Math.abs(y - newPos.y) : 0}px`,

                }}
            >
                {content}
            </div >
            {/* {
                ranges.map((range, idx) => (
                    <div
                        key={idx}
                        style={{
                            position: 'absolute',
                            width: `${range.maxX - range.minX}px`,
                            height: `${range.maxY - range.minY}px`,
                            top: range.minY,
                            left: range.minX,
                            backgroundColor: ['yellow', 'green', 'red', 'blue'][idx],
                            zIndex: renderedZ + 1,
                            opacity: 0.5,
                            pointerEvents: 'none',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: 'white'
                        }}
                    >
                        {range.type}
                    </div>
                ))
            } */}
        </>,
        document.body
    )
}

export default Popup;