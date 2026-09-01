import { useEffect, type ReactElement } from "react";
import './Drawer.css'
import { globalZCounter, incGlobalZCounter } from "../main";

type StickSide = 'top' | 'bottom' | 'right' | 'left'

function Drawer({
    stickSide,
    expansionSize,
    open,
    content,
    bgColor = 'var(--primary-accent)',
    sticky = false,
}: {
    stickSide: StickSide
    expansionSize: number,
    open: boolean,
    content: ReactElement<any, any>,
    bgColor?: string,
    sticky?: boolean,
}) {


    let styleMatrix: {
        top: number | undefined,
        bottom: number | undefined,
        left: number | undefined,
        right: number | undefined,
        width: string | undefined,
        height: string | undefined,
        transform: string
    } = {
        top: 0,
        bottom: 0,
        left: 0,
        right: undefined,
        height: undefined,
        width: `${expansionSize}px`,
        transform: open ? 'translateX(0%)' : `translateX(-${expansionSize + 30}px)`
    }
    if (stickSide === 'right') {
        styleMatrix = {
            top: 0,
            bottom: 0,
            right: 0,
            left: undefined,
            height: undefined,
            width: `${expansionSize}px`,
            transform: open ? 'translateX(0%)' : `translateX(${expansionSize + 30}px)`
        }
    }
    else if (stickSide === 'top') {
        styleMatrix = {
            left: 0,
            right: 0,
            top: 0,
            bottom: undefined,
            height: `${expansionSize}px`,
            width: undefined,
            transform: open ? 'translateY(0%)' : `translateY(-${expansionSize + 30}px)`
        }
    }
    else if (stickSide === 'bottom') {
        styleMatrix = {
            left: 0,
            right: 0,
            top: undefined,
            bottom: 0,
            height: `${expansionSize}px`,
            width: undefined,
            transform: open ? 'translateY(0%)' : `translateY(${expansionSize + 30}px)`
        }
    }

    return (
        <div
            className={`drawer`}
            style={{
                ...styleMatrix,
                backgroundColor: bgColor,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: incGlobalZCounter(),
                position: sticky ? 'fixed' : 'absolute'
            }}
        >
            {content}
        </div>
    )
}

export default Drawer;