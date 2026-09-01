import { del } from "idb-keyval";

interface SessionStateManager {
    readonly songs: string;
    readonly checkCurrSongOnReturnToDashboard: string;
    readonly editorSong: string,
    readonly playingSong: string,
    readonly idbEditorSongImgRef: string;
    readonly idbTerminalCurrSong: string; //here to show up in autocomplete 
    getTabSessionId: () => string;
    handleSignOut: () => void;
}

let _tabSessionIdCache: string | null = null;

export const sessionStateManager: SessionStateManager = {
    songs: 'songs',
    checkCurrSongOnReturnToDashboard: 'checkCurrSongOnReturnToDashboard',
    editorSong: 'editorSong',
    playingSong: 'playingSong',

    //if we have sessionStateManager.idbTerminalCurrSong then it auto sets it on the first iteration 
    getTabSessionId() {
        if (_tabSessionIdCache === null) {
            let id = sessionStorage.getItem('tabSessionId');
            if (!id) {
                id = crypto.randomUUID();
                sessionStorage.setItem('tabSessionId', id);
            }
            _tabSessionIdCache = id;
        }
        return _tabSessionIdCache;
    },

    get idbTerminalCurrSong() {
        return `song:${this.getTabSessionId()}`;
    },

    get idbEditorSongImgRef() {
        return `editor-song-ref-img:${this.getTabSessionId()}`;
    },

    async handleSignOut() {
        try {
            await Promise.all([
                del(sessionStateManager.idbTerminalCurrSong),
                del(sessionStateManager.idbEditorSongImgRef)
            ]);
        }
        catch (err) {
            console.error('Failed to delete curr song or editor ref img from idb on logout', err)
        }

        _tabSessionIdCache = null;
        sessionStorage.removeItem('tabSessionId');
        sessionStorage.removeItem(this.songs);
        sessionStorage.removeItem(this.checkCurrSongOnReturnToDashboard);
        sessionStorage.removeItem(this.editorSong);
        sessionStorage.removeItem(this.playingSong);

    }
};