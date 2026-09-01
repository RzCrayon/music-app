import React, { useEffect, useMemo, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react'
import './MusicEditorInstructions.css'
import Drawer from '../components/Drawer'

import { IoClose } from 'react-icons/io5'
import { BsList } from "react-icons/bs";
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io'
import { findChildrenOf, findParentsOf, flattenDirectory, getInstructionsSxns, getNamePath, isDirectParentOf, isParentOf, runSearchFor, type SxnNode } from './MusicEditorInstructionsData';
import { dotted, snap_to_valid_dur } from '../SheetMusic/sheetmusic_processor';
import type { Accidentals } from '../services/types';

export const DropShadows = () => (
    <defs>
        <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="10"
                floodColor="black"
                floodOpacity="0.7"
            />
        </filter>
        <filter id="cursor-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor="black"
                floodOpacity="0.7"
            />
        </filter>
        <filter id="note-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="4"
                floodColor="black"
                floodOpacity="0.7"
            />
        </filter>
        <filter id="drop-shadow-light" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="6"
                floodColor="black"
                floodOpacity="0.7"
            />
        </filter>
    </defs>
)

export const MeasureInstructionsDisplay = ({
    measureSize
}: {
    measureSize: { w: number, h: number }
}) => (
    <>
        <rect
            x={0}
            y={0}
            width={measureSize.w}
            height={measureSize.h}
            fill='transparent'
            filter='url(#drop-shadow)'
        />
        {
            Array.from({ length: 5 }, (_, lineNum) => (
                <line
                    key={lineNum}
                    x1={0}
                    x2={measureSize.w}
                    y1={lineNum * (measureSize.h / 4)}
                    y2={lineNum * (measureSize.h / 4)}
                    stroke='black'
                    strokeWidth={measureSize.h / 70}
                />
            ))
        }
    </>
)

export const NoteInstructionsDisplay = ({
    pos,
    fontSize,
    duration = 1,
    flipped,
    rest,
    accidental,
    id,
}: {
    pos: { x: number, y: number },
    fontSize: number,
    duration?: number,
    flipped?: boolean,
    accidental?: Accidentals
    rest?: boolean,
    id?: string,
}) => {

    const noteUniCodes: Record<number, string> = {
        0.25: '\uE1D9',
        0.5: '\uE1D7',
        1: '\uE1D5',
        2: '\uE1D3',
        4: '\uE1D2'
    }

    const flippedNoteUniCodes: Record<number, string> = {
        0.25: '\uE1DA',
        0.5: '\uE1D8',
        1: '\uE1D6',
        2: '\uE1D4',
        4: '\uE1D2',
    }

    const restUnicodes: Record<number, string> = {
        0.25: '\uE4E7',
        0.5: '\uE4E6',
        1: '\uE4E5',
        2: '\uE4E4',
        4: '\uE4E3'
    }

    const accidentalUniCodes: Record<string, string> = {
        'Flat': '\uE260',
        'Sharp': '\uE262'
    }

    return (
        <g
            transform={`translate(${pos.x} ${pos.y})`}
        >
            <g
                className={`mock-note ${id}`}
                filter='url(#note-drop-shadow)'
            >
                < text
                    x={0}
                    y={0}
                    fontFamily='Bravura'
                    fontSize={fontSize}
                    textAnchor="middle"
                >
                    {
                        rest ? restUnicodes[snap_to_valid_dur(duration)] :
                            (flipped ? flippedNoteUniCodes : noteUniCodes)[snap_to_valid_dur(duration)]}
                </text >
                {dotted(duration) && !rest && (
                    <text
                        x={fontSize / 4}
                        y={fontSize / 6}
                        fontFamily='Bravura'
                        fontSize={fontSize}
                        textAnchor="middle"
                    >
                        {'\uE1E7'}
                    </text>
                )}
                {
                    accidental && !rest && (
                        <text
                            x={-fontSize / 4 * 1.25}
                            y={fontSize / 8}
                            fontFamily='Bravura'
                            fontSize={fontSize * 0.75}
                            textAnchor="middle"
                        >
                            {accidentalUniCodes[accidental]}
                        </text>
                    )
                }
            </g>
        </g>
    )
}

export const CursorInstructionsDisplay = ({
    dimensions,
}: {
    dimensions: { x: number, y: number, size: number },
}) => (
    <image
        href="/cursor.png"
        x={dimensions.x}
        y={dimensions.y}
        width={dimensions.size}
        height={dimensions.size}
        preserveAspectRatio="xMidYMid meet"
        filter='url(#cursor-drop-shadow)'
        className='cursor'
    />
)

export const PlaybackCursorInstructionsDisplay = ({
    pos,
    size,
    tipState = 'inactive',
    fill = 'var(--tertiary-accent)'
}: {
    pos: { x: number, y: number },
    size: number,
    tipState?: 'active' | 'inactive' | 'hovered',
    fill?: string,
}) => {
    const tipHeight = size / 6;
    return (
        <g
            transform={`translate(${pos.x} ${pos.y})`}
            filter='url(#note-drop-shadow)'
        >
            <line
                x1={0}
                x2={0}
                y1={- tipHeight}
                y2={size + tipHeight}
                stroke={fill}
                strokeWidth={tipHeight / 5}
            />
            <g
                className={`playback-cursor-tip ${tipState}`}
            >
                <path
                    d={`M ${-tipHeight * (5 / 6)} ${-tipHeight} L ${tipHeight * (5 / 6)} ${-tipHeight} L 0 ${tipHeight * (5 / 18)} Z`}
                    transform={`translate(${0}, ${-tipHeight})`}
                    fill={fill}
                    stroke={fill}
                    strokeWidth={6}
                    strokeLinejoin='round'
                />
            </g>
        </g>
    )
}

const SxnsList = React.memo(function SxnsList({
    list,
    fontSize,
    paddingLeft,
    selectedSxn,
    setSxn,
    collapsedSxns,
    setCollapsedSxns,
}: {
    list: SxnNode[],
    fontSize: number,
    paddingLeft: number
    selectedSxn: SxnNode,
    setSxn: Dispatch<SetStateAction<SxnNode>>
    collapsedSxns: string[],
    setCollapsedSxns: Dispatch<SetStateAction<string[]>>
}) {
    return (
        <div className='sxns-list'>
            {
                list.map(sxn => {
                    //group
                    if (sxn.sub_sxns) {
                        const collapsed = collapsedSxns.includes(sxn.sxnId);
                        return (
                            <div
                                key={sxn.sxnId}
                            >
                                <div
                                    className={`title ${isParentOf(sxn.sxnId, selectedSxn.sxnId) ? 'contains-selected-sxn' : ''} ${collapsed ? 'collapsed' : ''}`}
                                    style={{
                                        fontSize,
                                        paddingLeft: paddingLeft - 5
                                    }}
                                    onClick={() => {
                                        setCollapsedSxns(prev => {
                                            const children = findChildrenOf(sxn.sxnId);
                                            if (collapsed) {
                                                //uncollapse all direct children
                                                const directChildren = new Set([sxn.sxnId, ...children].filter((cid) => !isDirectParentOf(sxn.sxnId, cid)));
                                                return prev.filter((sid) => !directChildren.has(sid));
                                            }
                                            //collapse all children of the sxn we just clicked on + that sxn itself
                                            return [...new Set([...prev, ...children, sxn.sxnId])];
                                        })
                                    }}
                                >
                                    <IoIosArrowForward />
                                    {sxn.name}
                                </div>
                                <div className={`group ${collapsed ? 'collapsed' : ''}`}>
                                    <div >
                                        <SxnsList
                                            list={sxn.sub_sxns}
                                            fontSize={fontSize - 3}
                                            paddingLeft={paddingLeft + 20}
                                            selectedSxn={selectedSxn}
                                            setSxn={setSxn}
                                            collapsedSxns={collapsedSxns}
                                            setCollapsedSxns={setCollapsedSxns}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    return (
                        <div
                            key={sxn.sxnId}
                            className={`title  ${sxn.sxnId === selectedSxn.sxnId ? 'selected' : ''}`}
                            style={{
                                paddingLeft: paddingLeft + 5,
                                fontSize,
                            }}
                            onClick={() => {
                                const parentsOfLastSxn = findParentsOf(selectedSxn.sxnId);
                                const parentsOfNewSxn = new Set(findParentsOf(sxn.sxnId));

                                setSxn(sxn);
                                const exclusiveParents = parentsOfLastSxn.filter(sid => !parentsOfNewSxn.has(sid));
                                //collapse the all the parents of the last sxn that don't overlap with the new sxn, and the last sxn 
                                setCollapsedSxns(prev => [...new Set([...prev, ...exclusiveParents, selectedSxn.sxnId])]);
                            }}
                        >
                            {sxn.name}
                        </div>
                    )
                })
            }
        </div >
    )
})

function InstructionsPanel({
    open,
    setOpen,
    notesLen,
    refFile,
}: {
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    notesLen: number,
    refFile: File | null
}) {

    const instructionSxns = useMemo(() => getInstructionsSxns(notesLen, refFile), [open]);
    const [sxn, setSxn] = useState<SxnNode>(instructionSxns[6] as SxnNode);

    const [collapsedSxns, setCollapsedSxns] = useState<string[]>(() =>
        flattenDirectory(instructionSxns)
            .filter((s) => !isParentOf(s.sxnId, sxn.sxnId))
            .map((s) => s.sxnId)
    );

    const [directoryOpen, setDirectoryOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');


    return (
        <div
            className='main-container'
            onClick={(e) => e.stopPropagation()}
        >
            <div className='header'>
                <div className='title'>
                    <strong>How To use the Song Builder</strong>
                    <div style={{ fontSize: 'medium', marginTop: '6px' }}>
                        {getNamePath(sxn, instructionSxns)}
                    </div>
                </div>
                <IoClose onClick={() => setOpen(false)} />
            </div>

            <div className='body'>
                <BsList
                    className='open-directory-icon'
                    onClick={() => setDirectoryOpen(true)}
                />
                <Drawer
                    stickSide='left'
                    expansionSize={280}
                    open={directoryOpen}
                    content={
                        <div className='sxns-list-container'>
                            <div className='header'>
                                <div className='search'>
                                    <input
                                        placeholder='Search'
                                        style={{
                                            border: 'none',
                                            padding: 10,
                                        }}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <IoClose
                                    className='close-directory-icon'
                                    onClick={() => setDirectoryOpen(false)}
                                />
                            </div>
                            <SxnsList
                                list={instructionSxns}
                                fontSize={18}
                                paddingLeft={15}
                                selectedSxn={sxn}
                                setSxn={setSxn}
                                collapsedSxns={collapsedSxns}
                                setCollapsedSxns={setCollapsedSxns}
                            />
                        </div>
                    }
                    bgColor='color-mix(in srgb, rgb(126, 126, 126) 35%, var(--tertiary-accent) 65%)'
                />
                {sxn.svg && <sxn.svg />}
            </div>
        </div>
    )
}

export default InstructionsPanel