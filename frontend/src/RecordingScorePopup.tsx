import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import './RecordingScorePopup.css'
import type { ScoreData, Toaster } from "./services/types";
import { SimpleSpinner } from "./LoadingAsset";
import { apiService } from "./services/api";
import { sessionStateManager } from "./services/session_state_manager";
import { IoMdArrowDropdown } from "react-icons/io";
import { globalZCounter } from "./main";
import { FaArrowDown, FaPause, FaPlay, FaTrash } from "react-icons/fa";
import { Tooltip } from "./components/Info";
import { DeleteWarning } from "./components/ModalDialog";
import { DropDown } from "./components/DropDown";
import { HiOutlineMicrophone } from "react-icons/hi2";

const formatDate = (dateInput?: string | Date | null) => {
    if (!dateInput) return '--/--/----';

    // If it's already a Date object, use it; otherwise parse the string
    const dateObj = dateInput instanceof Date
        ? dateInput
        : new Date(typeof dateInput === 'string' ? dateInput.replace(' ', 'T') : dateInput);

    if (isNaN(dateObj.getTime())) return '--/--/----';

    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
};

export function RecordingScorePopup({
    highScoreData,
    lastScoreData,
    setLastScoreData,
    setHighScoreData,
    loading,
    setLoading,
    songId,
    listView,
    setListView,
    toaster,
}: {
    highScoreData: ScoreData,
    lastScoreData: ScoreData,
    setLastScoreData: Dispatch<SetStateAction<ScoreData>>,
    setHighScoreData: Dispatch<SetStateAction<ScoreData>>,
    loading: string,
    setLoading: Dispatch<SetStateAction<string>>,
    songId: number,
    listView: boolean,
    setListView: Dispatch<SetStateAction<boolean>>,
    toaster: Toaster
}) {

    const [collapseMap, setCollapseMap] = useState({
        highScore: false,
        scoreAnim: false,
    })

    const [allPastScores, setAllPastScores] = useState<ScoreData[]>([]);
    //'score', 'date'
    const [sortBy, setSortBy] = useState<string>('score');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [sortDec, setSortDec] = useState(true);

    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const [attemptToDeleteId, setAttemptToDeleteId] = useState<number>(-1);

    useEffect(() => {
        const handleCollapses = () => {
            const newCollapseMap = { ...collapseMap };
            newCollapseMap.highScore = window.innerWidth < 580
            newCollapseMap.scoreAnim = window.innerHeight < 960
            setCollapseMap(newCollapseMap)
        }
        window.addEventListener('resize', handleCollapses);
        return () => window.removeEventListener('resize', handleCollapses);
    }, [])

    const [localListView, setLocalListView] = useState(listView);

    useEffect(() => {
        const handle = async () => {
            if (listView && allPastScores.length === 0) {
                setLoading('Fetching Past Attempts');
                const res = await apiService.getAllAttempts(songId);
                if (res.attempts) {
                    const normalisedAttempts: ScoreData[] = res.attempts.map((attempt: any) => ({
                        score: attempt.score,
                        date: new Date(attempt.date_played),
                        attempt_num: attempt.attempt_num,
                        id: attempt.id
                    }));
                    setAllPastScores(normalisedAttempts);
                }
                else toaster.add_message('Failed to load past attempts.');
                setLoading('');
            }
            else if (!listView) {
                await new Promise(resolve => setTimeout(resolve, 300));
                setAllPastScores([]);
            }
            setLocalListView(listView);
        }
        handle();
    }, [listView])

    const ScoreDataDisplay = ({
        scoreData,
        scoreName,
        color,
        bg
    }: {
        scoreData: ScoreData
        scoreName: string,
        color?: string,
        bg?: string,
    }) => (
        <div
            className="recording-stats"
            style={{
                color,
                backgroundColor: bg,
                boxShadow: bg ? '0 0 20px rgba(0, 0, 0, 0.7)' : 'none'
            }}
        >
            <div style={{
                textDecoration: 'underline',
                textUnderlineOffset: 4
            }}>{scoreName}:</div>
            <div>
                <span>Score:</span>
                <strong>{scoreData.score ? Math.round(scoreData.score * 100) : '--'}</strong>
            </div>
            <div>
                <span>Date Recorded:</span>
                <strong>{formatDate(scoreData.date)}</strong>
            </div>
            <div>
                <span>Attempt:</span>
                <strong>#{scoreData.attempt_num ?? '--'}</strong>
            </div>
        </div>
    )

    return (
        <>
            <DeleteWarning
                showMssg={showDeleteWarning}
                mssg="Deleting an attempt can't be undone."
                setShowMssg={() => setShowDeleteWarning(false)}
                deleteProcess={async () => {
                    const res = await apiService.deleteAttempt(attemptToDeleteId);
                    if (res.message) {
                        const isLastAttempt = attemptToDeleteId === lastScoreData.id;
                        const isBestAttempt = attemptToDeleteId === highScoreData.id

                        let deletedAttempt: ScoreData | null = null;
                        const remainingScores: ScoreData[] = [];

                        for (const score of allPastScores) {
                            if (score.id === attemptToDeleteId) {
                                deletedAttempt = score;
                            }
                            else remainingScores.push(score);
                        }

                        if (!deletedAttempt || deletedAttempt.attempt_num === null) return;

                        if (isLastAttempt || remainingScores.length === 0) {
                            //reset all states when no scores remain or if we just deleted the last score bc that'll close the popup
                            setLastScoreData(prev => ({ ...prev, score: null, attempt_num: null }));
                            setHighScoreData(prev => ({ ...prev, score: null, attempt_num: null }));
                            setAllPastScores([]);
                        } else {
                            setAllPastScores(remainingScores);

                            //always decrement the last score here bc here means that it wasnt the score deleted
                            if (lastScoreData.attempt_num && deletedAttempt.attempt_num < lastScoreData.attempt_num) {
                                setLastScoreData(prev => ({
                                    ...prev,
                                    attempt_num: (prev.attempt_num ?? 1) - 1
                                }));
                            }

                            //deleted best attempt so it has to be reassigned
                            if (isBestAttempt) {
                                //new best score
                                const bestObj = remainingScores.reduce((max, current) => {
                                    return (current.score ?? 0) > (max.score ?? 0) ? current : max;
                                }, remainingScores[0]);

                                const newBest = { ...bestObj };

                                if (newBest.attempt_num && deletedAttempt.attempt_num < newBest.attempt_num) {
                                    newBest.attempt_num = newBest.attempt_num - 1;
                                }

                                setHighScoreData(newBest);
                            } else {
                                //if high score wasn't deleted it should still be decremented
                                if (highScoreData?.attempt_num && deletedAttempt.attempt_num < highScoreData.attempt_num) {
                                    setHighScoreData(prev => ({
                                        ...prev,
                                        attempt_num: (prev.attempt_num ?? 1) - 1
                                    }));
                                }
                            }
                        }
                    }
                }}
            />
            <div
                className="recording-score-container"
                onClick={(e) => {
                    e.stopPropagation()
                    setDropdownOpen(false);
                }}
            >
                {
                    localListView ?
                        <span style={{ fontWeight: 'bold' }}>All Attempts</span>
                        : <span style={{ fontWeight: 'bold' }}>Recording Results</span>
                }
                {
                    loading !== '' ? (
                        <div className="spinner-container">
                            <SimpleSpinner
                                width="50px"
                                height="50px"
                                spinnerColor="var(--tertiary-accent)"
                                bgColor="var(--bg)"
                            />
                            {`${loading}...`}
                        </div>
                    ) :
                        (
                            localListView ? (
                                <>
                                    <div className="sort-by-buttons">
                                        <Tooltip
                                            mssg={`Sort by ${sortDec ? 'decreasing' : 'increasing'} ${sortBy}.`}
                                            minWidth={200}
                                            content={
                                                <div
                                                    className={`dec-inc-button ${sortDec ? 'dec' : ''}`}
                                                    onClick={() => setSortDec(!sortDec)}
                                                >
                                                    <FaArrowDown />
                                                </div>
                                            }
                                        />
                                        <DropDown
                                            open={dropdownOpen}
                                            setOpen={setDropdownOpen}
                                            op={sortBy}
                                            ops={['score', 'date']}
                                            setOp={setSortBy}
                                        />
                                    </div>
                                    <div className="attempts-container">
                                        {
                                            allPastScores.length > 0 ? (
                                                allPastScores
                                                    .sort((a, b) => {
                                                        const scoreA = a.score ?? 0;
                                                        const scoreB = b.score ?? 0;
                                                        const dateA = a.date ? new Date(a.date).getTime() : 0;
                                                        const dateB = b.date ? new Date(b.date).getTime() : 0;

                                                        //secondary tie breakers are always decreasing
                                                        const secondaryScore = scoreB - scoreA;
                                                        const secondaryDate = dateB - dateA;

                                                        if (sortBy === 'date') {
                                                            const primaryDate = sortDec ? secondaryDate : dateA - dateB;
                                                            //if dates are identical, fallback to highest score
                                                            return primaryDate !== 0 ? primaryDate : secondaryScore;
                                                        }

                                                        const primaryScore = sortDec ? secondaryScore : scoreA - scoreB;
                                                        return primaryScore !== 0 ? primaryScore : secondaryDate;
                                                    })
                                                    .map((attempt, idx) => {
                                                        const isLastAttempt = attempt.id === lastScoreData.id;
                                                        const isBestAttempt = attempt.id === highScoreData.id
                                                        return (
                                                            <div key={idx} className={`card ${isLastAttempt ? 'last-attempt' : (isBestAttempt ? 'best-attempt' : '')}`}>
                                                                <div className={`description ${sortBy === 'score' ? 'score-first' : ''}`}>
                                                                    <div className={`${sortBy === 'score' ? 'selected' : ''}`}>Score: {Math.round((attempt.score ?? 0) * 100)}</div>
                                                                    <div className={`${sortBy !== 'score' ? 'selected' : ''}`}>Date: {formatDate(attempt.date)}</div>
                                                                </div>
                                                                <FaTrash
                                                                    onClick={() => {
                                                                        setShowDeleteWarning(true)
                                                                        setAttemptToDeleteId(attempt.id);
                                                                    }}
                                                                />
                                                            </div>
                                                        )
                                                    })
                                            ) :
                                                (
                                                    <div
                                                        style={{
                                                            textAlign: 'center',
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            flexDirection: 'column',
                                                            gap: '15px',
                                                            fontSize: '0.8em'
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 'bold' }}>No Recordings</span>
                                                        <span>
                                                            Press on the microphone{" "}
                                                            <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                (<HiOutlineMicrophone />)
                                                            </span>{" "}
                                                            and then click play{" "}
                                                            <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                (<FaPlay />)
                                                            </span>{" "}
                                                            to create a new recording.
                                                        </span>
                                                    </div>
                                                )
                                        }
                                    </div>
                                    <div className="button-group">
                                        {/*can safely always display bc the first time that the score shows up there will be smth in the post scores*/}
                                        {
                                            lastScoreData.score !== null && (
                                                <div
                                                    onClick={() => {
                                                        // setListView(false)
                                                        setLocalListView(false);
                                                    }}
                                                    className="secondary-button"
                                                >
                                                    Back to Last Attempt
                                                </div>
                                            )
                                        }
                                        <div
                                            onClick={() => {
                                                setListView(false);
                                                setLastScoreData(prev => ({ ...prev, score: null }))
                                            }}
                                        >Continue</div>
                                    </div>
                                </>
                            )
                                : (
                                    <>
                                        {
                                            !collapseMap.scoreAnim && (
                                                <div className="stat-spinner-bg">
                                                    <div
                                                        style={{
                                                            ['--arc-deg' as any]: `${(highScoreData.score ?? 0) * 360}deg`
                                                        } as React.CSSProperties}
                                                        className="stat-spinner high-score"
                                                    />
                                                    <div
                                                        style={{
                                                            ['--arc-deg' as any]: `${(lastScoreData.score ?? 0) * 360}deg`,
                                                            ['--arc-colour' as any]: 'color-mix(var(--tertiary-accent) 80%, transparent 20%)'
                                                        } as React.CSSProperties}
                                                        className="stat-spinner last-score"
                                                    />
                                                    <div className="stats">
                                                        <div
                                                            style={{
                                                                fontSize: 'min(2.5rem, 6cqw)',
                                                                fontWeight: 'bolder',
                                                                color: 'var(--tertiary-accent)',
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    ['--num' as any]: Math.round((lastScoreData.score ?? 0) * 100)
                                                                } as React.CSSProperties}
                                                            />
                                                            <span>New Score</span>
                                                        </div>
                                                        <div>
                                                            <div
                                                                style={{
                                                                    ['--num' as any]: Math.round((highScoreData.score ?? 0) * 100)
                                                                } as React.CSSProperties}
                                                            />
                                                            <span>High Score</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        <div className="recording-stats-container">
                                            <ScoreDataDisplay
                                                scoreData={lastScoreData}
                                                scoreName="Last Attempt"
                                                color={'var(--primary-text)'}
                                                bg='var(--tertiary-accent)'
                                            />
                                            {
                                                !collapseMap.highScore && (
                                                    <ScoreDataDisplay
                                                        scoreData={highScoreData}
                                                        scoreName="Best Attempt"
                                                    />
                                                )
                                            }
                                        </div>
                                        <div className="button-group">
                                            {/*can safely always display bc the first time that the score shows up there will be smth in the post scores*/}
                                            <div
                                                onClick={() => {
                                                    if (!listView) setListView(true);
                                                    else setLocalListView(true);
                                                }}
                                                className="secondary-button"
                                            >
                                                See All Recordings
                                            </div>
                                            <div
                                                onClick={() => {
                                                    setListView(false);
                                                    setLastScoreData(prev => ({ ...prev, score: null }))
                                                }}
                                            >Continue</div>
                                        </div>
                                    </>
                                )
                        )
                }
            </div >
        </>
    )
}