import { forwardRef, useEffect, useMemo, useRef, useState, type ForwardRefExoticComponent, type ReactElement } from "react";
import Popup from "./Popup";

import { MdInfoOutline } from "react-icons/md";
import { GoQuestion } from "react-icons/go";

const Text = forwardRef<HTMLDivElement, { mssg: string | ReactElement<any, any>, minWidth: number, centered?: boolean }>(
    ({ mssg, minWidth, centered = false }, ref) => (
        <div
            ref={ref}
            style={{
                minWidth,
                width: 'fit-content',
                height: 'fit-content',
                fontSize: 'small',
                whiteSpace: 'pre-line',
                display: centered ? 'flex' : undefined,
                justifyContent: centered ? 'center' : undefined,
                alignItems: centered ? 'center' : undefined,
            }}
        >
            {mssg}
        </div>
    )
);

export function Tooltip({
    mssg,
    minWidth,
    content,
    renderAllowed = true,
    bgColor = 'var(--tertiary-accent)'
}: {
    mssg: string | ReactElement<any, any>,
    minWidth: number
    content: ReactElement<any, any>,
    renderAllowed?: boolean
    bgColor?: string,
}) {
    const contentRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const open = isHovered && renderAllowed;

    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pos, setPos] = useState({ x: 0, y: 0 });

    const hiddenText = useMemo(() => (
        <Text mssg={mssg} minWidth={minWidth} ref={textRef} centered />
    ), [mssg, minWidth]);

    useEffect(() => {
        if (!textRef.current) return;
        setSize({
            width: textRef.current.offsetWidth,
            height: textRef.current.offsetHeight,
        });
    }, [mssg, minWidth]);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (contentRef.current) {
            const rect = contentRef.current.getBoundingClientRect();
            setPos({ x: rect.x + rect.width / 2, y: rect.y });
        }
    };

    return (
        <>
            <div
                ref={contentRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsHovered(false)}
            >
                {content}
            </div>
            <Popup
                x={pos.x}
                y={pos.y}
                width={size.width + 40}
                height={size.height + 40}
                visible={open}
                setVisible={() => setIsHovered(false)}
                content={hiddenText}
                cutoutRect={contentRef.current?.getBoundingClientRect()}
                forceDir="top"
                bgColor={bgColor}
            />
        </>
    )
}

export default function Info({ mssg, minWidth, icon = 'info' }: { mssg: string, minWidth: number, icon?: 'info' | 'question' }) {

    const infoRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    const [size, setSize] = useState({ width: 0, height: 0 });
    const [pos, setPos] = useState({ x: 0, y: 0 });

    const hiddenText = useMemo(() => (
        <Text mssg={mssg} minWidth={minWidth} ref={textRef} />
    ), [mssg, minWidth]);

    useEffect(() => {
        if (!textRef.current) return;
        setSize({
            width: textRef.current.offsetWidth,
            height: textRef.current.offsetHeight,
        });
    }, [mssg, minWidth]);


    const handleMouseEnter = () => {
        setOpen(true);

        if (infoRef.current) {
            const rect = infoRef.current.getBoundingClientRect();
            setPos({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
        }
    };

    return (
        <>
            <div
                ref={infoRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setOpen(false)}
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 'fit-content',
                    cursor: 'pointer',
                    transform: 'scale(1.3)',
                }}
            >
                {icon === 'info' ? <MdInfoOutline /> : <GoQuestion />}
            </div>
            <Popup
                x={pos.x}
                y={pos.y}
                width={size.width + 40}
                height={size.height + 40}
                visible={open}
                setVisible={() => setOpen(false)}
                content={hiddenText}
                cutoutRect={infoRef.current?.getBoundingClientRect()}
            />
        </ >
    )
}