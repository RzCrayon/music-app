import { find_pic_idx, getImgDimensionsFor } from "../services/key_map_lib"
import type { Instruments, Note, PopupNonEditorState } from "../services/types"
import { get_note_display_name } from "./sheetmusic_processor"
import './NoteEditorPopup.css'
import { useMemo } from "react"
import type { NewPopup } from "./NoteEditorPopupNoteDisplay"

export function SongNotePopupDisplay({
    popup,
    notes,
    instrument,
}: {
    popup: NewPopup,
    notes: Note[],
    instrument: Instruments
}) {
    const note = useMemo(() => notes[popup.noteIdx], [notes, popup]);
    const img_dimensions = useMemo(() => getImgDimensionsFor(instrument), [instrument]);
    if (note.type !== 'rest')
        console.log(`/${instrument}_pics/Slide ${find_pic_idx(instrument, note.pitches[popup.pitchIdx].pitch) + 1}.png`);
    return (
        <div className="non-editor-styler">
            <span>{get_note_display_name(note)}</span>
            {
                note.type !== 'rest' && (
                    <div className={`picture-container ${instrument}`}>
                        {
                            instrument === 'piano' && (
                                <img
                                    style={{ minWidth: `${img_dimensions.width}px`, height: `${img_dimensions.height}px` }}
                                    src={`/${instrument}_pics/reference_pic.png`}
                                />
                            )
                        }
                        <img
                            className={`overlay-key`}
                            style={{
                                minWidth: `${img_dimensions.width}px`,
                                height: `${img_dimensions.height}px`,
                            }}
                            src={`/${instrument}_pics/Slide ${find_pic_idx(instrument, note.pitches[popup.pitchIdx].pitch) + 1}.png`}
                        />
                    </div>
                )
            }
        </div>
    )
}

export function getTextHeightForWidth(
    width: number,
    note: Note | null,
    styles: { font?: string; padding?: string; lineHeight?: string } = {}
): number {
    if (typeof window === 'undefined' || !note) return 0;

    const dummy = document.createElement('div');
    dummy.style.position = 'absolute';
    dummy.style.visibility = 'hidden';
    dummy.style.left = '-9999px';
    dummy.style.top = '-9999px';
    dummy.style.width = `${width}px`;
    dummy.style.boxSizing = 'border-box';
    dummy.style.whiteSpace = 'pre-wrap';
    dummy.style.wordBreak = 'break-word';

    dummy.style.font = styles.font || '16px sans-serif';
    dummy.style.lineHeight = styles.lineHeight || '1.4';
    dummy.style.padding = styles.padding || '0px';

    dummy.innerText = get_note_display_name(note);

    document.body.appendChild(dummy);
    const height = dummy.getBoundingClientRect().height;
    document.body.removeChild(dummy);

    return height;
}