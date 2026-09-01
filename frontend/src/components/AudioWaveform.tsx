import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { beats_to_sec } from '../services/recording_analyser2';
import { SimpleSpinner } from '../LoadingAsset';
import ErrDisplay from '../ErrDisplay';
import type { Note } from '../services/types';
import { calculate_ypos } from '../SheetMusic/sheetmusic_processor';

const PORT = 'http://localhost:5000'
const BAR_WIDTH = 5;

function AudioWaveform({
    currBeat,
    notes,
    bpm,
    setLoaded
}: {
    currBeat: number,
    notes: Note[]
    bpm: number,
    setLoaded: Dispatch<SetStateAction<boolean>>
}) {

    // const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState('');
    const [peaks, setPeaks] = useState<number[]>([]);
    const [totalDur, setTotalDur] = useState<number>(0);
    const [completedPercent, setCompletedPercent] = useState(0);

    const [loading, setLoading] = useState(false);
    const timerRef = useRef(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const loadingAnimRepeatTime = 2100;
    const minLoadingTime = loadingAnimRepeatTime * 1.25;

    const derive_peaks = () => {
        if (!containerRef.current) return;

        const totalBeats = notes.reduce((max, n) => Math.max(max, n.offset + n.duration), 0);
        const totalDurationSec = beats_to_sec(totalBeats, bpm);
        setTotalDur(totalDurationSec);

        const numBars = Math.floor(containerRef.current.clientWidth / BAR_WIDTH);
        const compressedNotes = Array(numBars).fill(0);

        if (totalDurationSec <= 0 || numBars <= 0) return Array(numBars).fill(0.1);

        const secPerBar = totalDurationSec / numBars;
        // let highestPitch = 0;

        //flatten notes
        const activeNotes = notes
            .map(n => {
                const startTime = beats_to_sec(n.offset, bpm);
                const endTime = beats_to_sec(n.offset + n.duration, bpm);

                if (n.type !== 'rest') {
                    let maxYPos = 0;
                    n.pitches.forEach(p => {
                        const ypos = calculate_ypos(p.pitch, 'Treble');
                        if (ypos > maxYPos) maxYPos = ypos;
                        // if (ypos > highestPitch) highestPitch = ypos;
                    });
                    return { startTime, endTime, ypos: maxYPos };
                }
                else {
                    return { startTime, endTime, ypos: 0 };
                }
            });

        // if (highestPitch === 0) return err_peaks();
        if (activeNotes.length === 0) {
            setError('Song render failed. Unable to derive waveform from notes.')
            return err_peaks();
        }

        activeNotes.forEach(note => {
            const firstSlot = Math.floor(note.startTime / secPerBar);
            const lastSlot = Math.ceil(note.endTime / secPerBar);

            for (let slot = firstSlot; slot < lastSlot; slot++) {
                if (slot >= 0 && slot < numBars) {
                    const currentSec = slot * secPerBar;
                    const noteProgress = (currentSec - note.startTime) / (note.endTime - note.startTime || 1);

                    const decayFactor = Math.max(0.3, 1 - noteProgress);
                    const envelopeYPos = note.ypos * decayFactor;

                    if (envelopeYPos > compressedNotes[slot]) {
                        compressedNotes[slot] = envelopeYPos;
                    }
                }
            }
        });

        //interpolate notes by filling silent gaps 
        for (let i = 0; i < compressedNotes.length; i++) {
            if (compressedNotes[i] === 0) {
                const left = i > 0 ? compressedNotes[i - 1] : 0;
                let right = 0;
                for (let j = i + 1; j < compressedNotes.length; j++) {
                    if (compressedNotes[j] > 0) {
                        right = compressedNotes[j];
                        break;
                    }
                }
                compressedNotes[i] = right > 0 && left > 0 ? (left + right) / 2 : left || right;
            }
        }

        const highestPitch = Math.max(...compressedNotes);
        const normalised_heights = compressedNotes.map(n => Math.max(0.05, n / highestPitch));

        setPeaks(normalised_heights)
    }

    const sinusodal_peaks = (timer: number) => {
        if (!containerRef.current) return;
        const bar_heights: number[] = [];

        const width = containerRef.current.clientWidth;
        const numBars = Math.floor(width / BAR_WIDTH);

        const oscillation = (Math.sin((2 * Math.PI * timer) / loadingAnimRepeatTime) + 1) / 2;

        const get_percent = (bar: number) => {
            const fluc1 = Math.abs(Math.cos((2 / width) * Math.PI * bar * BAR_WIDTH));
            const fluc2 = Math.abs(Math.sin((2 / width) * Math.PI * bar * BAR_WIDTH));
            return Math.max(fluc1 + (fluc2 - fluc1) * oscillation, 0.05);
        }

        for (let i = 0; i < numBars; i++) {
            bar_heights.push(get_percent(i));
        }
        setPeaks(bar_heights);
    }

    const err_peaks = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const numBars = Math.floor(width / BAR_WIDTH);
        const bar_heights: number[] = [];
        for (let i = 0; i < numBars; i++) {
            if (i % 2 === 0) {
                bar_heights.push(0);
                continue;
            }
            bar_heights.push(0.25);
        }
        setPeaks(bar_heights);
    }

    useEffect(() => {
        if (loading) {
            const tick = () => {
                const next = timerRef.current + 100;
                timerRef.current = next;
                sinusodal_peaks(next);
            };
            const handleResize = () => sinusodal_peaks(timerRef.current);

            const id = setInterval(tick, 100);
            addEventListener('resize', handleResize);

            return () => {
                clearInterval(id);
                removeEventListener('resize', handleResize);
            };
        }
        if (timerRef.current > 0) timerRef.current = 0;
        const handleResize = error === '' ? () => derive_peaks() : () => err_peaks();
        handleResize();
        addEventListener('resize', handleResize);
        return () => removeEventListener('resize', handleResize);
    }, [loading, error])

    useEffect(() => {
        const get_decoded_buffer = async () => {
            setLoading(true);
            setLoaded(false);

            derive_peaks();
            //not necessary to hit the same spot... the min is just there to make sure that it looks like its been loading
            const remainingTime = minLoadingTime - timerRef.current % minLoadingTime;
            await new Promise(resolve => setTimeout(resolve, remainingTime));

            setLoading(false);
            setLoaded(true);
        }
        get_decoded_buffer();
    }, [notes])

    useEffect(() => {
        const completed = beats_to_sec(currBeat, bpm);
        setCompletedPercent(totalDur > 0 ? Math.max(0, completed / totalDur) : 0);
    }, [currBeat])

    return (
        <div
            style={{
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column'
            }}
        >
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: loading ? 'center' : 'flex-start',
                    minHeight: '80px',
                    maxHeight: '300px',
                    padding: '40px 20px',
                }}
            >
                {
                    peaks.map((peak, idx) => (
                        <div
                            key={idx}
                            style={{
                                width: `${BAR_WIDTH}px`,
                                height: `calc(${peak} * 100%)`,
                                backgroundColor: `
                                    ${error !== '' ? 'color-mix(var(--err-colour) 70%, var(--tertiary-text) 30%)' :
                                        (idx < peaks.length * completedPercent
                                            ? 'var(--primary-text)'
                                            : 'var(--tertiary-text)'
                                        )}
                                `,
                            }}
                        />)
                    )
                }
            </div>
            <ErrDisplay err={error} />
        </div>
    );
}

export default AudioWaveform;