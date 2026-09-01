import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { Instruments, Note, StateManager } from "./services/types"
import './InstrumentPicker.css'
import { DeleteWarning } from "./components/ModalDialog"
import { VOICE_LIMITS } from "./SheetMusic/NoteEditorPopupNoteDisplay"

export const instrumentPNGMap: { name: Instruments, img: string }[] = [
    { name: 'piano', img: 'piano_icon.png' },
    { name: 'trumpet', img: 'trumpet_icon.png' },
    // { name: 'guitar', img: 'guitar_icon.png' }
]

export function InstrumentPicker({
    instrument,
    setInstrument,
    notes,
    shadowed = true,
    stateManager,
}: {
    instrument: Instruments,
    setInstrument: (newInstrument: Instruments, newNotes?: Note[]) => void,
    stateManager?: StateManager,
    notes?: Note[]
    shadowed?: boolean,
}) {

    const [warningOpen, setWarningOpen] = useState(false);
    const [pendingInstrument, setPendingInstrument] = useState<Instruments>(instrument)

    const deleteParts = (newInstrument: Instruments) => {
        const newNotes: Note[] = [];
        const deletedNotes: Note[] = [];
        const allowedParts = VOICE_LIMITS[newInstrument] - 1;
        notes?.forEach(n => {
            if (n.part <= allowedParts) newNotes.push(n);
            else deletedNotes.push(n);
        })
        if (stateManager) stateManager.addComplexAction(deletedNotes.map(n => ({ prevData: n })), instrument);
        return newNotes;
    }

    return (
        <>
            <DeleteWarning
                showMssg={warningOpen}
                setShowMssg={setWarningOpen}
                mssg={`Switching from ${instrument} to ${pendingInstrument} will delete any voice above voice ${VOICE_LIMITS[pendingInstrument]}. This action can't be undone.`}
                deleteProcess={() => {
                    setInstrument(
                        pendingInstrument,
                        notes ? deleteParts(pendingInstrument) : undefined,
                    );
                }}
                deleteButtonMssg="Yes, convert my music"
            />
            <div className={shadowed ? "instrument-picker-shadow" : ''}>
                <div className="instrument-picker-label">Choose your instrument</div>
                <div className="instrument-picker">
                    {instrumentPNGMap.map((curr_instru) => (
                        <img
                            className={curr_instru.name === instrument ? 'selected' : ''}
                            src={curr_instru.img}
                            key={curr_instru.name}
                            onClick={() => {
                                if (!notes) setInstrument(curr_instru.name);
                                else {
                                    const highestVoiceIndex = notes.length > 0
                                        ? Math.max(...notes.map(n => n.part ?? 0))
                                        : -1;

                                    const currentVoicesCount = highestVoiceIndex + 1;
                                    const maxAllowedVoices = VOICE_LIMITS[curr_instru.name] || 0;

                                    if (currentVoicesCount > maxAllowedVoices) {
                                        setPendingInstrument(curr_instru.name);
                                        setWarningOpen(true);
                                    } else {
                                        setInstrument(curr_instru.name);
                                    }
                                }
                            }}
                        />
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div className="selected-instrument">{instrument.toUpperCase()}</div>
                </div>
            </div>
        </>
    )
}