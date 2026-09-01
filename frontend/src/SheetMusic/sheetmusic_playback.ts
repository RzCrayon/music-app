import { useRef, useState, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import * as Tone from "tone";
import type { Instruments, Note } from "../services/types";
import type { NoteEventTime } from "@spotify/basic-pitch";
import { beats_to_sec } from "../services/recording_analyser2";
import { useAudioRecorder } from "../services/audio_recording_sys";
import { runAudioAnalysis } from "../services/recording_analyser2";
import type { PlaybackState } from "../services/types";


// Matches your backend INSTRUMENT_MAP intent
//you can assume that the notes that are mapped here are the only notes this instrument can play (i.e. a guitar can not play a0)
const SAMPLER_URLS: Record<Instruments, { urls: Record<string, string>; baseUrl: string }> = {
  piano: {
    urls: {
      A1: "A1.mp3", A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
      A6: "A6.mp3", A7: "A7.mp3", "A#1": "As1.mp3", Bb1: "As1.mp3", "A#2": "As2.mp3",
      Bb2: "As2.mp3", "A#3": "As3.mp3", Bb3: "As3.mp3", "A#4": "As4.mp3", Bb4: "As4.mp3",
      "A#5": "As5.mp3", Bb5: "As5.mp3", "A#6": "As6.mp3", Bb6: "As6.mp3", "A#7": "As7.mp3",
      Bb7: "As7.mp3", B1: "B1.mp3", B2: "B2.mp3", B3: "B3.mp3", B4: "B4.mp3",
      B5: "B5.mp3", B6: "B6.mp3", B7: "B7.mp3", C1: "C1.mp3", C2: "C2.mp3",
      C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3", C7: "C7.mp3",
      C8: "C8.mp3", "C#1": "Cs1.mp3", Db1: "Cs1.mp3", "C#2": "Cs2.mp3", Db2: "Cs2.mp3",
      "C#3": "Cs3.mp3", Db3: "Cs3.mp3", "C#4": "Cs4.mp3", Db4: "Cs4.mp3", "C#5": "Cs5.mp3",
      Db5: "Cs5.mp3", "C#6": "Cs6.mp3", Db6: "Cs6.mp3", "C#7": "Cs7.mp3", Db7: "Cs7.mp3",
      D1: "D1.mp3", D2: "D2.mp3", D3: "D3.mp3", D4: "D4.mp3", D5: "D5.mp3",
      D6: "D6.mp3", D7: "D7.mp3", "D#1": "Ds1.mp3", Eb1: "Ds1.mp3", "D#2": "Ds2.mp3",
      Eb2: "Ds2.mp3", "D#3": "Ds3.mp3", Eb3: "Ds3.mp3", "D#4": "Ds4.mp3", Eb4: "Ds4.mp3",
      "D#5": "Ds5.mp3", Eb5: "Ds5.mp3", "D#6": "Ds6.mp3", Eb6: "Ds6.mp3", "D#7": "Ds7.mp3",
      Eb7: "Ds7.mp3", E1: "E1.mp3", E2: "E2.mp3", E3: "E3.mp3", E4: "E4.mp3",
      E5: "E5.mp3", E6: "E6.mp3", E7: "E7.mp3", F1: "F1.mp3", F2: "F2.mp3",
      F3: "F3.mp3", F4: "F4.mp3", F5: "F5.mp3", F6: "F6.mp3", F7: "F7.mp3",
      "F#1": "Fs1.mp3", Gb1: "Fs1.mp3", "F#2": "Fs2.mp3", Gb2: "Fs2.mp3", "F#3": "Fs3.mp3",
      Gb3: "Fs3.mp3", "F#4": "Fs4.mp3", Gb4: "Fs4.mp3", "F#5": "Fs5.mp3", Gb5: "Fs5.mp3",
      "F#6": "Fs6.mp3", Gb6: "Fs6.mp3", "F#7": "Fs7.mp3", Gb7: "Fs7.mp3", G1: "G1.mp3",
      G2: "G2.mp3", G3: "G3.mp3", G4: "G4.mp3", G5: "G5.mp3", G6: "G6.mp3",
      G7: "G7.mp3", "G#1": "Gs1.mp3", Ab1: "Gs1.mp3", "G#2": "Gs2.mp3", Ab2: "Gs2.mp3",
      "G#3": "Gs3.mp3", Ab3: "Gs3.mp3", "G#4": "Gs4.mp3", Ab4: "Gs4.mp3", "G#5": "Gs5.mp3",
      Ab5: "Gs5.mp3", "G#6": "Gs6.mp3", Ab6: "Gs6.mp3", "G#7": "Gs7.mp3", Ab7: "Gs7.mp3",
    },
    baseUrl: "/samples/piano/",
  },
  guitar: {
    urls: {
      A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", "A#2": "As2.mp3", Bb2: "As2.mp3",
      "A#3": "As3.mp3", Bb3: "As3.mp3", "A#4": "As4.mp3", Bb4: "As4.mp3", B2: "B2.mp3",
      B3: "B3.mp3", B4: "B4.mp3", C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3",
      "C#3": "Cs3.mp3", Db3: "Cs3.mp3", "C#4": "Cs4.mp3", Db4: "Cs4.mp3", "C#5": "Cs5.mp3",
      Db5: "Cs5.mp3", D2: "D2.mp3", D3: "D3.mp3", D4: "D4.mp3", D5: "D5.mp3",
      "D#2": "Ds2.mp3", Eb2: "Ds2.mp3", "D#3": "Ds3.mp3", Eb3: "Ds3.mp3", "D#4": "Ds4.mp3",
      Eb4: "Ds4.mp3", E2: "E2.mp3", E3: "E3.mp3", E4: "E4.mp3", F2: "F2.mp3",
      F3: "F3.mp3", F4: "F4.mp3", "F#2": "Fs2.mp3", Gb2: "Fs2.mp3", "F#3": "Fs3.mp3",
      Gb3: "Fs3.mp3", "F#4": "Fs4.mp3", Gb4: "Fs4.mp3", G2: "G2.mp3", G3: "G3.mp3",
      G4: "G4.mp3", "G#2": "Gs2.mp3", Ab2: "Gs2.mp3", "G#3": "Gs3.mp3", Ab3: "Gs3.mp3",
      "G#4": "Gs4.mp3", Ab4: "Gs4.mp3",
    },
    baseUrl: "/samples/guitar-acoustic/",
  },
  trumpet: {
    urls: {
      A3: "A3.mp3", A5: "A5.mp3", "A#4": "As4.mp3", Bb4: "As4.mp3", C4: "C4.mp3",
      C6: "C6.mp3", D5: "D5.mp3", "D#4": "Ds4.mp3", Eb4: "Ds4.mp3", F3: "F3.mp3",
      F4: "F4.mp3", F5: "F5.mp3", G4: "G4.mp3",
    },
    baseUrl: "/samples/trumpet/",
  },
  viola: {
    urls: {},
    baseUrl: 'https://tonejs.github.io/audio/viola/'
  },
  violin: {
    urls: {},
    baseUrl: 'https://tonejs.github.io/audio/viola/'
  },
  cello: {
    urls: {},
    baseUrl: 'https://tonejs.github.io/audio/viola/'
  },
  flute: {
    urls: {},
    baseUrl: 'https://tonejs.github.io/audio/viola/'
  },
  saxophone: {
    urls: {},
    baseUrl: 'https://tonejs.github.io/audio/viola/'
  }
};


function buildMetronomeEvents(
  totalBeats: number,
  beatsPerMeasure: number
): Array<{ time: number; isStrong: boolean }> {
  const events: Array<{ time: number; isStrong: boolean }> = [];
  for (let beat = 0; beat < Math.ceil(totalBeats) + beatsPerMeasure; beat++) {
    events.push({
      time: beat,
      isStrong: beat % beatsPerMeasure === 0,
    });
  }
  return events;
}


interface UseSheetMusicPlaybackOptions {
  notes: Note[];
  instrument: Instruments;
  bpm?: number;
  beatsPerMeasure?: number; //time sig numerator
  metronomeEnabled?: boolean;
  volume: number;
  muted: boolean;
  recordingEnabled: boolean,
  cursor: number,
  setCursor: Dispatch<SetStateAction<number>>
  playbackState: PlaybackState,
  setPlaybackState: Dispatch<SetStateAction<PlaybackState>>
  setAnalysisLoadingState?: Dispatch<SetStateAction<string>>
}

interface UseSheetMusicPlaybackReturn {
  play: () => Promise<void>;
  pause: () => void;
  restart: () => void;
  rewind: () => void;
  play_forward: () => void;
  duration: number, //comes back in beats
  lastRecordingRes: { score: number, id: number } | null,
}

export function useSheetMusicPlayback({
  notes,
  instrument,
  bpm = 120,
  beatsPerMeasure = 4,
  metronomeEnabled = true,
  volume,
  muted,
  recordingEnabled,
  cursor,
  setCursor,
  playbackState,
  setPlaybackState,
  setAnalysisLoadingState,
}: UseSheetMusicPlaybackOptions): UseSheetMusicPlaybackReturn {
  // const [playbackState, setPlaybackState] = useState<PlaybackState>("paused");
  // const [currentBeat, setCurrentBeat] = useState(0);
  const [duration, setDuration] = useState(0);

  //keep tone objects in refs to survive rerenders
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const metroPartRef = useRef<Tone.Part | null>(null);
  const metroSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const loadedInstrumentRef = useRef<Instruments | null>(null);
  const needsRebuildRef = useRef(true);
  const lastBeatRef = useRef(0);
  const didMountRef = useRef(false);

  const prevRecordingEnabledRef = useRef(recordingEnabled);

  // in useSheetMusicPlayback
  const [lastRecordingRes, setLastRes] = useState<{ score: number, id: number } | null>(null);
  const recordingIdRef = useRef(0);

  const audio_recorder = useAudioRecorder();

  const cursorRef = useRef(0);
  const lastPushedCursorRef = useRef(0);
  const playbackStateRef = useRef<PlaybackState>("paused");

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  //unmount cleanup
  useEffect(() => {
    return () => {
      disposeAll();
    };
  }, []);

  const skipCursorSyncValueRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      skipCursorSyncValueRef.current !== null &&
      Math.abs(skipCursorSyncValueRef.current - cursor) < 1e-6
    ) {
      skipCursorSyncValueRef.current = null;
      return;
    }
    skipCursorSyncValueRef.current = null;
    //skip to a real number not to the next note 
    cursorRef.current = cursor;
  }, [cursor]);

  function disposeAll() {
    partRef.current?.dispose();
    metroPartRef.current?.dispose();
    metroSynthRef.current?.dispose();
    stopBeatTracker();
    partRef.current = null;
    metroPartRef.current = null;
  }

  function stopBeatTracker() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }

  function startBeatTracker(totalBeats: number) {
    stopBeatTracker();

    const dragThreshold = 0.05; //smaller than the 0.1 playback smoothing treshold 

    const tick = async () => {
      const externalDrift = Math.abs(cursorRef.current - lastPushedCursorRef.current);

      if (externalDrift >= dragThreshold) {
        //has the cursor been dragged since last set 
        if (playbackStateRef.current === "playing") {
          seekTo(beats_to_sec(cursorRef.current, bpm));
        } else {
          //just increments the seconds on the backend 
          lastBeatRef.current = cursorRef.current;
          lastPushedCursorRef.current = cursorRef.current;
          Tone.getTransport().seconds = beats_to_sec(cursorRef.current, bpm);
        }
      } else {
        //snap the cursor to follow the playback
        const beat = Tone.getTransport().ticks / Tone.getTransport().PPQ;
        if (Math.abs(beat - lastBeatRef.current) >= 0.1) {
          lastBeatRef.current = beat;
          lastPushedCursorRef.current = beat;
          cursorRef.current = beat;
          skipCursorSyncValueRef.current = lastBeatRef.current;
          setCursor(lastBeatRef.current);
        }
      }

      //need the check for playbackstateref.current because it'll trigger a restart if we try and move the cursor past the end of the song
      //and don't have that 
      if (lastBeatRef.current > totalBeats + beatsPerMeasure && Tone.getTransport().state === 'started') {
        await restart();
        return;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }

  // Lazily load sampler only when instrument changes
  async function ensureSamplerLoaded(): Promise<Tone.Sampler> {
    if (samplerRef.current && loadedInstrumentRef.current === instrument) {
      return samplerRef.current;
    }

    // Dispose old sampler if switching instruments
    samplerRef.current?.dispose();
    samplerRef.current = null;

    const config = SAMPLER_URLS[instrument];
    const sampler = new Tone.Sampler({
      urls: config.urls,
      baseUrl: config.baseUrl,
    }).toDestination();

    await Tone.loaded(); // wait for all buffers
    samplerRef.current = sampler;
    loadedInstrumentRef.current = instrument;
    return sampler;
  }

  const build = async () => {

    //ABSOLUTELY NECESSARY IF U DELETE THIS EVERYTHING BREAKS...
    //the rzn is that u shouldn't be allowed to render an empty song and because we wait on the idb feedback 
    //we render an empty song in the meantime and by the time the feedback comes in and we render that then we 
    //get stuck with two songs which screws everything up 
    if (notes.length === 0) return;

    setPlaybackState("loading");

    const times = new Set<number>();

    try {
      const sampler = await ensureSamplerLoaded();

      //cleanup previous render
      disposeAll();

      Tone.getTransport().bpm.value = bpm;
      Tone.getTransport().stop();
      //fix to avoid that one random note that plays at the beginning for no good reason
      Tone.getTransport().cancel(0) //flush anything already committed by an old play
      samplerRef.current?.releaseAll();
      Tone.getTransport().position = 0;

      const noteEvents = notes
        .filter((n) => n.type === 'chord' || n.type === "note")
        .flatMap((n) => {
          if (n.type === "rest") return [];
          // offset and duration are in quarter-note beats
          const startSec = beats_to_sec(n.offset, bpm);
          const durSec = beats_to_sec(n.duration, bpm);
          return n.pitches.map((pitch) => ({
            time: startSec,
            pitch: pitch.pitch.includes('-') ? pitch.pitch.replace('-', 'b') : pitch.pitch,
            duration: durSec,
          }));
        });

      const totalBeats = notes.reduce(
        (max, n) => Math.max(max, n.offset + n.duration),
        0
      );
      setDuration(totalBeats);

      const part = new Tone.Part((time, event) => {
        sampler.triggerAttackRelease(event.pitch, event.duration, time);
      }, noteEvents);

      part.start(0);
      partRef.current = part;

      const metroSynth = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      }).toDestination();
      metroSynth.volume.value = metronomeEnabled ? 0 : -Infinity;
      metroSynthRef.current = metroSynth;

      const metroEvents = buildMetronomeEvents(totalBeats, beatsPerMeasure).map(
        (e) => {
          let time = beats_to_sec(e.time, bpm);
          while (times.has(time)) {
            time += 0.001;
          }
          times.add(time);
          return {
            time,
            isStrong: e.isStrong,
          }
        }
      ).filter((e, i, arr) => i === 0 || e.time > arr[i - 1].time);

      const metroPart = new Tone.Part((time, event) => {
        metroSynth.triggerAttackRelease(
          event.isStrong ? "C2" : "C3",
          "16n",
          time,
          event.isStrong ? 0.8 : 0.4
        );
      }, metroEvents);
      metroPart.start(0);
      metroPartRef.current = metroPart;

      startBeatTracker(totalBeats)
      needsRebuildRef.current = false;
      setPlaybackState('paused') //primed but doesn't trigger a play unless the user has pressed the play button

    } catch (err) {
      console.error("Playback error:", err);
      setPlaybackState("paused");
    }
  }

  // useEffect(() => {
  //   build();
  // }, [])

  //prevents playing on dep change
  useEffect(() => {
    if (!didMountRef.current) {
      // initial mount already handled by the effect above
      didMountRef.current = true;
      return;
    }

    const wasPlaying = playbackState === "playing";

    (async () => {
      Tone.getTransport().pause();
      needsRebuildRef.current = true;
      await build(); //resumes at lastBeatRef.current internally & sets state to paused so we dont have to here\

      seekToResumeBeat(); //NEEDED, otherwise after the rebuild from having changed notes will reset the cursor back to 0
      if (wasPlaying) {
        seekToResumeBeat();
        Tone.getTransport().start();
        setPlaybackState("playing");
      }
    })();
  }, [notes, bpm, beatsPerMeasure, instrument]);

  useEffect(() => {
    if (!metroSynthRef.current) return;
    metroSynthRef.current.volume.value = metronomeEnabled ? 0 : -Infinity;
  }, [metronomeEnabled]);

  useEffect(() => {
    if (!samplerRef.current) return;
    if (muted) samplerRef.current.volume.value = -Infinity;
    else samplerRef.current.volume.value = Tone.gainToDb(volume);
  }, [muted, volume])

  useEffect(() => {
    //if the recorder is turned off at any point... stop the recording there and analyse the audio
    //dw about if the recorder is turned off while not playing bc the audio_recording_sys handles that case in its func
    const wasRecording = prevRecordingEnabledRef.current;
    prevRecordingEnabledRef.current = recordingEnabled;

    if (wasRecording && !recordingEnabled) {
      (async () => { await getRecordingRes() })();
    }
  }, [recordingEnabled])

  const play = useCallback(async () => {
    //prevent double-play
    if (playbackState === "playing") return;

    //resume from pause
    if (playbackState === "paused") {
      if (needsRebuildRef.current) {
        await build();
      }
      if (recordingEnabled) {
        //if we're starting from being actually paused
        if (audio_recorder.getState() === 'paused') {
          audio_recorder.resume_recording();
        }
        //if we're starting from being paused due to restart
        else if (audio_recorder.getState() === 'inactive') {
          await audio_recorder.start_recording();
        }
      }
      //always make sure that on pressing play that the cursor pos ref here is linked immediately 
      lastBeatRef.current = cursorRef.current;
      lastPushedCursorRef.current = cursorRef.current;

      seekToResumeBeat();
      Tone.getTransport().start();
      setPlaybackState("playing");
    }
  }, [notes, instrument, bpm, beatsPerMeasure, playbackState, recordingEnabled]);

  const pause = useCallback(() => {
    if (playbackState !== "playing") return;
    Tone.getTransport().pause();
    setPlaybackState("paused");
    if (recordingEnabled) audio_recorder.pause_recording();
  }, [playbackState, recordingEnabled]);

  const restart = useCallback(async () => {
    Tone.getTransport().stop();

    partRef.current?.cancel(0);
    partRef.current?.start(0);
    metroPartRef.current?.cancel(0);
    metroPartRef.current?.start(0);
    samplerRef.current?.releaseAll();

    Tone.getTransport().position = 0;
    lastBeatRef.current = 0;
    lastPushedCursorRef.current = 0;

    cursorRef.current = 0;

    skipCursorSyncValueRef.current = lastBeatRef.current;
    setCursor(0);

    setPlaybackState("paused");

    //because no longer rebuilds on every restart nothing triggers the beat tracker 
    //restart so we have to do it here manually
    stopBeatTracker();
    const totalBeats = notes.reduce((max, n) => Math.max(max, n.offset + n.duration), 0);
    startBeatTracker(totalBeats);

    //this here will calculate both at manual restart and end of song bc restart is automatically called
    await getRecordingRes();
  }, [recordingEnabled, notes, bpm]);

  const getRecordingRes = async () => {
    if (audio_recorder.getState() === 'inactive') return; //no recording was underway
    //needs the try here bc of the rejection
    try {
      const recorded_audio_url = await audio_recorder.stop_recording();
      if (recorded_audio_url && setAnalysisLoadingState) {
        // inside getRecordingRes
        const res = await runAudioAnalysis(recorded_audio_url, notes, bpm, 0, setAnalysisLoadingState);
        //needs the recordingidref bc if we get the same exact res lastres still needs to update 
        setLastRes({ score: res, id: ++recordingIdRef.current });
      }
    }
    catch {
      //recorder wasn't active
    }
  }

  //increment controls
  //need this function so that it can clear all previous scheduled actions before
  //editing the seconds
  const seekTo = useCallback((newSeconds: number) => {
    const clamped = Math.max(0, newSeconds);

    samplerRef.current?.releaseAll();
    Tone.getTransport().cancel(Tone.getTransport().seconds);
    Tone.getTransport().seconds = clamped;

    partRef.current?.cancel(0);
    partRef.current?.start(0);
    metroPartRef.current?.cancel(0);
    metroPartRef.current?.start(0);

    lastBeatRef.current = clamped / (60 / bpm);
    lastPushedCursorRef.current = lastBeatRef.current;
    cursorRef.current = lastBeatRef.current;
    skipCursorSyncValueRef.current = lastBeatRef.current;
    setCursor(lastBeatRef.current);
  }, [bpm]);

  const seekToResumeBeat = () => {
    if (lastBeatRef.current > 0) {
      seekTo(beats_to_sec(lastBeatRef.current, bpm));
    }
  }

  const rewind = useCallback(() => {
    seekTo(Tone.getTransport().seconds - 5);
  }, [seekTo]);

  const play_forward = useCallback(() => {
    seekTo(Tone.getTransport().seconds + 5);
  }, [seekTo]);

  return { play, pause, restart, rewind, play_forward, duration, lastRecordingRes };
}