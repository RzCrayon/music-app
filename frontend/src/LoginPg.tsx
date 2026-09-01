import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { apiService } from "./services/api";
import { useNavigate } from "react-router-dom";
import './LoginPg.css'
import LoadingAsset from "./LoadingAsset";
import type { User, Toaster } from "./services/types";

import { IoEyeOutline } from "react-icons/io5";
import ErrDisplay from "./ErrDisplay";
import { emptySongSettings } from "./Terminal";
import { set } from "idb-keyval";
import { sessionStateManager } from "./services/session_state_manager";
import { useToasterContext } from "./main";

const REQUIRED_FIELD = 'Required Field'
const INVALID_FIELD = 'Invalid Username or Password'
const TOO_SHORT = 'Password needs to be at least 8 characters'
const INVALID__USERNAME = 'Username taken'
const INSECURE_PASSWORD = 'Unsafe password'

const formatTime = (totalSeconds: number): string => {
    // Prevent negative values
    const safeSeconds = Math.max(0, totalSeconds);

    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    // String.prototype.padStart ensures leading zeroes (e.g. 5 -> '05')
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
};

const EyeLid = ({ open, setOpen, type }: { open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, type: 'err' | 'warn' | 'none' }) => {
    return (
        <div
            className={`eye-lid ${!open ? 'closed' : ''} ${type}`}
            onMouseUp={() => setOpen(!open)}
        >
            <IoEyeOutline />
        </div>
    )
}

function LoginPg() {

    const mainToaster = useToasterContext();

    //clear the song here bc sign out eventually leads here and if nav fails the song persists
    useEffect(() => {
        sessionStateManager.handleSignOut();
    }, [])

    const [user, setUser] = useState<User>({
        username: "",
        //no need to encrypt here at all because HTTPS will encrypt in transit 
        password: "",
    });
    const [loading, setLoading] = useState('');
    const [signIn, setSignIn] = useState(true);

    const [passwordMssg, setPasswordMssg] = useState('');
    const [usernameMssg, setUsernameMssg] = useState('');
    const [generalMssg, setGeneralMssg] = useState('');

    const [limit, setLimit] = useState(-1);
    const [signUpLimit, setSignUpLimit] = useState(-1);
    const limitRef = useRef(limit);
    const signUpRef = useRef(signUpLimit)

    const [visiblePassword, setVisibility] = useState(false);

    useLayoutEffect(() => {
        const prelim_check = async () => {
            const res = await apiService.pingSignIn();
            if (res) {
                setLimit(res.signInRemaining);
                setSignUpLimit(res.signUpRemaining);

                mainToaster.clear_messages();
                if (res.signInRemaining > 0) {
                    mainToaster.add_message(`RATE LIMIT EXCEEDED: Please wait ${res.signInRemaining + 1} more seconds before trying to sign in again.`, 'color-mix(brown 30%, var(--warning-colour) 70%)')
                }
                if (res.signUpRemaining > 0) {
                    const time_mssg = res.signUpRemaining >= 60 ? `${Math.floor(res.signUpRemaining / 60)} more minutes` : `${res.signUpRemaining + 1} more seconds`
                    mainToaster.add_message(`RATE LIMIT EXCEEDED: Please wait ${time_mssg} before creating another account.`, 'color-mix(brown 30%, var(--warning-colour) 70%)')
                }
            }
        }
        prelim_check();
    }, [])

    useEffect(() => {
        setVisibility(false)
        if (signIn && limitRef.current > 0) {
            mainToaster.add_message(`RATE LIMIT EXCEEDED: Please wait ${limitRef.current + 1} more seconds before trying to sign in again.`, 'color-mix(brown 30%, var(--warning-colour) 70%)')
        }
        else if (!signIn && signUpRef.current > 0) {
            const time_mssg = signUpRef.current >= 60 ? `${Math.floor(signUpRef.current / 60)} more minutes` : `${signUpRef.current + 1} more seconds`
            mainToaster.add_message(`RATE LIMIT EXCEEDED: Please wait ${time_mssg} before creating another account.`, 'color-mix(brown 30%, var(--warning-colour) 70%)')
        }
    }, [signIn]);

    useEffect(() => { limitRef.current = limit }, [limit])
    useEffect(() => { signUpRef.current = signUpLimit }, [signUpLimit])

    useEffect(() => {
        if (signIn) {
            if (limit > -1) {
                setGeneralMssg(`Too many attempts. Please wait: ${formatTime(limit + 1)}`)
                const timer = setInterval(() => {
                    setLimit(prev => {
                        if (prev <= 0) {
                            clearInterval(timer);
                            return -1; // reset to your "no limit" sentinel
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(timer);
            }
            else {
                setGeneralMssg('');
            }
        }
        else {
            if (signUpLimit > -1) {
                setGeneralMssg(`You're creating too many accounts. Please wait: ${formatTime(signUpLimit + 1)} before tying again.`)
                const timer = setInterval(() => {
                    setSignUpLimit(prev => {
                        if (prev <= 0) {
                            clearInterval(timer);
                            return -1; // reset to your "no limit" sentinel
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(timer);
            }
            else {
                setGeneralMssg('');
            }
        }
    }, [limit, signIn, signUpLimit])

    const navigate = useNavigate();

    const login = async () => {

        const trimmedPassword = user.password.trim();
        const no_username = user.username.trim().length === 0;
        const no_password = trimmedPassword.length === 0;
        const too_short = !signIn && trimmedPassword.length < 8 && !no_password;

        if (limit === -1 && signIn) {
            setGeneralMssg('');
            setPasswordMssg('');
            setUsernameMssg('');
        }
        else if (signUpLimit === -1 && !signIn) {
            setGeneralMssg('');
            setPasswordMssg('');
            setUsernameMssg('');
        }
        else return;

        if (no_username) {
            mainToaster.add_message('INVALID LOGIN INFO: No Username Provided');
            setUsernameMssg(REQUIRED_FIELD);
        }
        if (no_password) {
            mainToaster.add_message('INVALID LOGIN INFO: No Password Provided');
            setPasswordMssg(REQUIRED_FIELD);
        }
        if (too_short) {
            mainToaster.add_message('Password must be at least 8 characters long.');
            setGeneralMssg(TOO_SHORT);
        }
        if (no_password || no_username || too_short) return;

        setLoading(signIn ? 'Signing you in' : 'Configuring your account');
        try {
            if (signIn) {
                if (limit !== -1) {
                    mainToaster.add_message(`Still cooling down: please wait ${limit} seconds before trying again.`, 'color-mix(brown 30%, var(--warning-colour) 70%)')
                    setUser({ ...user, password: '' });
                    setLoading('');
                    return;
                }
                const res = await apiService.loginUser(user.username, user.password);
                if (!res) {
                    setUser({ ...user, password: '' });
                    setGeneralMssg(INVALID_FIELD)
                    setLoading('');
                }
                if (res.limit) {
                    setLimit(Number(res.limit));
                    setUser({ ...user, password: '' });
                    setLoading('');
                }
                else if (res.username) {
                    await set(sessionStateManager.idbTerminalCurrSong, emptySongSettings);
                    sessionStorage.setItem(sessionStateManager.songs, JSON.stringify(res.songs));
                    navigate('/dashboard', { state: { user: { username: res.username } } });
                }
            }

            else {
                if (signUpLimit !== -1) {
                    mainToaster.add_message(`Still cooling down: please wait ${signUpLimit} seconds before trying again.`, 'color-mix(brown 30%, var(--warning-colour) 70%)')
                    setUser({ ...user, password: '' });
                    setLoading('');
                    return;
                }
                const res = await apiService.createUser(user.username, user.password);
                if (res.limit) {
                    setSignUpLimit(Number(res.limit));
                    setUser({ ...user, password: '' });
                    setLoading('');
                }
                else if (res.username) {
                    await set(sessionStateManager.idbTerminalCurrSong, emptySongSettings);
                    //make sure refresh clears out the songs list 
                    sessionStorage.setItem(sessionStateManager.songs, '[]'); //empty list of songs for if it's a new user
                    navigate('/dashboard', { state: { user: { username: res.username } } });
                }
                else if (res.unsecure_password) {
                    setUser({ ...user, password: '' });
                    setPasswordMssg(INSECURE_PASSWORD)
                    setLoading('');
                }
                else if (res.username_used) {
                    setUser({ ...user, username: '' });
                    setUsernameMssg(INVALID__USERNAME)
                    setLoading('');
                }
                else {
                    setUser({ ...user, username: '' });
                    setLoading('');
                }
            }
        }
        catch (err) {
            console.log(err);
            setLoading('')
        }
    }

    if (loading !== '') return (
        <div className="loading-container-signin">
            <LoadingAsset mssg={loading} />
        </div>
    )
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100dvh'
            }}
        >
            <div className='sign-in-pad'>
                <div className={`sign-in-layout sign-in ${signIn ? '' : 'switch'}`}>
                    <div style={{ fontSize: 'larger', color: 'var(--primary-text)', marginBottom: '30px' }}>Login</div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            login();
                        }}
                    >
                        <div className={`input-sxn ${limit > -1 ? 'warn' : generalMssg !== '' && signIn ? 'err' : ''}`}>
                            <div className={`input-sxn ${usernameMssg !== '' ? 'err' : ''}`}>
                                <div className="input-container">
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        autoComplete="username"
                                        placeholder=" "
                                        value={user.username}
                                        tabIndex={signIn ? 0 : -1}
                                        onChange={(e) => {
                                            const new_val = e.target.value;

                                            if (generalMssg === INVALID_FIELD && new_val.length === 0) {
                                                setGeneralMssg('');
                                            }
                                            if (usernameMssg === REQUIRED_FIELD && new_val.length > 0) {
                                                setUsernameMssg('')
                                            }
                                            setUser(prev => ({ ...prev, username: new_val }));
                                        }}
                                    />
                                    <label htmlFor="username">Username</label>
                                </div>
                                <ErrDisplay
                                    err={usernameMssg}
                                    type={'err'}
                                    disableDisplay={!signIn}
                                />
                            </div>

                            {/* <label htmlFor="password">Password</label> */}
                            <div className={`input-sxn ${passwordMssg !== '' ? 'err' : ''}`}>
                                <div className="input-container">
                                    <input
                                        type={visiblePassword ? 'text' : "password"}
                                        id="password"
                                        name="password"
                                        placeholder=" "
                                        tabIndex={signIn ? 0 : -1}
                                        autoComplete="current-password"
                                        value={user.password}
                                        onChange={(e) => {
                                            const new_val = e.target.value;

                                            if (generalMssg === INVALID_FIELD && new_val.length > 0) {
                                                setGeneralMssg('');
                                            }
                                            if (passwordMssg === REQUIRED_FIELD && new_val.length > 0) {
                                                setPasswordMssg('')
                                            }
                                            setUser(prev => ({ ...prev, password: new_val }));
                                        }}
                                    />
                                    <label htmlFor="password">Password</label>
                                    <EyeLid
                                        open={visiblePassword}
                                        setOpen={setVisibility}
                                        type={limit > -1 ? 'warn' : (generalMssg || passwordMssg) && signIn ? 'err' : 'none'}
                                    />
                                </div>
                                <ErrDisplay
                                    err={passwordMssg}
                                    type={'err'}
                                    disableDisplay={!signIn}
                                />
                            </div>
                            <ErrDisplay
                                err={generalMssg}
                                type={limit > -1 ? 'warn' : 'err'}
                                disableDisplay={!signIn}
                            />

                        </div>

                        <button
                            type="submit"
                            className={`primary-option ${user.username.length === 0 || user.password.length === 0 ? 'disabled' : ''}`}
                            tabIndex={signIn ? 0 : -1}
                        >
                            Sign In
                        </button>
                    </form>
                    <button
                        className="secondary-option"
                        onClick={() => {
                            setSignIn(!signIn)
                            setUser({ username: '', password: '' });
                            setGeneralMssg('');
                            setPasswordMssg('');
                            setUsernameMssg('');
                        }}
                        tabIndex={signIn ? 0 : -1}
                    >
                        Don't Already Have an Account? Join Us!
                    </button>
                </div>



                <div className={`sign-in-layout sign-up ${signIn ? '' : 'switch'}`}>
                    <div style={{ fontSize: 'larger', color: 'var(--primary-text)', marginBottom: '30px' }}>Sign Up</div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            login();
                        }}
                    >
                        <div className={`input-sxn ${signUpLimit > -1 ? 'warn' : generalMssg !== '' && !signIn ? 'err' : ''}`}>
                            <div className={`input-sxn ${usernameMssg !== '' ? 'err' : ''}`}>
                                <div className="input-container">
                                    <input
                                        type="text"
                                        id="username2"
                                        name="username2"
                                        autoComplete="username"
                                        value={user.username}
                                        tabIndex={!signIn ? 0 : -1}
                                        placeholder=" "
                                        onChange={(e) => {
                                            const new_val = e.target.value;

                                            if (generalMssg === INVALID_FIELD && new_val.length === 0) {
                                                setGeneralMssg('');
                                            }
                                            if (usernameMssg === REQUIRED_FIELD && new_val.length > 0) {
                                                setUsernameMssg('')
                                            }
                                            if (usernameMssg === INVALID__USERNAME && new_val.length > 0) {
                                                setUsernameMssg('');
                                            }
                                            setUser(prev => ({ ...prev, username: new_val }));
                                        }}
                                    />
                                    <label htmlFor="username2">Username</label>
                                </div>
                                <ErrDisplay
                                    err={usernameMssg}
                                    type={'err'}
                                    disableDisplay={signIn}
                                />
                            </div>

                            <div className={`input-sxn ${passwordMssg !== '' ? 'err' : ''}`}>
                                <div className="input-container">
                                    <input
                                        type={visiblePassword ? 'text' : "password"}
                                        id="password2"
                                        name="password2"
                                        autoComplete="current-password"
                                        value={user.password}
                                        tabIndex={!signIn ? 0 : -1}
                                        placeholder=" "
                                        onChange={(e) => {
                                            const new_val = e.target.value;

                                            if (generalMssg === INVALID_FIELD && new_val.length > 0) {
                                                setGeneralMssg('');
                                            }
                                            if (generalMssg === TOO_SHORT && new_val.length >= 8) {
                                                setGeneralMssg('');
                                            }
                                            if (passwordMssg === REQUIRED_FIELD && new_val.length > 0) {
                                                setPasswordMssg('')
                                            }
                                            if (passwordMssg === INSECURE_PASSWORD && new_val.length > 0) {
                                                setPasswordMssg('');
                                            }
                                            setUser(prev => ({ ...prev, password: new_val }));
                                        }}
                                    />
                                    <label htmlFor="password2">Password</label>
                                    <EyeLid
                                        open={visiblePassword}
                                        setOpen={setVisibility}
                                        type={signUpLimit > -1 ? 'warn' : generalMssg || passwordMssg ? 'err' : 'none'}
                                    />
                                </div>
                                <ErrDisplay
                                    disableDisplay={signIn}
                                    err={passwordMssg}
                                    type={'err'}
                                />
                            </div>
                            <ErrDisplay
                                disableDisplay={signIn}
                                err={generalMssg}
                                type={signUpLimit > -1 ? 'warn' : 'err'}
                            />
                            {
                                !signIn && (
                                    <span className={`inner-field-mssg ${generalMssg === '' && passwordMssg === '' && user.password.trim().length < 8 ? '' : 'not-visible'}`}>Password must be at least 8 characters long</span>
                                )
                            }
                        </div>

                        <button
                            type="submit"
                            className={`primary-option ${user.username.length === 0 || user.password.length === 0 ? 'disabled' : ''}`}
                            tabIndex={!signIn ? 0 : -1}
                        >
                            Create Account
                        </button>
                    </form>

                    <button
                        className="secondary-option"
                        onClick={() => {
                            setSignIn(!signIn)
                            setUser({ username: '', password: '' });
                            setGeneralMssg('');
                            setPasswordMssg('');
                            setUsernameMssg('');
                        }}
                        tabIndex={!signIn ? 0 : -1}
                    >
                        Back to Sign In Page
                    </button>
                </div>
            </div>
        </div >
    )

}

export default LoginPg;