import { useState, useEffect, useLayoutEffect, type Dispatch, type SetStateAction, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import './Song.css'
import { ScrollingTitle } from "./Dashboard";

import { HiMiniHome } from "react-icons/hi2";
import { FaTrash } from "react-icons/fa";

import { apiService } from "./services/api";
import SheetMusic from "./SheetMusic/SheetMusicRenderer";
import LoadingAsset from "./LoadingAsset";
import ModalDialog, { DeleteWarning } from "./components/ModalDialog";
import { useToaster } from "./components/Toaster";
import MusicEditorPlayer, { FINAL_RECORDING_LOADING_STATE } from "./MusicEditorPlayer";
import { type DashboardSong, type Instruments, type Note, type PlaybackState, type Song as SongType, type StateManager } from "./services/types";
import { emptySongSettings } from "./Terminal";
import React from "react";
import { sessionStateManager } from "./services/session_state_manager";
import { useSheetMusicStateManager } from "./SheetMusic/sheetmusic_state_manager";
import type { ScoreData, Toaster } from "./services/types";
import { RecordingScorePopup } from "./RecordingScorePopup";
import { IoStatsChartSharp } from "react-icons/io5";
import { Tooltip } from "./components/Info";
import { useToasterContext } from "./main";


const SongDisplay = React.memo(function SongDisplay({
    notes,
    cursor,
    setCursor,
    instrument,
    stateManager,
    playbackState,
}: {
    notes: Note[],
    cursor: number,
    setCursor: Dispatch<SetStateAction<number>>
    instrument: Instruments,
    stateManager: StateManager,
    playbackState: PlaybackState,
}) {

    const togglePlayFunc = useRef<((play: boolean) => Promise<boolean>) | null>(null);
    const manuallyTogglePlay = useCallback(async (play: boolean) => {
        togglePlayFunc.current?.(play);
    }, []);

    const wrapperRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className="song-wrapper"
            ref={wrapperRef}
        >
            <SheetMusic
                playbackState={playbackState}
                notes={notes}
                editor={false}
                clef={'Treble'}
                time_sig={'4/4'}
                cursor={cursor}
                setCursor={setCursor}
                instrument={instrument}
                stateManager={stateManager}
                wrapperRef={wrapperRef}
                cursorMusicPlaybackControlFunc={manuallyTogglePlay}
            />
        </div>
    )
})

function Song() {

    const mainToaster = useToasterContext();

    const [loading, setLoading] = useState('');
    const [recordingPopupLoadingState, setRecordingPopupLoadingState] = useState('');

    const location = useLocation();
    const navigate = useNavigate();

    //not initialised or anything so we dont have to worry about mem allocation just an empty var for now bc 
    //its needed in the sheetmusicrenderer to render notes 
    const stateManager = useSheetMusicStateManager(mainToaster);

    const currentUser = location.state?.user || null;
    const currentSongId = location.state?.song_id || null;

    const [currentSong, setCurrentSong] = useState<SongType>(emptySongSettings.song);
    const [cursor, setCursor] = useState(0);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const minLoadingTime = 500;

    const [playbackState, setPlaybackState] = useState<PlaybackState>('paused');

    const [recordingHighScore, setRecordingHighScore] = useState<ScoreData>(currentSong.highScore);
    const [lastScoreData, setLastScoreData] = useState<ScoreData>({
        score: null,
        date: null,
        attempt_num: null,
        id: 0,
    })

    const [lockListView, setLockListView] = useState(false);
    const [showPastRecordings, setShowPastRecordings] = useState(false);

    //wait until loading in props is done
    useLayoutEffect(() => {
        const loadSong = async () => {
            if (!currentSongId || !currentUser) {
                navigate('/');
                return;
            };

            const lastPlayedSong = sessionStorage.getItem(sessionStateManager.playingSong);
            if (lastPlayedSong) setCurrentSong(JSON.parse(lastPlayedSong) as SongType);
            else {
                setLoading('Fetching Song Data')
                const startTime = performance.now();
                const res = await apiService.getSong(currentSongId);
                if (res.song && res.song.notes) {
                    setCurrentSong(res.song);
                    setRecordingHighScore(res.song.highScore);
                    //cache song
                    sessionStorage.setItem(sessionStateManager.playingSong, JSON.stringify(res.song));

                    const endTime = performance.now();
                    await new Promise(resolve => setTimeout(resolve, minLoadingTime - endTime - startTime));
                    setLoading('');
                }
                else {
                    const endTime = performance.now();
                    await new Promise(resolve => setTimeout(resolve, minLoadingTime - endTime - startTime));
                    setLoading('');

                    //doesn't show bc missing global toaster
                    //eventually add specific err message derived from backend based on status codes here AND make sure the toaster can work
                    navigate('/dashboard', { state: { user: currentUser } })
                }
            }
        }
        loadSong();
    }, [currentUser, currentSongId])

    const deleteSong = async () => {
        if (currentSong === null) return;
        const deleteId = currentSong.song_id;
        const res = await apiService.deleteSong(deleteId)
        if (res.message) {
            //gets lost because there's no global toaster
            const songs = sessionStorage.getItem(sessionStateManager.songs);
            if (songs !== null) {
                const parsedSongs = JSON.parse(songs);
                const modifiedSongs = parsedSongs.filter((s: DashboardSong) => s.song_id !== deleteId);
                sessionStorage.setItem(sessionStateManager.songs, JSON.stringify(modifiedSongs));
                navigate('/dashboard', { state: { user: currentUser } })
            }
            else {
                throw new Error('Unable to update local memory')
            }
        }
        else {
            throw new Error(res.error);
        }
    }

    useEffect(() => {
        if (recordingPopupLoadingState === FINAL_RECORDING_LOADING_STATE && lastScoreData.score !== null) {
            (async () => {
                const startTime = performance.now();
                const res = await apiService.recordNewAttempt(
                    currentSong.song_id,
                    Math.round(((lastScoreData.score ?? 0) + Number.EPSILON) * 100) / 100
                )
                if (res.total_attempts) {
                    setLastScoreData(prev => ({
                        ...prev,
                        attempt_num: res.total_attempts,
                        id: res.entry_id
                    }));
                    setRecordingHighScore({
                        ...res.highScore,
                        //safe to do this bc we'll always get back a date bc the push of the new score happens
                        //b4 we process any high scores in app.py
                        date: new Date(res.highScore.date)
                    });
                    setCurrentSong(prev => ({ ...prev, total_attempts: res.total_attempts }));

                    const endTime = performance.now();
                    await new Promise(resolve => setTimeout(resolve, minLoadingTime - endTime - startTime));
                    setRecordingPopupLoadingState('');
                    setLockListView(false);
                }
                else {
                    mainToaster.add_message("Couldn't save attempt.")
                    const endTime = performance.now();
                    await new Promise(resolve => setTimeout(resolve, minLoadingTime - endTime - startTime));
                    setRecordingPopupLoadingState('');
                    setLockListView(false);
                }
            })();
        }
    }, [lastScoreData, recordingPopupLoadingState]);

    useEffect(() => {
        if (playbackState === 'playing') setLockListView(true)
    }, [playbackState])

    useEffect(() => setCurrentSong(prev => ({ ...prev, highScore: recordingHighScore })), [recordingHighScore])

    if (loading !== '' || currentSong === emptySongSettings.song) {
        return (
            <div className="loading-editor-container">
                <LoadingAsset mssg={loading} />
            </div>
        )
    }

    if (currentSong === null) return <></>

    return (
        <>
            <DeleteWarning
                showMssg={deleteModalOpen}
                setShowMssg={setDeleteModalOpen}
                mssg='Deleting this song will permanently remove it from your library. This action cannot be undone.'
                deleteProcess={deleteSong}
                deleteButtonMssg="Delete Song"
            />
            <ModalDialog
                disableOutsideClickClose
                content={
                    <RecordingScorePopup
                        highScoreData={recordingHighScore}
                        lastScoreData={lastScoreData}
                        setLastScoreData={setLastScoreData}
                        setHighScoreData={setRecordingHighScore}
                        loading={recordingPopupLoadingState}
                        setLoading={setRecordingPopupLoadingState}
                        listView={showPastRecordings}
                        setListView={setShowPastRecordings}
                        songId={currentSong.song_id}
                        toaster={mainToaster}
                    />
                }
                // open={true}
                open={
                    showPastRecordings ? true : recordingPopupLoadingState !== '' || lastScoreData.score !== null
                }
                setOpen={() => {
                    if (showPastRecordings) setShowPastRecordings(false);
                    setLastScoreData(prev => ({ ...prev, score: null }))
                }}
            />
            <div className="song-pg">
                <div className="dashboard shadowed top">
                    <ScrollingTitle title={currentSong.title.toUpperCase()} size={'min(10vw, 100px)'} color={'var(--tertiary-text)'} />
                    <div className="control-tab">
                        <Tooltip
                            mssg={'Go to Dashboard'}
                            minWidth={200}
                            content={
                                <div
                                    className="control-tab-svg"
                                    onClick={() => {
                                        navigate('/dashboard', { state: { user: currentUser } })
                                    }}
                                >
                                    <HiMiniHome />
                                </div>
                            }
                        />
                        <MusicEditorPlayer
                            playbackState={playbackState}
                            setPlaybackState={setPlaybackState}
                            notes={currentSong.notes}
                            time_sig={'4/4'}
                            cursor={cursor}
                            setCursor={setCursor}
                            errMessages={[]}
                            toaster={mainToaster}
                            metronome_enabled={true}
                            audio_recording_enabled={true}
                            instrument={currentSong.instrument}
                            setAnalysisLoadingState={setRecordingPopupLoadingState}
                            setLastRecordingScore={setLastScoreData}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Tooltip
                                mssg={'See Past Attempts'}
                                minWidth={200}
                                content={
                                    <div
                                        className={`control-tab-svg ${lockListView ? 'disabled' : ''}`}
                                        onClick={() => {
                                            if (lockListView) return;
                                            setShowPastRecordings(true)
                                        }}
                                    >
                                        <IoStatsChartSharp />
                                    </div>
                                }
                            />
                            <Tooltip
                                mssg={'Delete Song'}
                                minWidth={150}
                                bgColor="var(--err-colour)"
                                content={
                                    <div
                                        className="control-tab-svg"
                                        style={{
                                            backgroundColor: 'color-mix(var(--err-colour) 80%, white 20%)'
                                        }}
                                        onClick={() => setDeleteModalOpen(true)}
                                    >
                                        <FaTrash />
                                    </div>
                                }
                            />
                        </div>
                    </div>
                </div>
                <SongDisplay
                    notes={currentSong.notes}
                    cursor={cursor}
                    setCursor={setCursor}
                    instrument={currentSong.instrument}
                    stateManager={stateManager}
                    playbackState={playbackState}
                />
            </div>
        </>
    )

}

export default Song;