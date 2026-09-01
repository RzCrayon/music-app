import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { apiService } from './services/api';
import './Dashboard.css'
import { emptySongSettings, Terminal2 } from './Terminal';
import type { DashboardSong, Instruments, Song, SongSetting, Toaster } from './services/types';

import { FaPlus } from "react-icons/fa";
import { HiOutlineUserCircle } from "react-icons/hi2";
import { IoMusicalNotesSharp } from "react-icons/io5";
import HeadphonesIcon from './assets/headphones.svg?react'
import { PiSignOutBold } from "react-icons/pi";

import { useLocation, useNavigate } from 'react-router-dom';
import LoadingAsset from './LoadingAsset';
import ModalDialog from './components/ModalDialog';
import Drawer from './components/Drawer';

import { get, set } from 'idb-keyval'
import { sessionStateManager } from './services/session_state_manager';
import { instrumentPNGMap } from './InstrumentPicker';
import FallbackErrDisplay from './FallbackErrDisplay';
import { useToasterContext } from './main';

const ScrollingTitle = React.memo(function ScrollingTitle({
  title,
  size,
  color,
  isPaused
}: {
  title: string,
  size: string | null,
  color?: string
  isPaused?: boolean,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.clientWidth > containerRef.current.clientWidth);
      }
    }
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow)
  }, [title, size])

  const textStyle = {
    fontSize: size ? size : undefined,
    color: color,
    // Using 2em means the gap perfectly scales to be 2x whatever the font size resolves to
    paddingRight: isOverflowing ? '1.5em' : undefined
  };

  return (
    <div
      ref={containerRef}
      className={`scroll-window ${isOverflowing ? 'can-scroll' : 'no-scroll'} ${isPaused ? 'paused-reset' : ''}`}
    >
      <span ref={textRef} className='scrolling-text' style={textStyle}>{title}</span>
      {isOverflowing && <span className='scrolling-text' style={textStyle}>{title}</span>}
    </div>
  )
})

function Dashboard() {

  const mainToaster = useToasterContext();

  const location = useLocation();
  const navigate = useNavigate();

  const [songs, setSongs] = useState<DashboardSong[]>([]);
  const [loading, setLoading] = useState('');

  const currentUser = location.state?.user || null;

  const [shadowDashboard, setShadowDashboard] = useState(false)
  const [terminalOpen, setTerminal] = useState(false);
  const [derivedSong, setDerivedSong] = useState(emptySongSettings)
  const [terminalPrevOpen, setTerminalPrevOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);

  const minLoadingTime = 500;

  const loadDashboardData = async () => {
    //the real retrieval happens during login
    const usersSongs = sessionStorage.getItem(sessionStateManager.songs);
    if (!usersSongs) {
      const startTime = performance.now();
      setLoading('Retrieving your songs');
      const res = await apiService.getUserDashboard()
      if (res.songs.length > 0) {
        setSongs(res.songs);
      }
      else {
        setSongs([])
        sessionStorage.setItem(sessionStateManager.songs, '[]');
      }
      const endTime = performance.now();
      const timeSpinnerWasVisible = endTime - startTime;
      const remainingTime = minLoadingTime - timeSpinnerWasVisible;
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      setLoading('');
    }
    else setSongs(JSON.parse(usersSongs))
  }

  const loadCurrSong = async () => {
    const startTime = performance.now();
    setLoading('Restoring session');
    const savedSong = await get(sessionStateManager.idbTerminalCurrSong);
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (savedSong) {
      setDerivedSong(savedSong as SongSetting);
      if (savedSong.song.notes.length > 0) setTerminal(true);
    }
    else {
      //toaster.add_message('Session restoration failed');
    }

    const endTime = performance.now();
    const timeSpinnerWasVisible = endTime - startTime;
    const remainingTime = minLoadingTime - timeSpinnerWasVisible;

    //make sure the spinner lasts for at least 1 second if it's been started 
    await new Promise(resolve => setTimeout(resolve, remainingTime));
    setLoading('')
  }

  useLayoutEffect(() => {
    //dont let someone access the dashboard if not a user
    if (!currentUser) {
      navigate('/');
      return;
    }
    //load the dashboard's songs immediately
    loadDashboardData();

    const checkSong = sessionStorage.getItem(sessionStateManager.checkCurrSongOnReturnToDashboard)
    if (checkSong === 'true') loadCurrSong();
  }, [currentUser]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setShadowDashboard(true);
      }
      else {
        setShadowDashboard(false);
      }
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setTerminalPrevOpen(terminalOpen);
  }, [terminalOpen])

  const UsernameDisplay = ({ color }: { color?: string }) => (
    <div
      className='user'
      style={{ color }}
      onClick={(e) => {
        e.stopPropagation();
        setUserSettingsOpen(!userSettingsOpen)
      }}
    >
      <HiOutlineUserCircle size={50} style={{ flexShrink: 0 }} />
      <span
        className='username-text'
      >{currentUser.username}</span>
    </div>
  )

  if (loading !== '' || !currentUser) return (
    <div className="loading-container-dashboard">
      <LoadingAsset mssg={loading} />
    </div>
  )

  return (
    <div className={`dashboard-wrapper-song-container`}>
      <div
        className={`dashboard ${shadowDashboard ? 'shadowed' : ''}`}
        onClick={() => setUserSettingsOpen(false)}
      >
        <UsernameDisplay />
        {songs.length > 0 &&
          (
            <div
              className='add-button'
              onClick={() => setTerminal(true)}
            >
              Add Music
              <FaPlus />
            </div>
          )
        }
      </div>
      {
        songs.length === 0
          ? (
            <div
              className='empty-dashboard'
              onClick={() => setUserSettingsOpen(false)}
            >
              <HeadphonesIcon style={{ color: 'var(--tertiary-text)', width: '100%', aspectRatio: 1 }} />
              <div className='text'>{"Our dashboard's looking a little quiet. \nLet's fix that by adding your favourite songs"}</div>
              <div
                className='add-button'
                onClick={() => setTerminal(true)}
              >
                Add Music
                <FaPlus />
              </div>
            </div>
          )
          : (
            <div
              className='song-container'
              onClick={() => setUserSettingsOpen(false)}
            >
              {songs.map((song) => {
                const instrument = instrumentPNGMap.find(i => i.name === song.instrument as Instruments)?.img;
                return (
                  <div
                    className='song-pad'
                    key={song.song_id}
                    onClick={async () => {
                      const lastPlayedSong = sessionStorage.getItem(sessionStateManager.playingSong);
                      //if we're reopening the same song just go to the play screen without unchaching the last cached song
                      if (lastPlayedSong && (JSON.parse(lastPlayedSong) as Song).song_id === song.song_id) {
                        navigate('/play', { state: { user: currentUser, song_id: song.song_id } });
                      }
                      else {
                        //clear the last played song and then go to the play screen to avoid rendering the same song
                        sessionStorage.removeItem(sessionStateManager.playingSong);
                        navigate('/play', { state: { user: currentUser, song_id: song.song_id } });
                      }
                    }}
                  >
                    <ScrollingTitle title={song.title} size={null} />
                    <div className={`trophy-border`}>
                      {
                        instrument ?
                          <img src={instrument} />
                          : <IoMusicalNotesSharp />
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          )
      }
      {/* need terminalPrevOpen to signal when a close is requested by the terminal
          so that it's caught and the terminal close isn't immediately closed before warning */}
      <ModalDialog
        bg_color='rgba(0, 0, 0, 0.7)'
        open={terminalOpen}
        setOpen={setTerminalPrevOpen}
        content={
          <Terminal2
            currentUser={currentUser}
            song={derivedSong}
            terminalOpen={terminalOpen}
            terminalPrevOpen={terminalPrevOpen}
            setTerminalOpen={setTerminal}
            setTerminalPrevOpen={setTerminalPrevOpen}
            mainToaster={mainToaster}
          />
        }
      />
      <Drawer
        stickSide='left'
        expansionSize={450}
        open={userSettingsOpen}
        sticky
        content={
          <div
            style={{
              display: 'flex',
              height: '100%',
              width: '100%',
              justifyContent: 'space-between',
              flexDirection: 'column',
              padding: '40px 40px',
              fontSize: 'larger',
            }}
          >
            <div style={{ marginTop: '18px' }}>
              <UsernameDisplay color='var(--primary-text)' />
            </div>
            <div
              className='sign-out-button'
              onClick={() => apiService.logoutUser()}
            >
              <PiSignOutBold />
              Sign Out
            </div>
          </div>
        }
      />
    </div>
  )
}

export { ScrollingTitle, Dashboard }