import { useEffect, useRef } from 'react';
import './LoadingAsset.css'
import { errorEmitter, toastEmitter } from './main';
import { CNXN_FAILURE } from './services/api';
import type { Toaster } from './services/types';

export default function LoadingAsset({
    mssg = 'Loading',
    //theres a 10 sec fall back so if an action takes more than 10 seconds people arent left looking at a blank spinner
    loadingTimeout = 10000, //10 sec
    timeoutMssg,
    timeoutAxn,
    triggerPageCrash = true,
    cancelTimeoutWatcher = false,
    lineRestriction,
}: {
    mssg: string,
    loadingTimeout?: number
    timeoutMssg?: string,
    timeoutAxn?: () => void,
    triggerPageCrash?: boolean,
    cancelTimeoutWatcher?: boolean,
    lineRestriction?: number,
}) {

    useEffect(() => {
        if (cancelTimeoutWatcher || loadingTimeout === undefined || mssg === '') return;

        const timerId = setTimeout(() => {
            if (triggerPageCrash)
                errorEmitter.trigger({ title: 'Process Timed Out', mssg: timeoutMssg || CNXN_FAILURE.mssg });
            else {
                toastEmitter.trigger({ mssg: timeoutMssg || 'Process Timed Out' });
            }
            timeoutAxn?.();
        }, loadingTimeout);

        return () => clearTimeout(timerId);
    }, [mssg, loadingTimeout, cancelTimeoutWatcher]);

    return (
        <div className="loading-container">
            <div className='record-wrapper'>
                <div className='wonky-record' />
            </div>
            <div className='needle-wrapper'>
                <div className='needle' />
            </div>
            <div className='mssg-container'>
                <span
                    className='line-restricted-container'
                    style={{ '--line-clamp': lineRestriction } as React.CSSProperties}
                >
                    {mssg}
                    <span className='dots' />
                </span>
            </div>
        </div>
    )
}

export function SimpleSpinner({
    width,
    height,
    spinnerColor = 'var(--primary-text)',
    bgColor = 'var(--primary-accent)',
    arcFraction = 2 / 3,
    radius = 3,
    loadingTimeout,
    timeoutMssg = 'Process timed out.',
    timeoutAxn
}: {
    width: string,
    height: string,
    spinnerColor?: string,
    bgColor?: string,
    arcFraction?: number,
    radius?: number,
    loadingTimeout?: number
    timeoutMssg?: string,
    timeoutAxn?: () => void,
}) {

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        if (loadingTimeout === undefined) return;

        const timerId = setTimeout(() => {
            if (isMountedRef.current) {
                toastEmitter.trigger({ mssg: timeoutMssg });
                timeoutAxn?.();
            }
        }, loadingTimeout);

        return () => {
            isMountedRef.current = false;
            clearTimeout(timerId);
        };
    }, [loadingTimeout, timeoutMssg, timeoutAxn]);

    const arcDeg = 360 * arcFraction;

    return (
        <div
            style={{
                minWidth: width,
                minHeight: height,
                borderRadius: '50%',
                background: `conic-gradient(${spinnerColor} 0deg, ${spinnerColor} ${arcDeg}deg, ${bgColor} ${arcDeg}deg, ${bgColor} 360deg)`,
                animation: 'spin 1s linear infinite',
                WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${radius}px), #000 calc(100% - ${radius}px))`,
                mask: `radial-gradient(farthest-side, transparent calc(100% - ${radius}px), #000 calc(100% - ${radius}px))`,
            }}
            className='loading-spinner'
        />
    )
}