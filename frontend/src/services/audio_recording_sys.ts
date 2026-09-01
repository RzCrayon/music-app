import { useState, useRef } from 'react';

const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

export const useAudioRecorder = () => {

    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const recordingStartTimeRef = useRef<number>(0);

    const start_recording = async () => {
        // Clear any previous recording data
        audioChunksRef.current = [];
        setAudioUrl(null);

        try {
            // 1. Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia(
                {
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        channelCount: 1,
                        sampleRate: 44100
                    }
                }
            );
            streamRef.current = stream;

            // 2. Initialize MediaRecorder
            const mimeType = getSupportedMimeType()
            const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
            mediaRecorderRef.current = mediaRecorder;

            // 3. Handle data accumulation
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            // 5. Start recording
            mediaRecorder.start();
            recordingStartTimeRef.current = performance.now();

        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    };

    const pause_recording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
        }
    };

    const resume_recording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
        }
    };

    const stop_recording = (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                reject('Recorder not active');
                return;
            }

            mediaRecorderRef.current.onstop = () => {
                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                resolve(url); // resolve with the url directly
            };

            mediaRecorderRef.current.stop();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        });
    };

    return {
        audioUrl,
        start_recording,
        stop_recording,
        pause_recording,
        resume_recording,
        getState: () => mediaRecorderRef.current?.state ?? 'inactive',
        getRecordingStartTime: () => recordingStartTimeRef.current
    };
};