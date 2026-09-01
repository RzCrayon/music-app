import type { Dispatch, SetStateAction } from "react";

interface BaseNote {
    offset: number,
    duration: number, //in beats
    part: number,
    type: 'note' | 'chord' | 'rest'
}

export type RestPitch = { pitch: null, clef: Clefs }
export type PitchedPitch = { pitch: string, clef: Clefs }
export type NotePitch = RestPitch | PitchedPitch

// //makes sure that rests don't have pitches but regular notes can
export interface RestNote extends BaseNote {
    type: 'rest'
    pitch: RestPitch,
}

export interface PitchedNote extends BaseNote {
    type: 'note' | 'chord',
    pitches: PitchedPitch[]
}

export type PlaybackState = "loading" | "playing" | "paused";

export type Note = RestNote | PitchedNote

export interface Song {
    song_id: number;
    title: string;
    audio_url: string;
    highScore: ScoreData,
    total_attempts: number,
    notes: Note[];
    instrument: Instruments
}

export type ScoreData = {
    id: number,
    score: number | null,
    date: Date | null,
    attempt_num: number | null
}

export interface DashboardSong {
    song_id: number;
    title: string;
    instrument: Instruments,
}

export interface SongSetting {
    file: File | null,
    song: Song,
}

export interface Measure {
    notes: Note[],
    singletons: Set<number>
    eighths: Set<number>
    sixteenths: Set<number>
};

interface PopupBaseState {
    visible: boolean,
    top: number,
    left: number,
}

export interface PopupNoteState extends PopupBaseState {
    noteIdx: number,
    noteData: Note | null,
    pitch_idx: number,
    type: 'editor'
    stateManager: StateManager,
}

export interface PopupNonEditorState extends PopupBaseState {
    type: 'non-editor'
    instrument: Instruments,
    noteData: Note,
    pitch_idx: number,
}

export type PopupState = PopupNoteState | PopupNonEditorState

export const CLEF_TYPES = ['Treble', 'Bass', 'Alto', 'Tenor'] as const;
export type Clefs = typeof CLEF_TYPES[number];

export type TimeSignatureString = `${number}/${number}`
export type ParsedTimeSig = { denom: number, numerator: number }

export type Instruments = 'piano' | 'guitar' | 'trumpet' | 'viola' | 'violin' | 'cello' | 'flute' | 'saxophone'
export type Accidentals = 'Flat' | 'Sharp' | 'Natural'

export interface ComplexActionItem {
    prevData?: Note;
    currOffset?: number;
    currPart?: number;
    currDur?: number;
}

export interface StateManager {
    initManager: () => void;
    releaseManager: () => void;
    clearManager: () => void;
    addAction: (
        prevData?: Note,
        currOffset?: number,
        currPart?: number,
        currDur?: number
    ) => void;
    addComplexAction: (items: ComplexActionItem[], oldInstrument?: Instruments) => void;
    undo: (setNotes: Dispatch<SetStateAction<Note[]>>, setInstrument: (newInstrument: Instruments) => void) => void;
}

export type ErrMessage = {
    mssg: string,
    scrollPos: number
}

interface BaseSheetMusicProps {
    notes: Note[],
    clef: Clefs,
    cursor: number,
    setCursor: Dispatch<SetStateAction<number>>
    time_sig: TimeSignatureString,
    instrument: Instruments
    stateManager: StateManager,
    wrapperRef: React.RefObject<HTMLDivElement | null>,
    playbackState: PlaybackState,
    cursorMusicPlaybackControlFunc: (play: boolean) => Promise<void>
}

interface EditorSheetMusicProps extends BaseSheetMusicProps {
    editor: true,
    setNotes: Dispatch<SetStateAction<Note[]>>
    setErrMessages: Dispatch<SetStateAction<ErrMessage[]>>
    setClef: Dispatch<SetStateAction<Clefs>>
    setTimeSig: Dispatch<SetStateAction<TimeSignatureString>>
    setInstrument: (newInstrument: Instruments) => void,
    toaster: Toaster,
}

interface DisplaySheetMusicProps extends BaseSheetMusicProps {
    editor: false,
    setNotes?: undefined,
    setErrMessages?: undefined,
    setClef?: undefined,
    setTimeSig?: undefined,
    setInstrument?: undefined,
    toaster?: undefined,
}

export type SheetMusicProps = EditorSheetMusicProps | DisplaySheetMusicProps;

export interface NoteDisplay {
    id: string,
    relative_xpos: number,
    relative_ypos: number,
    svg: React.ReactNode,
    accidental: React.ReactNode | null,
    width: number,
    dotted: React.ReactNode | null,
    pitch_idx: number,
    in_notes_idx: number,
    type: 'Singleton' | 'Packed' | 'Chord', //Packed marks whether or not it is part of a joined eighth / sixteenth note group
    clef: Clefs,
    part: number,
    offset: number,
    renderJoinBar?: { barHeight: number, doubled?: number, noteCnxns: number[] } //marks where, in relative ypos the bar height should be rendered and where in relative ypos to connect the notes 
}

export interface Toaster {
    messages: { id: string, mssg: string, color: string }[],
    add_message: (mssg: string, color?: string) => void,
    remove_message: (id: string) => void,
    clear_messages: () => void,
}

export interface User {
    username: string;
    password: string;
}

export interface PasswordlessUser {
    username: string,
}

interface BaseMusicPlayer {
    mode: 'Terminal' | 'Song' | 'Editor'
    audio_url: string;
    minimiseContent: { increments: boolean, time: boolean }
    bpm?: number;
}

export interface TerminalMusicPlayer extends BaseMusicPlayer { }
export interface EditorMusicPlayer extends BaseMusicPlayer {
    bpm: number,
    setCurrentBeat: Dispatch<SetStateAction<number>>
}
export interface SongMusicPlayer extends BaseMusicPlayer {
    bpm: number,
    setCurrentBeat: Dispatch<SetStateAction<number>>,
    notes: Note[]
}

export type MusicPlayerType = TerminalMusicPlayer | EditorMusicPlayer | SongMusicPlayer;