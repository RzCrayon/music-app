import { useLocation, useNavigate } from "react-router-dom";
import SheetMusic, { voiceColours } from "./SheetMusic/SheetMusicRenderer";
import './MusicEditor.css'
import MusicEditorPlayer from "./MusicEditorPlayer";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Clefs, DashboardSong, ErrMessage, Instruments, Note, PasswordlessUser, PlaybackState, Song, SongSetting, TimeSignatureString, Toaster as ToasterType } from "./services/types";
import { Toaster, useToaster } from "./components/Toaster";

import { TfiSave } from "react-icons/tfi";
import { RiFileUploadLine } from "react-icons/ri";
import { InstrumentPicker, instrumentPNGMap } from "./InstrumentPicker";
import { IoClose } from "react-icons/io5";
import { apiService } from "./services/api";
import LoadingAsset from "./LoadingAsset";
import Info, { Tooltip } from "./components/Info";
import Popup from "./components/Popup";
import Drawer from "./components/Drawer";
import { PiMagnifyingGlassBold } from "react-icons/pi";
import { FaMinus, FaPlus } from "react-icons/fa6";
import { DraggableScroll } from "./components/DraggableScroll";
import { IoIosArrowForward } from "react-icons/io";
import { AiOutlineExclamationCircle } from "react-icons/ai";
import { GoQuestion } from "react-icons/go";
import ModalDialog, { DeleteWarning } from "./components/ModalDialog";

import { set, get } from 'idb-keyval'
import { emptySongSettings } from "./Terminal";
import { useSheetMusicStateManager } from "./SheetMusic/sheetmusic_state_manager";
import { sessionStateManager } from "./services/session_state_manager";
import { find_used_parts } from "./SheetMusic/sheetmusic_processor";
import { ScrollingTitle } from "./Dashboard";
import InstructionsPanel from "./MusicEditorInstructions/MusicEditorInstructions";
import { useToasterContext } from "./main";

const Title = ({
    localSongSettings,
    setLocalSongSettings
}: {
    localSongSettings: SongSetting,
    setLocalSongSettings: Dispatch<SetStateAction<SongSetting>>
}) => {

    const [isHovering, setIsHovering] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div style={{ width: '100%', padding: '10px 20px' }}>
            <div
                className={`title-container ${isHovering && !isFocused ? 'highlight-bg' : ''} ${isFocused ? 'paused' : ''}`}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onClick={() => setIsFocused(true)}
            >
                <div
                    style={{
                        width: '100%',
                        minHeight: 'fit-content',
                        opacity: isFocused ? 0 : 1
                    }}
                >
                    <ScrollingTitle
                        title={localSongSettings.song.title.toUpperCase()}
                        size={'min(10vw, 100px)'}
                        color={!isHovering ? "var(--tertiary-text)" : 'rgba(255, 255, 255, 0.75)'}
                    />
                </div>
                <input
                    //prevents keyboard tabbing when hidden
                    tabIndex={isFocused ? 0 : -1}
                    onBlur={() => setIsFocused(false)}
                    style={{
                        fontSize: 'min(10vw, 100px)',
                        position: 'absolute',
                        opacity: isFocused ? 1 : 0,
                    }}
                    className={`editor-input`}
                    value={localSongSettings.song.title}
                    placeholder="Untitled Song"
                    onChange={(e) => {
                        setLocalSongSettings((prev) => ({
                            ...prev,
                            song: {
                                ...prev.song,
                                title: e.target.value,
                            },
                        }));
                    }}
                />
            </div>
        </div>
    );
}

function MusicEditor() {

    const mainToaster = useToasterContext();

    const location = useLocation();
    const navigate = useNavigate();

    const stickyToaster = useToaster();

    const stateManager = useSheetMusicStateManager(mainToaster);

    // const song_preview = location.state?.song_preview;
    const current_user = location.state?.current_user as PasswordlessUser;
    const editting = location.state?.editting || false;

    const screenRef = useRef<HTMLDivElement>(null);

    const [cursor, setCursor] = useState(0);
    const [localSongSettings, setLocalSongSettings] = useState<SongSetting>(() => {
        const songsCount = (JSON.parse(sessionStorage.getItem(sessionStateManager.songs) ?? '[]') as DashboardSong[]).length;
        return {
            ...emptySongSettings,
            song: { ...emptySongSettings.song, title: `Song (${songsCount})` }
        };
    });
    const songDataLoaded = useRef(false);

    const [errMessages, setErrMessages] = useState<ErrMessage[]>([]); //scroll pos is a percent
    const sheetMusicContainerRef = useRef<HTMLDivElement>(null);

    const [clefType, setClefType] = useState<Clefs>('Treble');
    const [time_sig, setTimeSig] = useState<TimeSignatureString>('4/4');

    const [loading, setLoading] = useState('');
    const minLoadingTime = 500;

    const instrumentIdx = useRef(0);
    const instrumentPickerRef = useRef<HTMLDivElement>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    const [refImgOpen, setRefImgOpen] = useState(localSongSettings.file !== null);
    const [imgScale, setImgScale] = useState(100);
    const maxScale = 300;
    const minScale = 100;
    const imgScaleAnimDur = 300; //ms
    const imgRef = useRef<HTMLImageElement>(null);
    const imgContainerRef = useRef<HTMLDivElement>(null);
    const [imgOverlayRect, setImgOverlayRect] = useState({ top: 0, left: 0 });
    const [imgLayoutRendered, setImgLayoutRendered] = useState(false);
    //has to be a ref so that it doesnt get reset on every rerender 
    const initImgRenderPassed = useRef(false);

    const save_mssg = editting ? 'Save Changes' : 'Add Song'

    const [errNotifExpand, setErrNotifExpand] = useState(false);

    const [collapseMap, setCollapseMap] = useState({
        save: false,
        cancel: false,
        imgRef: false,
    })

    const [dirPanelOpen, setDirPanelOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showCancelWarning, setShowCancelWarning] = useState(false);

    //stablising the setnotes func 
    const setNotes = useCallback((newNotes: SetStateAction<Note[]>) => {
        setLocalSongSettings(prev => ({
            ...prev,
            song: {
                ...prev.song,
                notes: typeof newNotes === 'function'
                    ? (newNotes as (prev: Note[]) => Note[])(prev.song.notes)
                    : newNotes
            }
        }));
    }, []);

    const [playbackState, setPlaybackState] = useState<PlaybackState>('paused');
    const togglePlayFunc = useRef<((play: boolean) => Promise<boolean>) | null>(null);
    const manuallyTogglePlay = useCallback(async (play: boolean) => {
        togglePlayFunc.current?.(play);
    }, []);
    const registerTogglePlayFunc = useCallback((toggleFunc: (play: boolean) => Promise<boolean>) => {
        togglePlayFunc.current = toggleFunc;
    }, []);

    const [cameFromTerminal, setCameFromTerminal] = useState(false);

    useEffect(() => {
        const loadSong = async () => {

            if (!current_user) {
                navigate('/');
                return;
            }

            const getTerminalSong = async () => {
                setLoading('Preparing editting environment');
                const renderedSong = await get(sessionStateManager.idbTerminalCurrSong) as SongSetting;
                //if we're using new data then clear out the old ref img
                await set(sessionStateManager.idbEditorSongImgRef, null);
                if (renderedSong && renderedSong.song.title !== emptySongSettings.song.title) {
                    setLocalSongSettings(renderedSong);
                    setCameFromTerminal(true);
                }
                else {
                    //forgo the init render if there's not a preloaded ref img which is guaranteed if we're coming from 
                    //the editor which is the only time that we would have a renderedSong
                    initImgRenderPassed.current = true;
                }
            }

            const startTime = performance.now();

            //if there's a saved version of the last song we were working on bc of some invalid exit then we'll get most 
            //of the song data form the sessionStorage, except for the img which has to be gotten from the idb... 

            //the rzn for 
            //this is that it's much easier to synchronise sessionStorage than it is to synchronise edits to the idb and 
            //while that works fine for the terminal where u aren't rly going in and editing the individual idb value a whole bunch
            //(only on rerenders) that doesn't work here bc we're consistently making changes to notes and so it's more dangerous to 
            //try and synchronise idb on every one of those changes... 
            //that being said it's impossible to retrieve the img from a string so we have to store the filepath in idb, but that's
            //okay bc the ref img is rarely ever changed and we can always default to the terminal's ref img if there's a race condition
            //between exit and save and it hasn't yet managed to save the last change 
            const lastEdit = sessionStorage.getItem(sessionStateManager.editorSong);
            if (lastEdit) {
                setLoading('Restoring session')
                const lastRefImg = await get(sessionStateManager.idbEditorSongImgRef); //will either come back as a file or as null
                const sessionSongData = JSON.parse(lastEdit);
                let newLocalSong = { ...localSongSettings }

                if (sessionSongData.instrument && sessionSongData.song) {
                    newLocalSong = {
                        ...newLocalSong,
                        song: sessionSongData.song as Song,
                        file: lastRefImg,
                    };
                    if (!lastRefImg) {
                        const renderedSong = await get(sessionStateManager.idbTerminalCurrSong) as SongSetting;
                        if (renderedSong && renderedSong.file) newLocalSong = { ...newLocalSong, file: renderedSong.file };
                        else {
                            //forgo the init render bc there isn't any img to render
                            initImgRenderPassed.current = true;
                        }
                    }
                    setLocalSongSettings(newLocalSong);
                }
                //default to the terminal song if there's no saved data
                else await getTerminalSong();
            }

            else await getTerminalSong();

            stateManager.initManager();
            const remainingTime = minLoadingTime - (performance.now() - startTime);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
            setLoading('');
            songDataLoaded.current = true;
        }
        loadSong();
    }, [current_user])

    useEffect(() => {

        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

        if (navigationEntries.length > 0 && navigationEntries[0].type === 'reload') {
            stateManager.clearManager();
        }

        const handle = () => {
            const newCollapseMap = { ...collapseMap };

            if (window.innerHeight < 675) newCollapseMap.imgRef = true;
            else newCollapseMap.imgRef = false;

            if (window.innerWidth < 725) {
                newCollapseMap.save = true;
                newCollapseMap.cancel = true;
            }
            else if (window.innerWidth < 950) {
                newCollapseMap.cancel = true;
            }
            else {
                newCollapseMap.save = false;
                newCollapseMap.cancel = false;
            }

            if (newCollapseMap.cancel !== collapseMap.cancel || newCollapseMap.save !== collapseMap.save || newCollapseMap.imgRef !== collapseMap.imgRef) {
                setCollapseMap(newCollapseMap);
            }

        }
        handle();
        window.addEventListener('resize', handle);
        return () => window.removeEventListener('resize', handle)
    }, []);

    useEffect(() => {
        if (collapseMap.imgRef) {
            setRefImgOpen(false);
        }
    }, [collapseMap.imgRef])

    //supposed to be used for zooming the img
    useEffect(() => {
        if (!imgRef.current || !imgContainerRef.current) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setImgScale((prevScale) => {
                    const wheelSpeed = 0.5
                    const delta = e.deltaY * wheelSpeed;
                    const newScale = Math.round(prevScale - delta)
                    if (newScale >= minScale && newScale <= maxScale) return newScale;
                    return prevScale;
                })
            }
        };

        imgContainerRef.current.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            if (imgContainerRef.current) imgContainerRef.current.removeEventListener('wheel', handleWheel);
        }
    }, [refImgOpen]);

    useEffect(() => {
        if (!songDataLoaded.current) return;
        sessionStorage.setItem(sessionStateManager.editorSong, JSON.stringify(
            { instrument: localSongSettings.song.instrument, song: localSongSettings.song }
        ))
    }, [localSongSettings])

    useEffect(() => {
        if (!songDataLoaded.current) return;
        //safe to use await here bc its one operation that on the higher end of data should take 150ms and it's okay to 
        //show the old img while the new one is being loaded in at 150ms... (that's lower than the min loading time so if it
        //was a loading screen it would literally just look like it was flickering)
        const changeRefImg = async () => await set(sessionStateManager.idbEditorSongImgRef, localSongSettings.file);
        changeRefImg();
    }, [localSongSettings.file])

    //some variable memoisation for optimisation 
    //do this to avoid calling URL.createobject 4 times 
    const fileUrl = useMemo(() => {
        if (!localSongSettings.file) return undefined;
        return URL.createObjectURL(localSongSettings.file);
    }, [localSongSettings.file])
    useEffect(() => {
        return () => {
            if (fileUrl) URL.revokeObjectURL(fileUrl);
        }
    }, [fileUrl])
    const usedParts = useMemo(() => find_used_parts(localSongSettings.song.notes), [localSongSettings.song.notes]);
    const currentInstrument = useMemo(() => (
        instrumentPNGMap.find(i => {
            return i.name === localSongSettings.song.instrument
        }) || instrumentPNGMap[0]
    ), [localSongSettings.song.instrument]);

    useEffect(() => {
        instrumentIdx.current = instrumentPNGMap.findIndex(i => i.name === localSongSettings.song.instrument);
    }, [localSongSettings.song.instrument]);

    useEffect(() => {

        if (loading || !localSongSettings.file) return;

        const imgEl = imgRef.current;
        if (!imgEl || !imgEl.parentElement) return;
        const scrollContainer = imgEl.parentElement;

        const reposImg = () => {
            if (!imgRef.current || !imgContainerRef.current) return;

            const parentBounds = imgContainerRef.current.getBoundingClientRect();
            const imgBounds = imgRef.current.getBoundingClientRect();

            //rounding to avoid floating point shifts from causing max-depth excession
            const newLeft = Math.round(imgBounds.left - parentBounds.left);
            const newTop = Math.round(imgBounds.top - parentBounds.top);

            //defer pos change to the next animation frame to avoid max-depth excession
            requestAnimationFrame(() => setImgOverlayRect(prev => {
                if (newLeft === prev.left && newTop === prev.top) return prev;
                else return { left: newLeft, top: newTop }
            }))
        }

        const handleLoad = () => {
            reposImg();
            setImgLayoutRendered(true);
            if (!initImgRenderPassed.current) {
                setRefImgOpen(!collapseMap.imgRef);
                initImgRenderPassed.current = true;
            }
        }

        reposImg();
        imgEl.addEventListener('load', handleLoad);
        scrollContainer.addEventListener('scroll', reposImg);

        return () => {
            imgEl.removeEventListener('load', handleLoad)
            scrollContainer.removeEventListener('scroll', reposImg)
        }
    }, [loading, localSongSettings.file])

    useEffect(() => {
        stickyToaster.clear_messages();
    }, [localSongSettings.song.notes])

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    }

    const save_changes = async () => {
        //here need to 
        stickyToaster.clear_messages();
        if (localSongSettings.song.notes.length === 0) {
            stickyToaster.add_message("Can't save a noteless song");
            return;
        }
        if (localSongSettings.song.title === '') {
            stickyToaster.add_message("Can't save without a title")
            return;
        }
        if (errMessages.length > 0) {
            if (errMessages.length > 10) stickyToaster.add_message(`... and ${errMessages.length - 10} more unresolved conflict${errMessages.length - 10 === 1 ? '' : 's'}.`)
            for (let i = 10; i >= 0; i--) {
                if (i >= errMessages.length) continue;
                stickyToaster.add_message(`Cannot save: ${errMessages[i].mssg}`)
            }
            scrollToErrs();
            return;
        }
        setLoading(`${!editting ? 'Adding' : 'Saving'} song`);
        const startTime = performance.now();
        try {
            const res = await apiService.addSong(
                localSongSettings.song.title,
                localSongSettings.song.notes,
                localSongSettings.song.instrument
            )
            if (res.song_id) {
                const currDashboardSongs = JSON.parse(sessionStorage.getItem(sessionStateManager.songs) ?? '[]') as DashboardSong[];
                currDashboardSongs.push({
                    title: localSongSettings.song.title,
                    song_id: res.song_id,
                    instrument: localSongSettings.song.instrument
                })
                sessionStorage.setItem(sessionStateManager.songs, JSON.stringify(currDashboardSongs));
                if (editting) {
                    mainToaster.add_message(`Changes saved.`, 'var(--success-colour)');
                }

                setLoading('Cleaning up and taking you home')
                sessionStorage.setItem(sessionStateManager.checkCurrSongOnReturnToDashboard, 'false');
                sessionStorage.setItem(sessionStateManager.editorSong, '');
                await set(sessionStateManager.idbEditorSongImgRef, null);
                await set(sessionStateManager.idbTerminalCurrSong, emptySongSettings);

                stateManager.releaseManager();
                const remainingTime = minLoadingTime - (performance.now() - startTime);
                await new Promise(resolve => setTimeout(resolve, remainingTime));
                navigate('/dashboard', { state: { user: current_user } })
            }
            else {
                console.log('Upload failed');
                stickyToaster.add_message('Upload failed');
                setLoading('');
            }
        }
        catch (err) {
            console.log('err', err);
            setLoading('');
            stickyToaster.add_message('Upload failed');
        }
    }

    const cancel = async () => {
        stateManager.releaseManager();
        sessionStorage.setItem(sessionStateManager.editorSong, '');
        await set(sessionStateManager.idbEditorSongImgRef, null);
        navigate('/dashboard', { state: { user: current_user } })
    }

    const scrollToErrs = () => {
        if (!sheetMusicContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = sheetMusicContainerRef.current;
        const maxScrollableDistance = scrollHeight - clientHeight;
        const currScrollPercentage = maxScrollableDistance > 0
            ? scrollTop / maxScrollableDistance
            : 0;

        const closest = errMessages.reduce((prev, curr) => {
            return Math.abs(curr.scrollPos - currScrollPercentage) < Math.abs(prev.scrollPos - currScrollPercentage) ? curr : prev;
        });

        const scrollPos = maxScrollableDistance * closest.scrollPos;

        sheetMusicContainerRef.current.scrollTo({
            top: scrollPos,
            behavior: 'smooth'
        })
    }

    if (loading !== '') return (
        <div className="loading-editor-container">
            <LoadingAsset mssg={loading} />
        </div>
    )

    if (!current_user) {
        return (
            <div className="loading-editor-container">
                <LoadingAsset mssg='Redirecting' loadingTimeout={10000} />
            </div>
        )
    }

    return (
        <div className="full-container" ref={screenRef}>
            <DeleteWarning
                showMssg={showCancelWarning}
                setShowMssg={setShowCancelWarning}
                //mssg will eventually change
                mssg={cameFromTerminal ? "Cancelling will take you back to the autobuilder and revert any changes you've made. This action can't be undone." : "Cancelling will discard all edits you've made so far."}
                deleteProcess={cancel}
                showCancel
                cancelMssg="No wait, I don't want that."
                deleteButtonMssg="Yep, that's okay."
            />
            <ModalDialog
                open={dirPanelOpen}
                setOpen={setDirPanelOpen}
                content={
                    <InstructionsPanel
                        open={dirPanelOpen}
                        setOpen={setDirPanelOpen}
                        notesLen={localSongSettings.song.notes.length}
                        refFile={localSongSettings.file}
                    />
                }
            />
            <Toaster toaster={stickyToaster} />
            <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                style={{ display: 'none' }}
                onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                        setLocalSongSettings({ ...localSongSettings, file: e.target.files[0] });
                        if (!localSongSettings.file) setRefImgOpen(true);
                    }
                    //reset the input value so the same file can be uploaded again
                    e.target.value = ''
                    //deselects the input after adding a file
                    e.target.blur();
                }}
            />
            <div className="sub-container">
                <div className="dashboard shadowed top" >
                    <Title
                        localSongSettings={localSongSettings}
                        setLocalSongSettings={setLocalSongSettings}
                    />
                    <div className="player-container">
                        <div className="player-wrapper">
                            <MusicEditorPlayer
                                playbackState={playbackState}
                                setPlaybackState={setPlaybackState}
                                notes={localSongSettings.song.notes}
                                time_sig={'4/4'}
                                cursor={cursor}
                                setCursor={setCursor}
                                errMessages={errMessages}
                                toaster={stickyToaster}
                                metronome_enabled={true}
                                audio_recording_enabled={false}
                                instrument={localSongSettings.song.instrument}
                                manuallyTogglePlay={registerTogglePlayFunc}
                            />
                        </div>
                    </div>
                    <div className="part-key">
                        {
                            Array.from(
                                { length: usedParts + 1 },
                                (_, partIdx) => {
                                    return (
                                        <div className="part-key-display" key={`part-${partIdx}`}>
                                            <div style={{ width: '20px', height: '20px', backgroundColor: voiceColours[partIdx], borderRadius: '5px' }} />
                                            {`Voice ${partIdx + 1}`}
                                        </div>
                                    );
                                }
                            )
                        }
                    </div>
                    {/* <div
                        className="dir-panel-trigger"
                        onClick={() => setDirPanelOpen(true)}
                    >
                        <GoQuestion />
                    </div> */}
                </div>
                <div
                    className="center-piece"
                    style={{ '--drawer-width': refImgOpen ? '500px' : '0px' } as React.CSSProperties}
                >
                    <div
                        className="sheet-music-wrapper"
                        ref={sheetMusicContainerRef}
                    >
                        {
                            localSongSettings.song.notes.length > 0 && (
                                <div
                                    className="instructions"
                                >
                                    Click any note to start editting.
                                </div>
                            )
                        }
                        {/* not worth memoising on its own bc there's too many dependencies and changes... thats y we memoise stuff inside of sheetmusic */}
                        <SheetMusic
                            playbackState={playbackState}
                            notes={localSongSettings.song.notes}
                            setNotes={setNotes}
                            clef={clefType}
                            setClef={setClefType}
                            time_sig={time_sig}
                            setTimeSig={setTimeSig}
                            cursor={cursor}
                            setCursor={setCursor}
                            setErrMessages={setErrMessages}
                            stateManager={stateManager}
                            instrument={localSongSettings.song.instrument}
                            wrapperRef={sheetMusicContainerRef}
                            cursorMusicPlaybackControlFunc={manuallyTogglePlay}
                            setInstrument={(newInstrument: Instruments) => {
                                setLocalSongSettings({
                                    ...localSongSettings, song: {
                                        ...localSongSettings.song,
                                        instrument: newInstrument
                                    }
                                })
                            }}
                            toaster={mainToaster}
                            editor
                        />
                    </div>
                    <Drawer
                        stickSide="left"
                        expansionSize={515}
                        open={refImgOpen}
                        bgColor={!localSongSettings.file ? 'color-mix(var(--err-colour) 85%, transparent 15%)' : "rgba(200, 200, 200, 0.75)"}
                        content={
                            <div className="editor-drawer">
                                <div
                                    ref={imgContainerRef}
                                    className="editor-interior"
                                >
                                    {localSongSettings.file ?
                                        (
                                            <>
                                                <DraggableScroll
                                                    zoomAmnt={imgScale}
                                                    scaleUpAnimDur={imgScaleAnimDur}
                                                    content={
                                                        <img
                                                            ref={imgRef}
                                                            style={{
                                                                width: `${imgScale}%`,
                                                                height: 'auto',
                                                                transition: `width ${imgScaleAnimDur / 1000}s ease`,
                                                                opacity: 0,
                                                            }}
                                                            src={fileUrl}
                                                        />
                                                    }
                                                />
                                                {imgLayoutRendered && (
                                                    <img
                                                        style={{
                                                            position: 'absolute',
                                                            width: `${imgScale * 0.84}%`,
                                                            transition: `width ${imgScaleAnimDur / 1000}s`,
                                                            willChange: 'top, left',
                                                            left: `${imgOverlayRect.left}px`,
                                                            top: `${imgOverlayRect.top}px`,
                                                            pointerEvents: 'none',
                                                        }}
                                                        src={fileUrl}
                                                    />
                                                )}
                                            </>
                                        ) : <div className="img-err">Unable to Render Preview Image</div>
                                    }
                                    <div className="upload-img-title">{localSongSettings.file?.name}</div>
                                    <div
                                        className="collapse-button"
                                        onClick={() => setRefImgOpen(false)}
                                    >
                                        <IoClose />
                                    </div>
                                    <div
                                        className="upload-container"
                                        onClick={() => triggerFileInput()}
                                    >
                                        <Tooltip
                                            mssg='Change Reference Image'
                                            minWidth={200}
                                            content={
                                                <RiFileUploadLine />
                                            }
                                        />
                                    </div>
                                    <div className="mag-button-group">
                                        <PiMagnifyingGlassBold className="mag" />
                                        <FaMinus
                                            className={imgScale <= minScale ? 'disabled' : ''}
                                            onClick={() => { if (imgScale > minScale) setImgScale(imgScale - 25) }}
                                        />
                                        {`${imgScale}%`}
                                        <FaPlus
                                            className={imgScale >= maxScale ? 'disabled' : ''}
                                            onClick={() => { if (imgScale < maxScale) setImgScale(imgScale + 25) }}
                                        />
                                    </div>

                                </div>
                            </div>
                        }
                    />
                    {
                        <div
                            className={`err-notif ${errMessages.length > 0 ? 'visible' : ''} ${errNotifExpand ? 'expanded' : ''}`}
                            onMouseEnter={() => setErrNotifExpand(true)}
                            onMouseLeave={() => setErrNotifExpand(false)}
                            onClick={scrollToErrs}
                        >
                            <AiOutlineExclamationCircle />
                            <span className="notif-txt">
                                Issues exist in sheetmusic
                                <span className="notif-txt sub">Click to take me there</span>
                            </span>
                        </div>
                    }
                </div>
                <div className="dashboard shadowed bottom">
                    <div className={`tool-group ${refImgOpen || collapseMap.imgRef ? 'ref-img-collapsed' : ''}`}>
                        <Tooltip
                            mssg={`${localSongSettings.file ? 'Show' : 'Add'} Reference Image`}
                            minWidth={200}
                            content={
                                <div
                                    className={`ref-img-selector-icon ${localSongSettings.file ? (refImgOpen || collapseMap.imgRef ? 'closed' : '') : 'add-ref'}`}
                                    onClick={() => {
                                        if (localSongSettings.file) setRefImgOpen(!refImgOpen)
                                        else triggerFileInput();
                                    }}
                                >
                                    {
                                        localSongSettings.file
                                            ? <img src={fileUrl} />
                                            : <RiFileUploadLine />
                                    }
                                </div>
                            }
                        />

                        <Tooltip
                            mssg={'Change Instrument'}
                            minWidth={150}
                            renderAllowed={!pickerOpen}
                            content={
                                <div
                                    className="instrument-selector-icon"
                                    ref={instrumentPickerRef}
                                    onClick={() => setPickerOpen(!pickerOpen)}
                                >
                                    <img src={currentInstrument.img} />
                                </div>
                            }
                        />
                        <Popup
                            x={(instrumentPickerRef.current?.getBoundingClientRect().left ?? 0) + (instrumentPickerRef.current?.getBoundingClientRect().width ?? 0) / 2}
                            y={instrumentPickerRef.current?.getBoundingClientRect().top ?? 0}
                            width={500}
                            height={270}
                            content={
                                <InstrumentPicker
                                    shadowed={false}
                                    instrument={localSongSettings.song.instrument}
                                    notes={localSongSettings.song.notes}
                                    setInstrument={(newInstrument, newNotes?: Note[]) =>
                                        setLocalSongSettings({
                                            ...localSongSettings, song: {
                                                ...localSongSettings.song,
                                                notes: newNotes || localSongSettings.song.notes,
                                                instrument: newInstrument
                                            }
                                        })
                                    }
                                    stateManager={stateManager}
                                />
                            }
                            visible={pickerOpen}
                            setVisible={setPickerOpen}
                            toaster={mainToaster}
                        />
                    </div>

                    <div className="editor-control-button-group">
                        <Tooltip
                            mssg="Leave Editor"
                            minWidth={200}
                            renderAllowed
                            content={
                                <div
                                    className={`build-button-editor cancel ${collapseMap.cancel ? 'collapsed' : ''}`}
                                    onClick={() => setShowCancelWarning(true)}
                                >
                                    {!collapseMap.cancel ? 'Cancel' : <IoClose />}
                                </div>
                            }
                        />
                        <Tooltip
                            mssg="Save Song to Dashboard"
                            minWidth={200}
                            renderAllowed={collapseMap.save}
                            content={
                                <div
                                    className={`build-button-editor 
                                        ${collapseMap.save ? 'collapsed' : ''}
                                        ${errMessages.length > 0 || localSongSettings.song.notes.length === 0 || localSongSettings.song.title === '' ? 'err' : ''}
                                        `}
                                    onClick={save_changes}
                                >
                                    <TfiSave />
                                    {!collapseMap.save ? save_mssg : ''}
                                </div>
                            }
                        />
                    </div>
                </div>
            </div>
        </div >
    )
}

export default MusicEditor;