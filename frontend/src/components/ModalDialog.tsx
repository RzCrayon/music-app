import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { globalZCounter, incGlobalZCounter } from "../main";
import { SimpleSpinner } from "../LoadingAsset";

import { IoClose } from "react-icons/io5";

import './ModalDialog.css'
import type { Toaster } from "../services/types";

function ModalDialog({
    bg_color = 'rgba(0, 0, 0, 0.7)',
    content,
    open,
    setOpen,
    handleClose = () => { },
    disableOutsideClickClose = false,
    fade_dur = 300,
    forceZIndex = 0,
}: {
    bg_color?: string,
    content: ReactElement<any, any>,
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>
    handleClose?: () => void,
    disableOutsideClickClose?: boolean,
    fade_dur?: number,
    forceZIndex?: number,
}) {
    const [renderedZ, setRenderedZ] = useState(0);

    //so modals stack properly
    useEffect(() => {
        if (open) {
            const newZ = incGlobalZCounter() + forceZIndex;
            setRenderedZ(newZ);
        }
        else {
            //keeps the zindex in place until the modal completely fades out 
            //so that it doesn't just disappear
            const t = setTimeout(() => {
                setRenderedZ(-1);
            }, fade_dur + 50);
            return () => clearTimeout(t);
        }
    }, [open])

    //setopen first so that if handleclose is setopen true it becomes a forced open modal
    const close = () => {
        if (!disableOutsideClickClose) {
            setOpen(false);
        }
        handleClose();
    };

    return createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                zIndex: renderedZ,
                display: 'flex',
                pointerEvents: open ? 'all' : 'none',
                boxSizing: 'border-box',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: open ? bg_color : 'transparent',
                opacity: open ? 1 : 0,
                transition: `background-color 0.6s ease, opacity ${fade_dur / 1000}s ease`,
            }}
            onClick={close}
        >
            {content}
        </div>,
        document.body //elevates it out of all bottom layers
    );
}

export default ModalDialog;



export function DeleteWarning({
    showMssg,
    setShowMssg,
    mssg,
    deleteProcess,
    deleteButtonMssg = 'Delete',
    handleClose = () => { },
    showCancel = false,
    cancel = () => { },
    cancelMssg = 'Go Back',
    disableCloseOptions,
    timeoutAxn,
    loadingTimeout,
    timeoutMssg,
}: {
    showMssg: boolean,
    setShowMssg: Dispatch<SetStateAction<boolean>>
    mssg: string,
    deleteProcess: () => void | Promise<void>,
    deleteButtonMssg?: string,
    handleClose?: () => void,
    showCancel?: boolean,
    cancel?: () => void,
    cancelMssg?: string,
    disableCloseOptions?: {
        outside: boolean,
        closeButton: boolean
    },
    timeoutAxn?: () => void;
    loadingTimeout?: number,
    timeoutMssg?: string,
}) {

    const [title, setTitle] = useState('Are you Sure?')
    const [displayMssg, setDisplayMssg] = useState(mssg);
    const [buttonMssg, setButtonMssg] = useState(deleteButtonMssg);

    const [loading, setLoading] = useState(false);

    const textRef = useRef<HTMLDivElement>(null);
    const [textScrolling, setTextScrolling] = useState(false);

    useEffect(() => {
        if (title !== 'ERROR') setDisplayMssg(mssg);
        const handleScrollState = () => {
            if (!textRef.current) return;
            setTextScrolling(textRef.current.scrollHeight > textRef.current.clientHeight);
        }
        handleScrollState();
        window.addEventListener('resize', handleScrollState);
        return () => window.removeEventListener('resize', handleScrollState);
    }, [mssg])

    return (
        <ModalDialog
            bg_color="color-mix(var(--err-colour) 70%, transparent 30%)"
            open={showMssg}
            setOpen={setShowMssg}
            disableOutsideClickClose={disableCloseOptions?.outside}
            handleClose={() => {
                setTitle('Are you Sure?')
                setDisplayMssg(mssg);
                setButtonMssg(buttonMssg);
                handleClose();
            }}
            content={
                <div
                    className="delete-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    {
                        !disableCloseOptions?.outside && (
                            <IoClose
                                className="delete-modal-cancel-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMssg(false);
                                    handleClose();
                                }}
                            />
                        )
                    }
                    <div className="delete-modal-header">{title}</div>
                    <div
                        className={`delete-modal-text ${textScrolling ? 'scrolling' : ''}`}
                        ref={textRef}
                    >
                        {displayMssg}
                    </div>
                    {
                        loading
                            ? (
                                <SimpleSpinner
                                    width='50px'
                                    height='50px'
                                    bgColor="color-mix(var(--err-colour) 70%, transparent 30%)"
                                    loadingTimeout={loadingTimeout}
                                    timeoutAxn={() => {
                                        timeoutAxn?.();
                                        cancel();
                                        setShowMssg(false);
                                    }}
                                />
                            )
                            : (
                                <div className="delete-modal-button-group">
                                    <div
                                        className="delete-modal-button"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (title !== 'ERROR') {
                                                const startTime = performance.now();
                                                setLoading(true);
                                                try {
                                                    await deleteProcess();
                                                    setShowMssg(false);
                                                }
                                                catch (error) {
                                                    //in the case that the signal is abortted due to timeout
                                                    if (error instanceof Error && error.message === 'cancelled') {
                                                        setTitle('ERROR');
                                                        setDisplayMssg(`Action Failed. (${error ?? 'Unknown Error Occured'})`)
                                                        setButtonMssg('Retry')
                                                    }
                                                }
                                                finally {
                                                    const elapsedTime = Math.abs(startTime - performance.now());
                                                    const minElapsedTime = 500;
                                                    if (elapsedTime < minElapsedTime) {
                                                        await new Promise(resolve => setTimeout(resolve, minElapsedTime - elapsedTime));
                                                    }
                                                    setLoading(false);
                                                }
                                            }
                                            else {
                                                setTitle('Are you Sure?')
                                                setDisplayMssg(mssg)
                                                setButtonMssg(deleteButtonMssg)
                                            }
                                        }}
                                    >
                                        {buttonMssg}
                                    </div>
                                    {showCancel && (
                                        <div
                                            onClick={() => {
                                                cancel();
                                                setShowMssg(false);
                                            }}
                                            className="cancel-txt"
                                        >{cancelMssg}</div>
                                    )}
                                </div>
                            )
                    }
                </div>
            }
        />
    )
}