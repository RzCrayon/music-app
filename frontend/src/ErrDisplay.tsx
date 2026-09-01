import { useCallback, useEffect, useState } from "react";

import { AiOutlineExclamationCircle } from "react-icons/ai";
import { IoWarningOutline } from "react-icons/io5";

import './ErrDisplay.css'

const ErrDisplay = ({ err, type = 'err', disableDisplay = false }: { err: string, type?: 'err' | 'warn', disableDisplay?: boolean }) => {

    const emptyErr = '\u00a0';

    const errTransitionDur = 600;
    const [displayMssg, setDisplayMssg] = useState('');

    useEffect(() => {
        if (err !== '') {
            setDisplayMssg(err);
        }
        else {
            const t = setTimeout(() => setDisplayMssg(emptyErr), errTransitionDur);
            return () => clearTimeout(t);
        }
    }, [err]);

    const [calculatedHeight, setCalculatedHeight] = useState(0);

    const measureRef = useCallback((node: any) => {
        if (node !== null) {
            setCalculatedHeight(node.scrollHeight);
        }
    }, [displayMssg, err]);

    return (
        <div
            className={`err-container ${type}`}
            style={{
                ['--err-transition-dur' as any]: `${errTransitionDur / 1000}s`,
                minHeight: err !== '' ? `${calculatedHeight}px` : '0px',
                height: err !== '' ? `${calculatedHeight}px` : '0px',
            }}
        >
            <div
                ref={measureRef}
                className={`err-mssg ${type} ${err !== '' ? '' : 'disappear'}`}
                style={{
                    width: '100%',
                    opacity: disableDisplay ? 0 : 1
                }}
            >
                {displayMssg !== emptyErr && (
                    type === 'err' ? <AiOutlineExclamationCircle /> : <IoWarningOutline />
                )}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    {displayMssg}
                </div>
            </div>
        </div>
    );
}

export default ErrDisplay