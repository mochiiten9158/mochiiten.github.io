/* =========================================================
   SHAMBHAWI SHARMA PORTFOLIO
   Spotify + Interactions
========================================================= */


/* =========================================================
   SPOTIFY CONFIGURATION
========================================================= */

/*
    IMPORTANT:

    Replace this with your Spotify application's Client ID.

    Do NOT put a Spotify Client Secret in this file.

    This implementation uses Authorization Code + PKCE,
    which is designed for browser-based applications.
*/

const SPOTIFY_CLIENT_ID = "35a0986ab845424ab49ae52549f9c943";


/*
    IMPORTANT:

    This must EXACTLY match the Redirect URI registered
    in your Spotify Developer Dashboard.

    For GitHub Pages:

        https://mochiiten9158.github.io/

    If your repository is a project site instead of a
    username.github.io site, change this accordingly.
*/

const SPOTIFY_REDIRECT_URI =
    "https://mochiiten9158.github.io/mochiiten.github.io/";


const SPOTIFY_SCOPES = [
    "user-top-read",
    "user-read-currently-playing",
    "user-read-playback-state"
].join(" ");


/* =========================================================
   DOM
========================================================= */

const connectButton =
    document.getElementById("spotify-connect");

const artistsContainer =
    document.getElementById("top-artists");

const tracksContainer =
    document.getElementById("top-tracks");

const nowPlayingContainer =
    document.getElementById("now-playing-content");

const timeTabs =
    document.querySelectorAll(".time-tab");


/* =========================================================
   PKCE HELPERS
========================================================= */

function generateRandomString(length = 64) {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    let result = "";

    const values =
        crypto.getRandomValues(
            new Uint8Array(length)
        );

    for (let i = 0; i < length; i++) {

        result +=
            characters[
                values[i] % characters.length
            ];

    }

    return result;
}


function base64UrlEncode(arrayBuffer) {

    return btoa(
        String.fromCharCode(
            ...new Uint8Array(arrayBuffer)
        )
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


async function generateCodeChallenge(verifier) {

    const data =
        new TextEncoder().encode(verifier);

    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return base64UrlEncode(digest);
}


/* =========================================================
   START SPOTIFY LOGIN
========================================================= */

async function connectSpotify() {

    if (
        !SPOTIFY_CLIENT_ID ||
        SPOTIFY_CLIENT_ID ===
            "YOUR_SPOTIFY_CLIENT_ID"
    ) {

        alert(
            "Add your Spotify Client ID to script.js first."
        );

        return;
    }


    const verifier =
        generateRandomString(128);

    const challenge =
        await generateCodeChallenge(verifier);

    const state =
        generateRandomString(32);


    localStorage.setItem(
        "spotify_code_verifier",
        verifier
    );

    localStorage.setItem(
        "spotify_state",
        state
    );


    const params =
        new URLSearchParams({

            client_id:
                SPOTIFY_CLIENT_ID,

            response_type:
                "code",

            redirect_uri:
                SPOTIFY_REDIRECT_URI,

            scope:
                SPOTIFY_SCOPES,

            state:
                state,

            code_challenge_method:
                "S256",

            code_challenge:
                challenge

        });


    window.location.href =
        "https://accounts.spotify.com/authorize?" +
        params.toString();
}


/* =========================================================
   EXCHANGE AUTH CODE
========================================================= */

async function exchangeCode(code) {

    const verifier =
        localStorage.getItem(
            "spotify_code_verifier"
        );

    if (!verifier) {

        throw new Error(
            "Missing PKCE verifier."
        );
    }


    const body =
        new URLSearchParams({

            client_id:
                SPOTIFY_CLIENT_ID,

            grant_type:
                "authorization_code",

            code:
                code,

            redirect_uri:
                SPOTIFY_REDIRECT_URI,

            code_verifier:
                verifier

        });


    const response =
        await fetch(
            "https://accounts.spotify.com/api/token",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body

            }
        );


    if (!response.ok) {

        const error =
            await response.text();

        throw new Error(error);
    }


    const data =
        await response.json();


    saveTokens(data);


    localStorage.removeItem(
        "spotify_code_verifier"
    );

    localStorage.removeItem(
        "spotify_state"
    );


    return data.access_token;
}


/* =========================================================
   TOKEN STORAGE
========================================================= */

function saveTokens(data) {

    localStorage.setItem(
        "spotify_access_token",
        data.access_token
    );


    localStorage.setItem(
        "spotify_expires_at",
        String(
            Date.now() +
            data.expires_in * 1000
        )
    );


    if (data.refresh_token) {

        localStorage.setItem(
            "spotify_refresh_token",
            data.refresh_token
        );

    }
}


function getAccessToken() {

    return localStorage.getItem(
        "spotify_access_token"
    );
}


/* =========================================================
   REFRESH TOKEN
========================================================= */

async function refreshAccessToken() {

    const refreshToken =
        localStorage.getItem(
            "spotify_refresh_token"
        );


    if (!refreshToken) {

        return null;
    }


    const body =
        new URLSearchParams({

            grant_type:
                "refresh_token",

            refresh_token:
                refreshToken,

            client_id:
                SPOTIFY_CLIENT_ID

        });


    const response =
        await fetch(
            "https://accounts.spotify.com/api/token",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body

            }
        );


    if (!response.ok) {

        /*
            Spotify refresh tokens expire after six months
            under the current platform rules.

            If that happens, force a fresh login.
        */

        logoutSpotify();

        return null;
    }


    const data =
        await response.json();


    saveTokens(data);


    return data.access_token;
}


/* =========================================================
   VALID TOKEN
========================================================= */

async function getValidAccessToken() {

    const token =
        getAccessToken();

    const expiresAt =
        Number(
            localStorage.getItem(
                "spotify_expires_at"
            )
        );


    if (
        token &&
        expiresAt &&
        Date.now() <
            expiresAt - 60000
    ) {

        return token;
    }


    return await refreshAccessToken();
}


/* =========================================================
   API REQUEST
========================================================= */

async function spotifyFetch(endpoint) {

    let token =
        await getValidAccessToken();


    if (!token) {

        throw new Error(
            "Spotify not connected."
        );
    }


    let response =
        await fetch(
            "https://api.spotify.com/v1" +
            endpoint,
            {

                headers: {
                    Authorization:
                        `Bearer ${token}`
                }

            }
        );


    /*
        Retry once after refreshing.
    */

    if (response.status === 401) {

        token =
            await refreshAccessToken();

        if (!token) {

            throw new Error(
                "Spotify authorization expired."
            );
        }


        response =
            await fetch(
                "https://api.spotify.com/v1" +
                endpoint,
                {

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }

                }
            );
    }


    if (!response.ok) {

        throw new Error(
            `Spotify API error: ${response.status}`
        );
    }


    return await response.json();
}


/* =========================================================
   TOP ARTISTS
========================================================= */

async function loadTopArtists(
    range = "short_term"
) {

    artistsContainer.innerHTML = `
        <div class="spotify-empty">
            <p>LOADING ARTISTS...</p>
        </div>
    `;


    try {

        const data =
            await spotifyFetch(
                `/me/top/artists?time_range=${range}&limit=10`
            );


        renderArtists(
            data.items
        );

    } catch (error) {

        console.error(error);

        artistsContainer.innerHTML = `
            <div class="spotify-empty">
                <p>
                    COULD NOT LOAD SPOTIFY DATA.
                    <br><br>
                    PLEASE RECONNECT.
                </p>
            </div>
        `;
    }
}


/* =========================================================
   RENDER ARTISTS
========================================================= */

function renderArtists(artists) {

    if (!artists || !artists.length) {

        artistsContainer.innerHTML = `
            <div class="spotify-empty">
                <p>
                    NO LISTENING DATA AVAILABLE.
                </p>
            </div>
        `;

        return;
    }


    artistsContainer.innerHTML =
        artists
            .map(
                (artist, index) => {

                    const image =
                        artist.images &&
                        artist.images.length
                            ? artist.images[
                                artist.images.length - 1
                              ].url
                            : "";


                    return `

                        <a
                            class="artist-card"
                            href="${artist.external_urls.spotify}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            ${
                                image
                                ?
                                `<img
                                    class="artist-image"
                                    src="${image}"
                                    alt="${escapeHTML(artist.name)}"
                                >`
                                :
                                `<div class="artist-image"></div>`
                            }

                            <span class="artist-rank">
                                ${String(index + 1).padStart(2, "0")}
                            </span>

                            <div class="artist-info">

                                <h4>
                                    ${escapeHTML(artist.name)}
                                </h4>

                                <p>
                                    ${
                                        artist.genres &&
                                        artist.genres.length
                                            ? escapeHTML(
                                                artist.genres
                                                    .slice(0, 2)
                                                    .join(" / ")
                                              )
                                            : "ARTIST"
                                    }
                                </p>

                            </div>

                        </a>

                    `;
                }
            )
            .join("");
}


/* =========================================================
   TOP TRACKS
========================================================= */

async function loadTopTracks(
    range = "short_term"
) {

    try {

        const data =
            await spotifyFetch(
                `/me/top/tracks?time_range=${range}&limit=8`
            );


        renderTracks(
            data.items
        );

    } catch (error) {

        console.error(error);

        tracksContainer.innerHTML = `
            <p class="tracks-placeholder">
                COULD NOT LOAD TRACKS.
            </p>
        `;
    }
}


/* =========================================================
   RENDER TRACKS
========================================================= */

function renderTracks(tracks) {

    if (!tracks || !tracks.length) {

        tracksContainer.innerHTML = `
            <p class="tracks-placeholder">
                NO TRACK DATA AVAILABLE.
            </p>
        `;

        return;
    }


    tracksContainer.innerHTML =
        tracks
            .map(
                (track, index) => {

                    const image =
                        track.album &&
                        track.album.images &&
                        track.album.images.length
                            ? track.album.images[
                                track.album.images.length - 1
                              ].url
                            : "";


                    const artists =
                        track.artists
                            .map(
                                artist =>
                                    artist.name
                            )
                            .join(", ");


                    return `

                        <div class="track-row">

                            <span class="track-number">
                                ${String(index + 1).padStart(2, "0")}
                            </span>

                            ${
                                image
                                ?
                                `<img
                                    class="track-image"
                                    src="${image}"
                                    alt="${escapeHTML(track.name)}"
                                >`
                                :
                                `<div class="track-image"></div>`
                            }

                            <div class="track-info">

                                <h4>
                                    ${escapeHTML(track.name)}
                                </h4>

                                <p>
                                    ${escapeHTML(artists)}
                                </p>

                            </div>

                            <a
                                class="track-link"
                                href="${track.external_urls.spotify}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                OPEN ↗
                            </a>

                        </div>

                    `;
                }
            )
            .join("");
}


/* =========================================================
   NOW PLAYING
========================================================= */

async function loadNowPlaying() {

    try {

        const token =
            await getValidAccessToken();


        if (!token) {

            return;
        }


        const response =
            await fetch(
                "https://api.spotify.com/v1/me/player/currently-playing",
                {

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }

                }
            );


        /*
            204 means Spotify isn't currently playing.
        */

        if (response.status === 204) {

            renderNotPlaying();

            return;
        }


        if (!response.ok) {

            throw new Error(
                "Unable to load playback."
            );
        }


        const data =
            await response.json();


        if (
            !data ||
            !data.item
        ) {

            renderNotPlaying();

            return;
        }


        renderNowPlaying(data);


    } catch (error) {

        console.error(error);

        renderNotPlaying();
    }
}


/* =========================================================
   RENDER NOW PLAYING
========================================================= */

function renderNowPlaying(data) {

    const track =
        data.item;


    const image =
        track.album &&
        track.album.images &&
        track.album.images.length
            ? track.album.images[
                track.album.images.length - 1
              ].url
            : "";


    const artists =
        track.artists
            .map(
                artist =>
                    artist.name
            )
            .join(", ");


    const progress =
        data.progress_ms || 0;

    const duration =
        track.duration_ms || 1;

    const percent =
        Math.min(
            100,
            (progress / duration) * 100
        );


    nowPlayingContainer.innerHTML = `

        <div class="np-active">

            ${
                image
                ?
                `<img
                    src="${image}"
                    alt="${escapeHTML(track.name)}"
                >`
                :
                `<div class="track-image"></div>`
            }

            <div class="np-info">

                <span>
                    ${data.is_playing ? "PLAYING NOW" : "PAUSED"}
                </span>

                <h4>
                    ${escapeHTML(track.name)}
                </h4>

                <p>
                    ${escapeHTML(artists)}
                </p>

            </div>

            <div class="np-progress">

                <div class="progress-bar">

                    <div
                        class="progress-fill"
                        style="width:${percent}%"
                    ></div>

                </div>

                <div class="progress-time">

                    <span>
                        ${formatTime(progress)}
                    </span>

                    <span>
                        ${formatTime(duration)}
                    </span>

                </div>

            </div>

        </div>

    `;
}


function renderNotPlaying() {

    nowPlayingContainer.innerHTML = `

        <div class="np-placeholder">

            <span>♫</span>

            <p>
                NOTHING PLAYING RIGHT NOW.<br>
                PROBABLY THINKING ABOUT MUSIC ANYWAY.
            </p>

        </div>

    `;
}


/* =========================================================
   TIME RANGE TABS
========================================================= */

timeTabs.forEach(tab => {

    tab.addEventListener(
        "click",
        async () => {

            timeTabs.forEach(
                button =>
                    button.classList.remove(
                        "active"
                    )
            );


            tab.classList.add(
                "active"
            );


            const range =
                tab.dataset.range;


            if (!getAccessToken()) {

                return;
            }


            await loadTopArtists(
                range
            );

            await loadTopTracks(
                range
            );

        }
    );

});


/* =========================================================
   CONNECT BUTTON
========================================================= */

if (connectButton) {

    connectButton.addEventListener(
        "click",
        connectSpotify
    );
}


/* =========================================================
   CALLBACK HANDLING
========================================================= */

async function handleSpotifyCallback() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const code =
        params.get("code");

    const state =
        params.get("state");

    const error =
        params.get("error");


    if (error) {

        console.error(
            "Spotify authorization error:",
            error
        );

        cleanURL();

        return;
    }


    if (!code) {

        return;
    }


    const storedState =
        localStorage.getItem(
            "spotify_state"
        );


    /*
        Verify OAuth state.
    */

    if (
        !state ||
        !storedState ||
        state !== storedState
    ) {

        console.error(
            "Spotify state mismatch."
        );

        cleanURL();

        return;
    }


    try {

        await exchangeCode(
            code
        );


        cleanURL();


        await initializeSpotify();

    } catch (error) {

        console.error(error);

        alert(
            "Spotify connection failed. Check your redirect URI and Client ID."
        );

    }

}


/* =========================================================
   CLEAN URL
========================================================= */

function cleanURL() {

    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );
}


/* =========================================================
   LOGOUT
========================================================= */

function logoutSpotify() {

    localStorage.removeItem(
        "spotify_access_token"
    );

    localStorage.removeItem(
        "spotify_refresh_token"
    );

    localStorage.removeItem(
        "spotify_expires_at"
    );

    renderNotPlaying();

    artistsContainer.innerHTML = `
        <div class="spotify-empty">
            <p>
                CONNECT SPOTIFY TO SEE<br>
                YOUR TOP ARTISTS
            </p>
        </div>
    `;

    tracksContainer.innerHTML = `
        <p class="tracks-placeholder">
            Connect Spotify to load listening data.
        </p>
    `;
}


/* =========================================================
   INITIALIZE SPOTIFY
========================================================= */

async function initializeSpotify() {

    const token =
        await getValidAccessToken();


    if (!token) {

        return;
    }


    if (connectButton) {

        connectButton.innerHTML =
            `<span class="spotify-icon">●</span>
             SPOTIFY CONNECTED`;

        connectButton.style.background =
            "var(--paper)";
    }


    const activeTab =
        document.querySelector(
            ".time-tab.active"
        );


    const range =
        activeTab
            ? activeTab.dataset.range
            : "short_term";


    await loadTopArtists(
        range
    );

    await loadTopTracks(
        range
    );

    await loadNowPlaying();


    /*
        Refresh currently-playing data every 30 seconds.
    */

    setInterval(
        loadNowPlaying,
        30000
    );
}


/* =========================================================
   UTILITIES
========================================================= */

function formatTime(milliseconds) {

    const seconds =
        Math.floor(
            milliseconds / 1000
        );

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remaining =
        seconds % 60;


    return `${minutes}:${String(
        remaining
    ).padStart(2, "0")}`;
}


function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value;

    return div.innerHTML;
}


/* =========================================================
   START
========================================================= */

(async function init() {

    await handleSpotifyCallback();

    await initializeSpotify();

})();