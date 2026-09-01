import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import { apiService } from "./services/api"
import './Terminal.css'
import './LoginPg.css'
import { type SongSetting, type Instruments, type Toaster, type PasswordlessUser, type DashboardSong, type Note, type PlaybackState } from "./services/types";
import { useNavigate } from 'react-router-dom';

import { RiFileUploadLine } from "react-icons/ri";
import { RiRobot2Fill } from "react-icons/ri";
import { TbEdit } from "react-icons/tb";
import { BsFileEarmarkMusicFill } from "react-icons/bs";
import LoadingAsset from "./LoadingAsset";
import { InstrumentPicker } from "./InstrumentPicker";
import AudioWaveform from "./components/AudioWaveform";
import { formatTime } from "./components/Timer";
import { beats_to_sec } from "./services/recording_analyser2";
import Info from "./components/Info";
import ModalDialog, { DeleteWarning } from "./components/ModalDialog";
import MusicEditorPlayer from "./MusicEditorPlayer";
import ErrDisplay from "./ErrDisplay";

import { set } from 'idb-keyval';
import { GoQuestion } from "react-icons/go";
import { sessionStateManager } from "./services/session_state_manager";
import { find_used_parts } from "./SheetMusic/sheetmusic_processor";
import { VOICE_LIMITS } from "./SheetMusic/NoteEditorPopupNoteDisplay";

/*
The terminal is rendered as open in the dashboard if:
    - someone clicks on the add song button
    - there's a navigation back to the dashboard with song data 
The terminal then loads into a specific section based on the song data sent back
    - if the song data is an empty {} that means someone cancelled a manual build and the 
      terminal will load to the option selection stage
    - if the song data is populated that means someone either saved an auto build or cancelled an auto build 
      in any case it needs to load to the post render auto build stage (with the edit, add and rebuild buttons)
    
*/

type PreviewData = { extracted_notes: Note[], suggested_title: string, quality: string };

const getUniqueTitle = (title: string, existingSongs: DashboardSong[]) => {
    const suffixRegex = /\s*\(\d+\)$/

    const cleanTitle = title.replace(suffixRegex, "").trim();

    const matches = existingSongs.filter(song => {
        const otherClean = song.title.replace(suffixRegex, "").trim();
        return otherClean.toLowerCase() === cleanTitle.toLowerCase();
    });

    if (matches.length === 0) return title;

    return `${cleanTitle} (${matches.length})`;
}

export const emptySongSettings: SongSetting = {
    file: null,
    song: {
        song_id: 0,
        title: '',
        audio_url: '',
        highScore: {
            score: null,
            date: null,
            attempt_num: null,
            id: -1,
        },
        notes: [],
        instrument: 'piano',
        total_attempts: 0,
    },
}

type AutoBuilderState = -1 | 1 | 2

const AutoBuilderSetUpSxn = ({
    currSong,
    setCurrSong,
    err,
    renderPreview,
    setErr,
    setAutoBuilderStage,
    mainToaster,
}: {
    currSong: SongSetting,
    setCurrSong: Dispatch<SetStateAction<SongSetting>>
    err: string,
    renderPreview: () => void,
    setErr: Dispatch<SetStateAction<string>>
    setAutoBuilderStage: Dispatch<SetStateAction<AutoBuilderState>>,
    mainToaster: Toaster,
}) => (
    <>
        <input
            placeholder="Untitled Song"
            style={{ marginBottom: '20px' }}
            value={currSong.song.title}
            onChange={(e) => setCurrSong({ ...currSong, song: { ...currSong.song, title: e.target.value } })}
        />
        <input
            id='sheet-music-upload'
            type='file'
            accept='image/*'
            style={{ display: 'none' }}
            onChange={async (e) => {
                const maxSize = 16 * 1024 * 1024;
                if (e.target.files) {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > maxSize) {
                        mainToaster.add_message('File exceeds the 16MB limit.');
                        e.target.value = '';
                        return;
                    }
                    setCurrSong({ ...currSong, file: e.target.files[0] })
                    setErr('');
                }
                //reset the input value so the same file can be uploaded again
                e.target.value = ''
                //deselects the input after adding a file
                e.target.blur();
            }}
        />
        <label
            //label is used to replace the input above by using the right id
            htmlFor='sheet-music-upload'
            className={`auto-builder-setup-img-uploader ${currSong.file ? 'img' : ''} ${err !== '' ? 'err' : ''}`}
        >
            {!currSong.file
                ? (
                    <>
                        <RiFileUploadLine />
                        Upload a new song
                    </>
                )
                : (
                    <>
                        <RiFileUploadLine />
                        <img src={URL.createObjectURL(currSong.file)} />
                        <div className="auto-builder-setup-img-uploader-notif">Click to change</div>
                    </>
                )
            }
        </label>
        <ErrDisplay err={err} />
        <InstrumentPicker
            instrument={currSong.song.instrument}
            setInstrument={(new_instrument: Instruments) =>
                setCurrSong({ ...currSong, song: { ...currSong.song, instrument: new_instrument } })
            }
        />
        <div
            onClick={renderPreview}
            className={`auto-builder-setup-button ${!currSong.song.instrument || !currSong.file ? 'disabled' : ''}`}
        >Build my Song</div>
        <div
            onClick={() => {
                setErr('');
                if (currSong.song.notes.length === 0) {
                    // setWarningModalOpen(true);
                    setAutoBuilderStage(-1)
                    setCurrSong(emptySongSettings);
                }
                else {
                    setAutoBuilderStage(2);
                }
            }}
            className="auto-builder-setup-button"
        >{currSong.song.notes.length > 0 ? 'Cancel Rerender' : 'Cancel Build'}</div>
    </>
)

const MusicPlayerDisplay = ({
    currSong,
    toaster,
    displayMap,
    restartPlayerRef,
    qual_measure
}: {
    currSong: SongSetting,
    toaster: Toaster
    displayMap: { waveform: boolean, metadata: boolean },
    restartPlayerRef: React.RefObject<(() => void) | null>,
    qual_measure: string,
}) => {

    const [currBeat, setCurrBeat] = useState(0);
    const [waveFormLoaded, setWaveFormLoaded] = useState(false);

    let durs = new Map<number, number>(); //<part, dur>
    for (const note of currSong.song.notes) {
        const curr_part_dur = durs.get(note.part) ?? 0;
        durs.set(note.part, curr_part_dur + note.duration);
    }

    const data = {
        'Extracted Notes': currSong.song.notes.length,
        'Parts Found': new Set(currSong.song.notes.map(note => note.part)).size,
        'Est. Song Duration (120bpm)': formatTime(beats_to_sec(Math.max(...[...durs.values()]), 120) * 1000),
    }

    const [playbackState, setPlaybackState] = useState<PlaybackState>('paused')

    return (
        <>
            {displayMap.waveform && (
                <div className="terminal-wave-form-wrapper">
                    <AudioWaveform
                        currBeat={currBeat}
                        bpm={120}
                        notes={currSong.song.notes}
                        setLoaded={setWaveFormLoaded}
                    />
                </div>
            )}
            <div className="terminal-music-player-wrapper">
                <MusicEditorPlayer
                    playbackState={playbackState}
                    setPlaybackState={setPlaybackState}
                    notes={currSong.song.notes}
                    time_sig={'4/4'}
                    cursor={currBeat}
                    setCursor={setCurrBeat}
                    toaster={toaster}
                    errMessages={[]}
                    metronome_enabled={false}
                    audio_recording_enabled={false}
                    blockPlayer={!waveFormLoaded}
                    instrument={currSong.song.instrument}
                    manuallyTriggerRestart={(restartFunc) => restartPlayerRef.current = restartFunc}
                />
            </div>
            {
                displayMap.metadata && (
                    <div
                        className="song-meta-data"
                        style={{
                            backgroundColor: data["Extracted Notes"] == 0 ? 'var(--err-colour)' : undefined
                        }}
                    >
                        <div style={{
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px',
                            fontWeight: 'bolder',
                        }}>
                            Extracted Song Data:
                        </div>
                        {
                            Object.entries(data).map((entry, idx) => (
                                <div key={idx}>{`${entry[0]}: ${entry[1]}`}</div>
                            ))
                        }
                        <div className="meta-data-extraction-qual">
                            {`Extraction Quality: ${qual_measure}`}
                            <Info
                                mssg={'This score reflects how much cleanup was needed to fix timing gaps, not how confident we are the notes and pitches are correct.'}
                                minWidth={300}
                            />
                        </div>
                    </div>
                )
            }
        </>
    )
}

const AutoBuilderPostRenderSxn = ({
    terminalOpen,
    loading,
    setAutoBuilderStage,
    setErr,
    currSong,
    currentUser,
    setCurrSong,
    autoBuilderStage,
    toaster,
    warningModalOpen,
    setWarningModalOpen,
    setTerminalPrevOpen,
    setTerminalOpen,
    terminalPrevOpen,
    abortRenderingProcess,
    idbQueueRef,
    voiceLimitWarningModalOpen,
    setVoiceLimitWarningModalOpen,
    previewData,
    setLoading,
    setPreviewData,
    updateSongWithPreviewData,
    lastExtractionQuality
}: {
    terminalOpen: boolean,
    loading: string,
    setAutoBuilderStage: Dispatch<SetStateAction<AutoBuilderState>>
    setErr: Dispatch<SetStateAction<string>>
    currSong: SongSetting,
    currentUser: PasswordlessUser,
    setCurrSong: Dispatch<SetStateAction<SongSetting>>
    autoBuilderStage: AutoBuilderState,
    toaster: Toaster,
    warningModalOpen: boolean,
    setWarningModalOpen: Dispatch<SetStateAction<boolean>>,
    setTerminalPrevOpen: Dispatch<SetStateAction<boolean>>,
    setTerminalOpen: Dispatch<SetStateAction<boolean>>,
    terminalPrevOpen: boolean,
    abortRenderingProcess: () => void,
    idbQueueRef: RefObject<Promise<any>>,
    voiceLimitWarningModalOpen: boolean,
    setVoiceLimitWarningModalOpen: Dispatch<SetStateAction<boolean>>,
    previewData: PreviewData | null,
    setLoading: Dispatch<SetStateAction<string>>
    setPreviewData: Dispatch<SetStateAction<PreviewData | null>>,
    updateSongWithPreviewData: (previewData: PreviewData) => void,
    lastExtractionQuality: null | string,
}) => {

    const [disclaimerOpen, setDisclaimerOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const [displayMap, setDisplayMap] = useState({ waveform: true, metadata: true });

    const navigate = useNavigate();

    //taking the loading dependency out of here so that the disclaimer only shows if u return from cancel on sheetmusicrenderer
    useEffect(() => {
        if (!terminalOpen) setDisclaimerOpen(false)
        else if (autoBuilderStage === 2 && !loading) setDisclaimerOpen(true);
    }, [terminalOpen, autoBuilderStage])

    useLayoutEffect(() => {
        const manageDisplayMap = () => {
            if (!loading && containerRef.current) {
                setDisplayMap({
                    waveform: containerRef.current.clientHeight > 695,
                    metadata: containerRef.current.clientHeight > 395,
                })
            }
        }
        manageDisplayMap();
        window.addEventListener('resize', manageDisplayMap);
        return () => window.removeEventListener('resize', manageDisplayMap);
    }, [loading])

    const getVoiceLimitWarningMssg = (previewData: PreviewData) => {
        const parts = find_used_parts(previewData.extracted_notes) + 1;
        const supported_parts = VOICE_LIMITS[currSong.song.instrument];
        return `Extracted ${parts} voice${parts !== 1 ? 's' : ''} from the sheetmusic, but ${currSong.song.instrument} only supports ${supported_parts} voice${supported_parts !== 1 ? 's' : ''}. To render this sheetmusic for ${currSong.song.instrument}, the extra voices will just be dropped in the final render.`
    }

    const restartPlayerRef = useRef<(() => void) | null>(null);
    const manuallyTriggerRestart = () => {
        restartPlayerRef.current?.();
    }

    return (
        <>
            <ModalDialog
                open={disclaimerOpen}
                setOpen={setDisclaimerOpen}
                disableOutsideClickClose={true}
                content={
                    <div className="auto-builder-post-render-disclaimer">
                        <div className="text-block">
                            <span className='text-title'>Automatted Scanning Can Sometimes Skip a Beat</span>
                            <span className='text-emphasis' style={{ marginTop: '20px' }}>If the results don't sound perfect:</span>
                            {"Try re-uploading a clearer image or tweaking the song manually in the Song Builder."}
                            <br /><br />
                            <span className='text-emphasis'>If everything sounds great:</span>
                            {"Continue onto the Song Builder for a quick final review and to add the song to your dashboard."}
                        </div>
                        <div
                            className="disclaimer-button"
                            onClick={() => setDisclaimerOpen(false)}
                        >Got it</div>
                    </div>
                }
            />

            <div className={`terminal-loader-container ${loading !== '' ? '' : 'closed'}`}>
                {loading !== '' && (
                    <LoadingAsset
                        loadingTimeout={20000}
                        mssg={loading}
                        timeoutMssg="Process timed out: Failed to render song preview."
                        timeoutAxn={() => {
                            abortRenderingProcess();
                            setAutoBuilderStage(1)
                            setErr('');
                        }}
                        triggerPageCrash={false}
                        cancelTimeoutWatcher={!!previewData} //preview data has smth it should cancel the timeout
                    />
                )}
                <div className="loading-disclaimer-wrapper">
                    <div className="auto-builder-post-render-disclaimer">
                        <div className="text-block">
                            <span className='text-title'>Automatted Scanning Can Sometimes Skip a Beat</span>
                            <span className='text-emphasis' style={{ marginTop: '20px' }}>If the results don't sound perfect:</span>
                            {"Try re-uploading a clearer image or tweaking the song manually in the Song Builder."}
                            <br /><br />
                            <span className='text-emphasis'>If everything sounds great:</span>
                            {"Continue onto the Song Builder for a quick final review and to add the song to your dashboard. "}
                            <span style={{ fontSize: 'small', fontWeight: 'bold', color: 'color-mix(black 10%, var(--tertiary-text) 90%)' }}>Scan Powered by Audiveris</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className={`on-load-cancel-render ${loading !== '' ? '' : 'closed'}`}
                onClick={() => {
                    abortRenderingProcess();
                    setAutoBuilderStage(1)
                    setErr('');
                }}
            >Cancel Render</div>

            <div
                className={`non-loader-container ${loading !== '' ? 'closed' : ''}`}
                ref={containerRef}
            >
                <div
                    className="auto-builder-post-render-disclaimer-trigger"
                    onClick={() => setDisclaimerOpen(true)}
                >
                    {currSong.song.title || "Untitled Song"}
                    <GoQuestion />
                </div>
                <MusicPlayerDisplay
                    currSong={currSong}
                    toaster={toaster}
                    displayMap={displayMap}
                    restartPlayerRef={restartPlayerRef}
                    qual_measure={lastExtractionQuality ?? 'Unavailable'}
                />
                <div
                    onClick={async () => {
                        await idbQueueRef.current //needed to avoid race condition of idb not being updated by the time we enter song builder 
                        navigate('/edit', { state: { current_user: currentUser, } })
                    }}
                    className={`auto-builder-post-render-button continue ${!currSong.song.instrument || !currSong.file ? 'disabled' : ''}`}
                >Continue to Song Builder</div>
                <div
                    onClick={() => {
                        manuallyTriggerRestart();
                        setAutoBuilderStage(1)
                    }}
                    className="auto-builder-post-render-button"
                >Rerender Song</div>
                <div
                    onClick={() => setWarningModalOpen(true)}
                    className="auto-builder-post-render-button"
                >Cancel Build</div>
                <DeleteWarning
                    showMssg={warningModalOpen}
                    setShowMssg={setWarningModalOpen}
                    handleClose={() => {
                        setTerminalPrevOpen(true)
                    }}
                    mssg={'Cancelling your build will discard all data associated with this render. This action cannot be undone.'}
                    deleteProcess={() => {
                        setAutoBuilderStage(-1)
                        setCurrSong(emptySongSettings);
                        if (!terminalPrevOpen) setTerminalOpen(false);
                    }}
                    deleteButtonMssg={"Cancel Build"}
                />
                <DeleteWarning
                    showMssg={voiceLimitWarningModalOpen}
                    setShowMssg={setVoiceLimitWarningModalOpen}
                    mssg={
                        previewData
                            ? (() => getVoiceLimitWarningMssg(previewData))()
                            : `Extracted an incompatible number of voices for ${currSong.song.instrument}. Any voices above ${VOICE_LIMITS[currSong.song.instrument]} will be discarded in the final render.`
                    }
                    deleteProcess={() => {
                        if (previewData) updateSongWithPreviewData(previewData);
                        setPreviewData(null);
                        setLoading('')
                    }} //move on to the next step
                    handleClose={() => setLoading('')}
                    deleteButtonMssg="All Good, Finish Render"
                    showCancel
                    cancel={() => {
                        setAutoBuilderStage(1);
                        setPreviewData(null);
                        setLoading('');
                    }}
                    cancelMssg={`No wait, don't render in ${currSong.song.instrument}`}
                    disableCloseOptions={{
                        outside: true,
                        closeButton: true,
                    }}
                />
            </div>
        </>
    )
}

export function Terminal2({
    currentUser,
    song,
    terminalOpen,
    setTerminalOpen,
    terminalPrevOpen,
    setTerminalPrevOpen,
    mainToaster,
}: {
    currentUser: PasswordlessUser,
    song: SongSetting,
    terminalOpen: boolean,
    setTerminalOpen: Dispatch<SetStateAction<boolean>>,
    terminalPrevOpen: boolean,
    setTerminalPrevOpen: Dispatch<SetStateAction<boolean>>,
    mainToaster: Toaster
}) {

    /* 
        not using session storage anymore bc it's unable to handle images across rerenders
        now using indexed data base storage
        - the song is only ever explicitly cleared from the idb on user sign out
        - otherwise always either a song or an empty song
        - it should only elevate to a nonempty state when the loading goes thru and .notes > 0
        - on cancel render closes (with warning message) it needs to force a de-elevation to an emtpy state
        - the states are kept in check by a setting watcher that waits until the new data is passed into idb to be turned off and clear for the new data
        - in the editor the currSong and the idb's state are independent so any changes done while editting don't affect the last saved version
        - on coming into the terminal if the song has smth in it that isn't emptySongSetting that means one of 2 things... 
            - either an unsanctioned close of the terminal due to cnnxn issues or reload
            - or we're coming back from an editor 
            - these are the only two endpoints where the currSong / localStorage (which are linked here) aren't set to emptySongSettings 
    */

    const [currSong, setCurrSong] = useState<SongSetting>(song);
    const [lastExtractionQuality, setLastExtractionQuality] = useState<null | string>(null)
    const currSongRef = useRef<SongSetting>(currSong);

    const [autoBuilderStage, setAutoBuilderStage] = useState<AutoBuilderState>(currSong.song.notes.length > 0 ? 2 : -1);
    const [err, setErr] = useState('');

    const [loading, setLoading] = useState('');
    const loadingRef = useRef('');

    const [warningModalOpen, setWarningModalOpen] = useState(false);
    const [voiceLimitWarningModalOpen, setVoiceLimitWarningModalOpen] = useState(false);
    const [firstRenderExecuted, setFirstRenderExecuted] = useState(false);
    const [screenScrolling, setScreenScrolling] = useState(false);

    const [previewData, setPreviewData] = useState<PreviewData | null>(null);

    const currentBatchId = useRef(0);
    const idbQueueRef = useRef(Promise.resolve());

    const navigate = useNavigate();

    const optionsRef = useRef<HTMLDivElement>(null);
    const autoBuilderSetupRef = useRef<HTMLDivElement>(null);
    const autoBuilderPostRendererRef = useRef<HTMLDivElement>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const abortRenderingProcess = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading('');
        }
    }

    const updateSongWithPreviewData = (previewData: PreviewData) => {
        const filteredSong = previewData.extracted_notes.filter(note => note.part + 1 <= VOICE_LIMITS[currSong.song.instrument]);
        const existingSongs = JSON.parse(sessionStorage.getItem(sessionStateManager.songs) ?? '[]') as DashboardSong[];
        setCurrSong(prev => ({
            ...prev,
            song: {
                ...prev.song,
                notes: previewData.extracted_notes.filter(note => note.part + 1 <= VOICE_LIMITS[currSong.song.instrument]),
                title: currSong.song.title
                    ? getUniqueTitle(currSong.song.title, existingSongs)
                    : getUniqueTitle(previewData.suggested_title, existingSongs)
            }
        }))
        setLastExtractionQuality(previewData.quality);
    }

    const renderPreview = async () => {
        if (!currSong.file) {
            mainToaster.add_message('ERR: No Reference Image Provided');
            setErr('Reference Image Required')
            return;
        }

        //set up the abort controller before going into the processing
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading('Building your song');
        setAutoBuilderStage(2);

        try {
            const previewData = await apiService.createSongPreview(currSong.file, currSong.song.instrument, setLoading, controller.signal);
            if (previewData.extracted_notes) {
                //needs find used parts + 1 bc find used parts returns a 0 indexed number
                if (find_used_parts(previewData.extracted_notes) + 1 > VOICE_LIMITS[currSong.song.instrument]) {
                    setVoiceLimitWarningModalOpen(true);
                    setPreviewData(previewData);
                }
                else {
                    updateSongWithPreviewData(previewData);
                    setLoading('');
                }
            }
            else {
                if (previewData.cancelled) {
                    mainToaster.add_message('OMR Scan Abortted', 'color-mix(brown 30%, var(--warning-colour) 70%)')
                }
                else {
                    //update to real err mssg w real feedback from OMR eventually
                    setErr("Couldn't extract notes: Image could be incompatible.")
                }
                setAutoBuilderStage(1);
                setLoading('');
            }
        }
        catch (err) {
            setAutoBuilderStage(1);
            console.log('err', err);
            let errMssg = ''
            if (err === 'Failed to load reference file') errMssg = err;
            mainToaster.add_message(`ERR: Failed to Save Scan Data ${errMssg !== '' ? `(${errMssg})` : ''}`)
            setLoading('');
        }
        finally {
            //clear the abort controller so that we know the process is done
            abortControllerRef.current.abort();
        }
    }

    useEffect(() => {
        //protects against the warning popping up on the first render if the song coming in has data 
        //(either coming from the editor or a internet cnnxn issue or refresh of the page)
        if (!firstRenderExecuted) return;
        if (!terminalPrevOpen) {
            //using the ref here allows us to remove it from the deps array which means that if the 
            //modal has been opened any change to the song later on will not trigger a reopen
            if (currSongRef.current.song.notes.length > 0 || loadingRef.current) {
                setWarningModalOpen(true);
            }
            else setTerminalOpen(false);
        }
    }, [terminalPrevOpen, firstRenderExecuted])

    useEffect(() => {
        currSongRef.current = currSong;
    }, [currSong])

    useEffect(() => {
        loadingRef.current = loading;
    }, [loading])

    useEffect(() => {
        if (!terminalOpen) {
            //cleanly abort the rendering process if it's still going thru
            abortRenderingProcess();
            setCurrSong(emptySongSettings)
            setAutoBuilderStage(-1);
        };
    }, [terminalOpen])

    useEffect(() => {
        setFirstRenderExecuted(true);
    }, [])

    const queueIdbWrite = (data: SongSetting) => {
        const isEmpty = data === emptySongSettings;
        if (isEmpty) {
            //incrementing this immediately invalidates all previous pending .then() blocks
            currentBatchId.current += 1;
            //puts the empty write right after the currently executing await 
            idbQueueRef.current = idbQueueRef.current
                .catch(() => { })
                .then(async () => {
                    await set(sessionStateManager.idbTerminalCurrSong, data);
                });
            return;
        }
        const myBatchId = currentBatchId.current;
        idbQueueRef.current = idbQueueRef.current
            .catch(() => { })
            .then(async () => {
                //if currentBatchId changed while this was waiting in line, it means a reset was triggered... that means remove this await from the queue
                if (myBatchId !== currentBatchId.current) {
                    return;
                }
                await set(sessionStateManager.idbTerminalCurrSong, data);
            });
    };

    useEffect(() => {
        //this useEffect will only trigger either when the notes change 
        //(meaning a new song comes thru or it changed from empty to nonempty or nonempty to empty) 
        //all of which should trigger a reupload to the db

        //this'll only tell the dashboard to check the song if the song at the last point of update had notes (was a viable song)
        //it's safe to check this only at point of updating the song's notes because the song's notes are the data we want to recover and if 
        //the user has already compromised them themselves then we don't need to check it
        sessionStorage.setItem(sessionStateManager.checkCurrSongOnReturnToDashboard, `${currSong.song.notes.length > 0}`);
        queueIdbWrite(currSong);

    }, [currSong.song.notes])

    useEffect(() => {
        const handleResize = (resizeTriggered: boolean = true) => {
            if (autoBuilderStage === -1 && optionsRef.current) {
                const el = optionsRef.current;
                const scroller = el.scrollHeight > el.clientHeight;
                setScreenScrolling(scroller);
                if (scroller && !resizeTriggered) el.scrollTop = 0;
            }
            if (autoBuilderStage === 1 && autoBuilderSetupRef.current) {
                const el = autoBuilderSetupRef.current;
                const scroller = el.scrollHeight > el.clientHeight;
                setScreenScrolling(scroller);
                if (scroller && !resizeTriggered) el.scrollTop = 0;
            }
            if (autoBuilderStage === 2) {
                setScreenScrolling(false);
            }
        }
        handleResize(false);
        window.addEventListener('resize', () => handleResize());
        return () => window.removeEventListener('resize', () => handleResize());
    }, [autoBuilderStage, terminalOpen])

    const TerminalOptionsSxn = () => (
        <>
            <div
                className={`terminal-option`}
                onClick={() => navigate('/edit', { state: { current_user: currentUser, } })}
            >
                <span>Build with Song Builder</span>
                <TbEdit />
            </div>
            <div
                className="terminal-option"
                onClick={() => setAutoBuilderStage(1)}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span>Render with Auto Builder </span>
                    <span style={{ fontSize: 'small', opacity: 0.8 }}>Powered by Audiveris</span>
                </div>
                <RiRobot2Fill />
                <div className="testing-tag">BETA</div>
            </div>
            {/* <div
                className="terminal-option"
            >
                <span>Import Song File</span>
                <BsFileEarmarkMusicFill />
                <div className="testing-tag">COMING SOON</div>
            </div> */}
        </>
    )

    return (
        <>
            <div
                className={`terminal  ${screenScrolling ? 'scroll' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className={`options ${screenScrolling ? 'scroller' : ''} ${autoBuilderStage.toString()}`}
                    ref={optionsRef}
                >
                    <TerminalOptionsSxn />
                </div>
                <div
                    className={`auto-builder-setup ${screenScrolling ? 'scroller' : ''} ${autoBuilderStage.toString()}`}
                    ref={autoBuilderSetupRef}
                >
                    <AutoBuilderSetUpSxn
                        currSong={currSong}
                        setCurrSong={setCurrSong}
                        err={err}
                        setErr={setErr}
                        renderPreview={renderPreview}
                        setAutoBuilderStage={setAutoBuilderStage}
                        mainToaster={mainToaster}
                    />
                </div>
                <div
                    className={`auto-builder-post-render ${autoBuilderStage.toString()}`}
                    ref={autoBuilderPostRendererRef}
                >
                    <AutoBuilderPostRenderSxn
                        terminalOpen={terminalOpen}
                        loading={loading}
                        setAutoBuilderStage={setAutoBuilderStage}
                        setErr={setErr}
                        currSong={currSong}
                        currentUser={currentUser}
                        setCurrSong={setCurrSong}
                        autoBuilderStage={autoBuilderStage}
                        toaster={mainToaster}
                        warningModalOpen={warningModalOpen}
                        setWarningModalOpen={setWarningModalOpen}
                        setTerminalPrevOpen={setTerminalPrevOpen}
                        terminalPrevOpen={terminalPrevOpen}
                        setTerminalOpen={setTerminalOpen}
                        abortRenderingProcess={abortRenderingProcess}
                        idbQueueRef={idbQueueRef}
                        voiceLimitWarningModalOpen={voiceLimitWarningModalOpen}
                        setVoiceLimitWarningModalOpen={setVoiceLimitWarningModalOpen}
                        previewData={previewData}
                        setLoading={setLoading}
                        setPreviewData={setPreviewData}
                        updateSongWithPreviewData={updateSongWithPreviewData}
                        lastExtractionQuality={lastExtractionQuality}
                    />
                </div>
            </div>
            {/* </div> */}
        </>
    )
}