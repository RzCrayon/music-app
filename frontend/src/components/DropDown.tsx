import { useRef, type Dispatch, type SetStateAction } from "react";
import { IoMdArrowDropdown } from "react-icons/io";
import { globalZCounter, incGlobalZCounter } from "../main";
import './DropDown.css'

export function DropDown({
    open,
    setOpen,
    op,
    ops,
    setOp
}: {
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    op: string,
    ops: string[],
    setOp: Dispatch<SetStateAction<string>>
}) {

    const triggerRef = useRef<HTMLDivElement>(null);

    return (
        <>
            <div
                style={{
                    textTransform: 'capitalize',
                    alignSelf: 'flex-end',
                    marginRight: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                Sort By:
                <div className="drop-down-wrapper">
                    <div
                        className={`drop-down-trigger ${open ? 'opened' : ''}`}
                        ref={triggerRef}
                        onClick={() => setOpen(!open)}
                    >
                        {op}
                        <IoMdArrowDropdown />
                    </div>
                    <div
                        className={`drop-down-container ${open ? 'opened' : ''}`}
                        style={{
                            width: triggerRef.current?.clientWidth ?? 0,
                            zIndex: incGlobalZCounter(),
                        }}
                    >
                        {
                            ops.map((o, idx) => (
                                <div
                                    key={idx}
                                    className={o === op ? 'selected' : ''}
                                    onClick={() => {
                                        setOpen(false);
                                        setOp(o)
                                    }}
                                >{o}</div>
                            ))
                        }
                    </div>
                </div>
            </div>
        </>
    )
}