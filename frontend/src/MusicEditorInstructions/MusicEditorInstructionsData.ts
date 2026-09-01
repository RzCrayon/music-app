import type { ComponentType, ReactElement } from "react"
import { AddNewNoteNoNotes, AddNewNotePopup } from "./AddNewNoteInstructionSvg";
import { EditNoteDurationSvg } from "./EditNoteDurationInstructionsSvg";
import { EditNotePitchSvg } from "./EditNotePitchSvg";
import { EditNoteTypeSvg } from "./EditNoteTypeSvg";
import { KeyboardShortcutsSvg } from "./KeyboardShortcutsSvg";
import { MusicPlayerMovingPlaybackSvg } from "./MusicPlayerMovingPlaybackInstructionsSvg";
import { MusicPlayerVolumeSvg } from "./MusicPlayerVolumeInstructionsSvg";
import { MusicPlayerMetronomeSvg } from "./MusicPlayerMetronomeInstructionsSvg";
import { CursorPlaybackSvg } from "./CursorPlaybackInstructionsSvg";
import { CursorRegionsSvg } from "./CursorSelectRegionsInstructionsSvg";
import { EmptyRefImgSvg, SelectedRefImgInstructions } from "./UseRefImgInstructionsSvg";
import { InstrumentPickerInstructions } from "./InstrumentPickerInstructionsSvg";
import { DealingWithErrsSvg } from "./ErrInstructionsSvg";

export type SxnNode = {
    name: string;
    sxnId: string;
    keywords?: string[];
    svg?: ComponentType<any>;
    sub_sxns?: SxnNode[];
};

let called = false;

//can't have sxns that are named the same thing 
const instructionSxns: SxnNode[] = [
    {
        name: 'Adding Notes',
        keywords: ['add', 'insert', 'place', 'new', 'note', 'popup'],
        svg: AddNewNoteNoNotes,
        sxnId: '',
    },
    {
        name: 'Editting Sheet Music',
        sxnId: '',
        sub_sxns: [
            {
                name: 'Note Duration',
                keywords: ['change', 'adjust', 'modify', 'tweak', 'length', 'duration', 'quarter', 'eighth', 'half', 'whole', 'dotted', 'increase', 'decrease', 'frequency', 'up', 'down', 'note', 'popup', 'beat'],
                svg: EditNoteDurationSvg,
                sxnId: ''
            },
            {
                name: 'Note Pitch',
                keywords: ['sound', 'hear', 'noise', 'flat', 'sharp', 'accidental', 'natural', 'rest', 'change', 'adjust', 'modify', 'tweak', 'height', 'lower', 'raise', 'pitch', 'octave', 'increase', 'decrease', 'frequency', 'up', 'down', 'popup'],
                svg: EditNotePitchSvg,
                sxnId: ''
            },
            {
                name: 'Note Accidentals & Rests',
                keywords: ['sound', 'hear', 'noise', 'flat', 'sharp', 'accidental', 'natural', 'rest', 'change', 'adjust', 'modify', 'tweak', 'type', 'popup'],
                svg: EditNoteTypeSvg,
                sxnId: '',
            },
            {
                name: 'Keyboard Shortcuts',
                keywords: ['keyboard', 'hotkeys', 'type'],
                svg: KeyboardShortcutsSvg,
                sxnId: ''
            },
            // {
            //     name: 'Other',
            //     keywords: ['advanced options', 'chord', 'voice', 'switch', 'change', 'increase', 'decrease', 'clef', 'looks', 'color', 'colour', 'display', 'treble', 'bass', 'alto', 'tenor', 'other', 'popup'],
            //     svg: undefined,
            //     sxnId: ''
            // }
        ]
    },
    {
        name: 'Using the Cursor',
        sxnId: '',
        sub_sxns: [
            {
                name: 'Moving Playback',
                keywords: ['cursor', 'playback', 'start', 'playhead', 'position'],
                svg: CursorPlaybackSvg,
                sxnId: ''
            },
            {
                name: 'Selecting Regions',
                keywords: ['cursor', 'select', 'delete', 'copy', 'paste', 'region', 'highlight', 'range', 'pick', 'choose', 'area'],
                svg: CursorRegionsSvg,
                sxnId: ''
            }
        ]
    },
    {
        name: 'Using the Music Player',
        sxnId: '',
        sub_sxns: [
            {
                name: 'Moving Playback',
                keywords: ['jump', 'measure', 'replay', 'rewind', 'move', 'ahead', 'backward', 'skip', 'fast forward', 'fast-forward', 'forward', 'play', 'pause', 'start', 'stop'],
                svg: MusicPlayerMovingPlaybackSvg,
                sxnId: ''
            },
            {
                name: 'Volume',
                keywords: ['turn', 'up', 'down', 'increase', 'decrease', 'quiet', 'loud', 'soft', 'strong', 'hear', 'sound', 'noise', 'amplify'],
                svg: MusicPlayerVolumeSvg,
                sxnId: ''
            },
            {
                name: 'Metronome',
                keywords: ['tick', 'beat', 'tempo', 'click', 'rhythm', 'timing', 'metronome'],
                svg: MusicPlayerMetronomeSvg,
                sxnId: ''
            }
        ]
    },
    {
        name: 'Using a Reference Image',
        keywords: ['reference', 'image', 'look', 'upload', 'sheet music', 'photo', 'pdf', 'import', 'picture', 'template'],
        svg: EmptyRefImgSvg,
        sxnId: ''
    },
    {
        name: 'Changing the Render Instrument',
        keywords: ['instrument', 'piano', 'guitar', 'trumpet'],
        svg: InstrumentPickerInstructions,
        sxnId: ''
    },
    {
        name: 'Dealing with Errors',
        keywords: ['err', 'issue', 'crash', 'problem', 'warning', 'red', 'troubleshoot', 'with the same pitch', 'less than', 'more than', 'another voice', 'mid-measure', 'save', 'fail'],
        svg: DealingWithErrsSvg,
        sxnId: ''
    }
]

function postProcessSxns(parentId: string, subSxn: SxnNode[]) {
    for (const sxn of subSxn) {

        //check so that we can't change the crypto after having alr set it
        if (!sxn.sxnId) {
            const prefix = parentId ? `${parentId}/` : '';
            const id = `${prefix}${crypto.randomUUID()}`;

            sxn.sxnId = id;
        }

        if (sxn.sub_sxns) postProcessSxns(sxn.sxnId, sxn.sub_sxns);
    }
}

export const getInstructionsSxns = (notesLen: number, refFile: File | null) => {
    called = true;
    postProcessSxns('', instructionSxns)
    if (notesLen > 0) instructionSxns[0].svg = AddNewNotePopup;
    else instructionSxns[0].svg = AddNewNoteNoNotes;
    if (refFile) instructionSxns[4].svg = SelectedRefImgInstructions;
    else instructionSxns[4].svg = EmptyRefImgSvg;
    return instructionSxns;
}

export const getNamePath = (selectedSxn: SxnNode, directory: SxnNode[]) => {
    const path = selectedSxn.sxnId.split('/');

    const strPath: string[] = [];
    let currSubSxn: SxnNode[] | undefined = directory;

    const findSubSxnOf = (id: string, currSubSxn: SxnNode[], strPath: string[]) => {
        for (const sxn of currSubSxn) {
            if (sxn.sxnId.split('/').at(-1) === id) {
                strPath.push(sxn.name);
                return sxn.sub_sxns;
            }
        }
        return undefined;
    }

    for (const id of path) {
        currSubSxn = findSubSxnOf(id, currSubSxn, strPath);
        if (!currSubSxn) break;
    }

    return strPath.join(' → ')

}

//if the path doesn't include the inquiredSxnId then it's not a parent 
export const isParentOf = (parentPath: string, childPath: string,) => {
    return childPath.startsWith(`${parentPath}/`);
}

export const isDirectParentOf = (parentPath: string, childPath: string) => {
    if (!parentPath || !childPath || !isParentOf(parentPath, childPath)) return false
    return parentPath.split('/').length + 1 === childPath.split('/').length
}

//can't be used unless getInstructionsSxns has been called
export const findChildrenOf = (inquiredSxnId: string): string[] => {
    if (!called) getInstructionsSxns(0, null);
    return flattenDirectory(instructionSxns)
        .filter((sxn) => isParentOf(inquiredSxnId, sxn.sxnId))
        .map((s) => s.sxnId);
};

export const findParentsOf = (inquiredSxnId: string): string[] => {
    if (!called) getInstructionsSxns(0, null);
    return flattenDirectory(instructionSxns)
        .filter((sxn) => isParentOf(sxn.sxnId, inquiredSxnId))
        .map((s) => s.sxnId);
};

export const flattenDirectory = (directory: SxnNode[]): SxnNode[] => {
    return directory.flatMap(node => [
        node,
        ...(node.sub_sxns ? flattenDirectory(node.sub_sxns) : [])
    ]);
}

//even with a 3 word query the res from this will be sub ms
export const runSearchFor = (query: string) => {
    return [];
}