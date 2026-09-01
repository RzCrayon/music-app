import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ErrMessage, Instruments, Note, ScoreData, Toaster } from "./services/types";
import { useSheetMusicPlayback } from "./SheetMusic/sheetmusic_playback";
import { destructure_time_sig } from "./SheetMusic/sheetmusic_processor"
import { SimpleSpinner } from "./LoadingAsset";
import './MusicPlayer.css'
import type { PlaybackState } from "./services/types";

import { FaPause } from "react-icons/fa6";
import { FaPlay } from "react-icons/fa6";
import { IoPlayBack } from "react-icons/io5";
import { PiMetronome } from "react-icons/pi";
import { FaVolumeMute } from "react-icons/fa";
import { FaVolumeLow } from "react-icons/fa6";
import { FaVolumeHigh } from "react-icons/fa6";
import { MdForward5 } from "react-icons/md";
import { MdReplay5 } from "react-icons/md";
import { HiOutlineMicrophone } from "react-icons/hi2";
import { formatTime } from "./components/Timer";
import { beats_to_sec } from "./services/recording_analyser2";
import type { NoteEventTime } from "@spotify/basic-pitch";
import { Tooltip } from "./components/Info";

export const FINAL_RECORDING_LOADING_STATE = 'Saving Attempt';

function MusicEditorPlayer({
    notes,
    time_sig,
    cursor,
    setCursor,
    errMessages,
    toaster,
    metronome_enabled,
    audio_recording_enabled,
    instrument,
    playbackState,
    setPlaybackState,
    blockPlayer,
    manuallyTriggerRestart,
    manuallyTogglePlay,
    setAnalysisLoadingState,
    setLastRecordingScore,
}: {
    notes: Note[],
    time_sig: string,
    cursor: number,
    setCursor: Dispatch<SetStateAction<number>>,
    errMessages: ErrMessage[],
    toaster: Toaster,
    metronome_enabled: boolean,
    audio_recording_enabled: boolean,
    instrument: Instruments,
    playbackState: PlaybackState,
    setPlaybackState: Dispatch<SetStateAction<PlaybackState>>,
    setAnalysisLoadingState?: Dispatch<SetStateAction<string>>,
    blockPlayer?: boolean,
    manuallyTriggerRestart?: (restartFunc: () => void) => void //callback func to trigger restarts manually from outside the musiceditoplayer, 
    manuallyTogglePlay?: (toggleFunc: (play: boolean) => Promise<boolean>) => void
    setLastRecordingScore?: Dispatch<SetStateAction<ScoreData>>,
}) {

    const [metronome, setMetronome] = useState(false);
    const [recording, setRecording] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [loading, setLoading] = useState(!!blockPlayer);

    const [displayMap, setDisplayMap] = useState({
        time: true,
        metronome: metronome_enabled,
        increments: true,
        volume: true,
        restart: true,
        audio_recording: audio_recording_enabled,
    })
    const [initSizeComplete, setInitSizeComplete] = useState(false);

    //the player will never be smaller than 80px because it has 40px padding left/right
    const cutoffWidths = [670, 540, 495, 365, 115, 80];
    const cutoffOrder = ['time', 'metronome', 'increments', 'volume', 'restart', 'audio_recording']

    const playerRef = useRef<HTMLDivElement>(null);

    const bpm = 120;

    const {
        play,
        pause,
        restart,
        rewind,
        play_forward,
        duration,
        lastRecordingRes,
    } = useSheetMusicPlayback({
        notes,
        instrument,
        bpm,
        beatsPerMeasure: destructure_time_sig(time_sig)?.numerator || 4,
        metronomeEnabled: metronome,
        volume,
        muted,
        recordingEnabled: recording,
        cursor,
        setCursor,
        playbackState,
        setPlaybackState,
        setAnalysisLoadingState,
    });

    useEffect(() => {
        return () => {
            setPlaybackState('paused');
        }
    }, [])

    useEffect(() => {
        if (lastRecordingRes !== null && setLastRecordingScore) {
            setLastRecordingScore(prev => ({
                ...prev,
                score: lastRecordingRes.score,
                date: new Date()
            }))
        }
    }, [lastRecordingRes?.id])

    useEffect(() => {
        manuallyTriggerRestart?.(restart);
        return () => manuallyTriggerRestart?.(() => { })
    }, [restart, manuallyTriggerRestart])

    useEffect(() => {
        manuallyTogglePlay?.(async (playSong: boolean) => {
            if (playSong) {
                await play();
                return true;
            }
            else pause();
            return true;
        })
        return () => manuallyTogglePlay?.(async () => false);
    }, [play, pause, manuallyTogglePlay]);

    useEffect(() => {
        if (playbackState === 'loading') {
            setLoading(true);
        }
        else {
            if (blockPlayer !== undefined) {
                setLoading(blockPlayer);
            }
            else setLoading(false);
        }
    }, [playbackState, blockPlayer])

    //useEffect fires after paint... the sizing scaling should happen before the screen is painted
    useLayoutEffect(() => {
        if (!playerRef.current) return;

        const getNewMapFromWidth = (width: number) => {
            const newMap = { ...displayMap };
            cutoffWidths.forEach((cutoff, idx) => {
                const val = cutoffOrder[idx];
                if (width <= cutoff) {
                    newMap[val as keyof typeof newMap] = false;
                } else if (val === 'metronome') {
                    newMap.metronome = metronome_enabled;
                } else if (val === 'audio_recording') {
                    newMap.audio_recording = audio_recording_enabled;
                } else {
                    newMap[val as keyof typeof newMap] = true;
                }
            });
            if (!initSizeComplete) setInitSizeComplete(true);
            return newMap;
        };

        const initialWidth = playerRef.current.getBoundingClientRect().width;
        if (initialWidth > 0) {
            setDisplayMap(getNewMapFromWidth(initialWidth));
        }

        //uses an observer so that if the musicplayer is contained in anything it can be calcualted correctly on first render
        //prevents sizing from being off on first render of musiceditor where it's inside the dashboard
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDisplayMap(getNewMapFromWidth(entry.contentRect.width));
            }
        });
        observer.observe(playerRef.current);

        return () => observer.disconnect();
    }, [metronome_enabled, audio_recording_enabled]);

    return (
        <div
            ref={playerRef}
            className="player"
            style={{ maxWidth: '100%', height: '65px' }}
        >
            {
                !initSizeComplete
                    ? <></>
                    : (
                        <>
                            {displayMap.volume && (
                                <div className="volume-container">
                                    {muted && (<FaVolumeMute onClick={() => setMuted(false)} />)}
                                    {!muted && (volume <= 0.5 ?
                                        <FaVolumeLow onClick={() => setMuted(true)} /> :
                                        <FaVolumeHigh onClick={() => setMuted(true)} />
                                    )}
                                    <input
                                        type='range'
                                        min='0'
                                        max='1'
                                        step='0.01'
                                        value={volume}
                                        onChange={(e) => {
                                            const new_volume = parseFloat(e.target.value)
                                            const prev_volume = volume;
                                            setVolume(new_volume);
                                            if (!new_volume) setMuted(true);
                                            if (prev_volume === 0 && new_volume !== 0) setMuted(false);
                                        }}
                                        className="volume-slider"
                                    />
                                </div>
                            )
                            }
                            {displayMap.restart && <IoPlayBack onClick={restart} />}
                            {displayMap.increments && (
                                <MdReplay5
                                    className={recording && playbackState === 'playing' ? 'disabled' : ''}
                                    onClick={() => { if (!(recording && playbackState === 'playing')) rewind() }}
                                />
                            )}
                            {
                                loading
                                    ? (
                                        <SimpleSpinner
                                            width={'25px'}
                                            height={'25px'}
                                            // loadingTimeout={Math.min(30000, 2000 + notes.length * 0.1)}
                                            //300,000 notes = 32,000 ms, capped at 30 sec
                                            timeoutMssg="Song took too long to render."
                                        />
                                    )
                                    : (
                                        <div
                                            onClick={() => {
                                                if (errMessages.length > 0) {
                                                    errMessages.forEach(message => toaster.add_message(`Cannot Render Music: ${message.mssg}`));
                                                    return;
                                                }
                                                playbackState === 'playing' ? pause() : play()
                                            }}
                                        >
                                            {playbackState !== 'playing' ? <FaPlay /> : <FaPause />}
                                        </div>
                                    )
                            }
                            {displayMap.increments && (
                                <MdForward5
                                    className={recording && playbackState === 'playing' ? 'disabled' : ''}
                                    onClick={() => { if (!(recording && playbackState === 'playing')) play_forward() }}
                                />
                            )}
                            {displayMap.time && (
                                <div style={{ fontSize: 'small', whiteSpace: 'nowrap' }}>
                                    {`${formatTime(beats_to_sec(cursor, bpm) * 1000)} / ${formatTime(beats_to_sec(duration, bpm) * 1000)}`}
                                </div>
                            )}
                            <div className="button-group">
                                {displayMap.metronome && (
                                    <PiMetronome
                                        className={`metronome ${metronome ? 'on' : ''}`}
                                        onClick={() => setMetronome(!metronome)}
                                    />
                                )}
                                {displayMap.audio_recording && (
                                    <Tooltip
                                        mssg={recording ? 'Turn off recording mode.' : 'Turn on recording mode.'}
                                        minWidth={200}
                                        content={
                                            <HiOutlineMicrophone
                                                className={`microphone ${playbackState === 'playing' && !recording ? 'disabled' : ''} ${recording ? 'on' : ''}`}
                                                //by disabling the ability to turn off the recorder mid playing we eliminate having to evalulate 
                                                //results mid play
                                                onClick={() => { if (playbackState !== 'playing') setRecording(!recording) }}
                                            />
                                        }
                                        renderAllowed={playbackState !== 'playing'}
                                    />
                                )}
                            </div>
                        </>
                    )
            }
        </div>
    )

}

export default MusicEditorPlayer;