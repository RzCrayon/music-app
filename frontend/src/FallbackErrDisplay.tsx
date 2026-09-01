import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import ModalDialog from './components/ModalDialog'
import './FallbackErrDisplay.css'
import { incGlobalZCounter } from './main'

export default function FallbackErrDisplay({
    mssg,
    setMssg
}: {
    mssg: { title: string, mssg: string },
    setMssg: Dispatch<SetStateAction<{ title: string, mssg: string }>>,
}) {

    return (
        <ModalDialog
            bg_color='var(--bg)'
            fade_dur={0}
            content={
                <div
                    key={mssg.mssg}
                    className='fallback-err-display'
                >
                    <div className='on-air-svg'>
                        ON AIR
                    </div>

                    <span style={{ fontWeight: 'bold' }}>{mssg.title || 'An error ocurred.'}</span>
                    <span>{mssg.mssg || 'Check your connection and then refresh the page.'}</span>
                    <button
                        onClick={async () => {
                            window.location.reload()
                        }}
                    >
                        Click to Refresh
                    </button>
                </div>
            }
            open={Boolean(mssg.mssg)}
            setOpen={() => { }}
            disableOutsideClickClose={true}
            forceZIndex={1000}
        />
    )
}