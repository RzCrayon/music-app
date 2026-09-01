import { useEffect, useState } from "react";

export const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const paddedSeconds = String(seconds).padStart(2, '0');

    return `${minutes}:${paddedSeconds}`;
}

export const CountDownDisplay = ({ init_time, clearTimer }: { init_time: number, clearTimer: () => void }) => {
    const [timeLeft, setTimeLeft] = useState(init_time * 1000);
    const skip_time_ms = 1000;

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= skip_time_ms) {
                    clearInterval(timer);
                    clearTimer();
                    return 0;
                }
                return prev - skip_time_ms;
            });
        }, skip_time_ms);
        return () => clearInterval(timer);
    }, []);

    return (<div>{formatTime(timeLeft)}</div>)
}