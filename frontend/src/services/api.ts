import type { Dispatch, SetStateAction } from "react";
import { errorEmitter, router, toastEmitter } from "../main";
import type { Instruments, Note } from "./types";

const BASE_URL = 'http://localhost:5000/api'
export const CNXN_FAILURE = {
    title: 'Something went wrong.',
    mssg: "Couldn't to connect to Server. Check your internet then refresh the page."
}

let accessToken: string | null = null;
let currentES: EventSource | null = null;

//keeping it in a js var not in localStorage to avoid it being visiable to user
export const authStore = {
    getToken: () => accessToken,
    setToken: (token: string | null) => { accessToken = token }
}

const getAuthHeaders = (isFormData = false): HeadersInit => {
    const token = authStore.getToken();
    return {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
}

const refreshAccessToken = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${BASE_URL}/refresh`, {
            method: 'POST',
            credentials: 'include', // sends the httpOnly cookie
        });
        if (!res.ok) return false;
        const data = await res.json();
        authStore.setToken(data.token);
        return true;
    } catch {
        return false;
    }
};

//instead of using just normal fetch now it wraps the fetch into an authed call
//NORMAL TO GET AN UNAUTHORISED MESSAGE IN THE CONSOLE bc on refresh or sign out the accesstoken is refreshed
const authedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const isFormData = options.body instanceof FormData;
    let res = await fetch(url, {
        ...options,
        headers: { ...getAuthHeaders(isFormData), ...options.headers },
        credentials: 'include',
    });
    if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            res = await fetch(url, {
                ...options,
                headers: { ...getAuthHeaders(isFormData), ...options.headers },
                credentials: 'include',
            });
        } else {
            await apiService.logoutUser();
        }
    }
    return res;
};

export const apiService = {

    pingSignIn: async () => {
        try {
            const res = await fetch(`${BASE_URL}/users/login/status`);
            const data = await res.json();
            return {
                signInRemaining: data.sign_in_remaining,
                signUpRemaining: data.sign_up_remaining
            }
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to fetch login data.' });
            return;
        }
    },

    loginUser: async (username: string, password: string) => {
        try {
            const res = await fetch(`${BASE_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include',
            });
            if (!res.ok) {
                if (res.status === 429) {
                    toastEmitter.trigger({ mssg: "Too many attempts. Please try again in a minute." })
                    return { limit: res.headers.get('Retry-After') }
                }

                const data = await res.json();
                toastEmitter.trigger({ mssg: data.error });
                return;
            }

            const successData = await res.json();
            const { token, ...cleanedSuccessData } = successData;
            authStore.setToken(token);

            toastEmitter.trigger({ mssg: cleanedSuccessData.message, color: 'var(--success-colour)' });
            return cleanedSuccessData;
        } catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Login Failed' });
            return;
        }
    },

    logoutUser: async () => {
        try {
            const res = await fetch(`${BASE_URL}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            })
            if (res.ok) {
                //nav back to login page
                router.navigate('/')
                return;
            }
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Login Failed' });
            return;
        }
    },

    createUser: async (username: string, password: string) => {
        try {
            const validationRes = await fetch(`${BASE_URL}/users/new/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });

            if (!validationRes.ok) {
                const data = await validationRes.json();
                toastEmitter.trigger({ mssg: data.error });

                if (validationRes.status === 403) {
                    return { unsecure_password: true }
                }
                else if (validationRes.status === 409) {
                    return { username_used: true }
                }
                return;
            }

            const res = await fetch(`${BASE_URL}/users/new`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });

            if (!res.ok) {

                if (res.status === 429) {
                    toastEmitter.trigger({ mssg: "You're creating too many accounts. Please try again after a bit." })
                    return { limit: res.headers.get('Retry-After') }
                }

                const data = await res.json();
                toastEmitter.trigger({ mssg: data.error });
                return;
            }

            const successData = await res.json();
            const { token, ...cleanedSuccessData } = successData;
            authStore.setToken(token);

            toastEmitter.trigger({ mssg: cleanedSuccessData.message, color: 'var(--success-colour)' });
            return cleanedSuccessData;
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Account creation failed.' });
            return;
        }
    },

    getUserDashboard: async () => {
        try {
            //no need to check for errs here bc the only way this could go wrong is internet cnnxn issue
            const res = await authedFetch(`${BASE_URL}/dashboard`);
            //handle all 401s with a general toaster message
            if (res.status === 401) {
                authStore.setToken(null);
                toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                return;
            }
            return await res.json();
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to grab user dashboard.' });
            return;
        }
    },

    recordNewAttempt: async (songId: number, score: number) => {
        //no way of failing other than internet issues
        try {
            const res = await authedFetch(`${BASE_URL}/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_id: songId, score }),
            });
            if (res.status === 401) {
                authStore.setToken(null);
                toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                return;
            }
            return await res.json();
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to save attempt.' });
            return;
        }
    },

    getAllAttempts: async (songId: number) => {
        try {
            //no way this could go wrong other than internet issues
            const res = await authedFetch(`${BASE_URL}/attempts/${songId}`)
            if (res.status === 401) {
                authStore.setToken(null);
                toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                return;
            }
            return await res.json();
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to grab recording data.' });
            return
        }
    },

    deleteAttempt: async (attemptId: number) => {
        try {
            const res = await authedFetch(`${BASE_URL}/attempts/${attemptId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attemptId })
            })
            if (!res.ok) {
                if (res.status === 401) {
                    authStore.setToken(null);
                    toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                    return;
                }
                const data = await res.json();
                toastEmitter.trigger({ mssg: data.error });
                return;
            }
            const successData = await res.json();
            toastEmitter.trigger({ mssg: successData.message, color: 'var(--success-colour)' })
            return successData;
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to delete attempt.' });
            return
        }
    },

    getSong: async (songId: number) => {
        try {
            const res = await authedFetch(`${BASE_URL}/songs/${songId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_id: songId })
            })
            if (!res.ok) {
                if (res.status === 401) {
                    authStore.setToken(null);
                    toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                    return;
                }
                const data = await res.json();
                toastEmitter.trigger({ mssg: data.error });
                return;
            }
            return await res.json();
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to grab song data.' });
            return
        }
    },

    deleteSong: async (songId: number) => {
        try {
            const res = await authedFetch(`${BASE_URL}/songs/${songId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_id: songId })
            })
            if (!res.ok) {
                if (res.status === 401) {
                    authStore.setToken(null);
                    toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                    return;
                }
                const data = await res.json();
                toastEmitter.trigger({ mssg: data.error });
                return;
            }
            const successData = await res.json();
            toastEmitter.trigger({ mssg: successData.message, color: 'var(--success-colour)' })
            return successData;
        }
        catch (err: any) {
            if (err.name === 'AbortError') return { cancelled: true };
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to delete song data.' });
            return
        }
    },

    createSongPreview: async (
        file: File,
        instrument: string,
        setProgressMssg: Dispatch<SetStateAction<string>>,
        signal?: AbortSignal,
    ) => {

        let jobId: string | null = null;
        let suggestedTitle: string | null = null;

        try {
            //needs a form bc were sending file data 
            const formData = new FormData();
            formData.append('instrument', instrument)
            formData.append('sheet_music_file', file);

            //ENQUEUE TASK
            const enqueueRes = await authedFetch(`${BASE_URL}/songs/preview`, {
                method: 'POST',
                body: formData,
                signal: signal,
            });

            if (!enqueueRes.ok) {
                if (enqueueRes.status === 401) {
                    authStore.setToken(null);
                    toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                    return;
                }

                await enqueueRes.json().then(data => {
                    toastEmitter.trigger({ mssg: data.error })
                });
                return { err: true };
            }

            const enqueueData = await enqueueRes.json();
            jobId = enqueueData.job_id;
            suggestedTitle = enqueueData.suggested_title;

            if (currentES) {
                currentES.close();
                currentES = null;
            }

            const es = new EventSource(`${BASE_URL}/songs/preview/stream/${jobId}`);
            currentES = es;

            es.onerror = (e) => {
                console.log('SSE error', e);
                es.close();
                currentES = null;
            };
            es.onmessage = (e) => {
                const { message, done } = JSON.parse(e.data);
                setProgressMssg(message);
                if (done) {
                    es.close()
                    currentES = null;
                }
            }

            //POLL STATUS
            while (true) {
                if (signal?.aborted) {
                    throw new DOMException('Aborted by user', 'Abort Error');
                }

                //wait b4 polling again
                await new Promise((resolve) => setTimeout(resolve, 1500));

                const statusRes = await authedFetch(`${BASE_URL}/songs/preview/status/${jobId}`, {
                    method: 'GET',
                    signal: signal,
                });

                if (!statusRes.ok) {
                    if (statusRes.status === 401) {
                        authStore.setToken(null);
                        toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                        return;
                    }
                    toastEmitter.trigger({ mssg: 'OMR processing failed.' });
                    return { err: true }
                }

                const statusData = await statusRes.json();

                if (statusData.status === 'SUCCESS') {
                    return { ...statusData.data, suggested_title: suggestedTitle };
                }

                if (statusData.status === 'FAILED') {
                    toastEmitter.trigger({ mssg: 'OMR processing failed.' });
                    return { err: true };
                }
            }
        }
        catch (err: any) {
            if (err.name === 'AbortError' || signal?.aborted) {
                if (jobId) {
                    authedFetch(`${BASE_URL}/songs/preview/cancel/${jobId}`, {
                        method: 'DELETE',
                    }).catch((e) => console.error('Failed to notify backend of cancellation:', e));
                }
                return { cancelled: true };
            }
            else {
                errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to render song preview.' });
            }
            return;
        }
    },

    addSong: async (songTitle: string, extractedNotes: object[], instrument: Instruments) => {
        //no way to fail other than 
        try {
            const res = await authedFetch(`${BASE_URL}/songs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: songTitle,
                    notes: extractedNotes,
                    instrument
                })
            })
            if (res.status === 401) {
                authStore.setToken(null);
                toastEmitter.trigger({ mssg: 'Session expired. Please log in again.' });
                return;
            }
            //ok to add the message here bc rn we don't have any editting. 
            const successData = await res.json();
            toastEmitter.trigger({ mssg: successData.message, color: 'var(--success-colour)' })
            return successData;
        }
        catch (err) {
            errorEmitter.trigger({ ...CNXN_FAILURE, title: 'Failed to add song.' });
            return
        }
    }

}