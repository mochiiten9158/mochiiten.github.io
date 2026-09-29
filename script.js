/* ============================================================
   KAYA — GOTHIC ARCHIVE
   JavaScript
   ============================================================ */


/* ============================================================
   GENERAL SITE BEHAVIOR
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    initializeNavigation();
    initializeRevealEffects();
    initializeSpotify();

});


/* ============================================================
   NAVIGATION
   ============================================================ */

function initializeNavigation() {

    const links = document.querySelectorAll(
        ".main-nav a"
    );

    links.forEach(link => {

        link.addEventListener("click", () => {

            document.body.classList.remove(
                "nav-open"
            );

        });

    });

}


/* ============================================================
   SUBTLE REVEAL EFFECT
   ============================================================ */

function initializeRevealEffects() {

    const elements = document.querySelectorAll(
        ".project-card, .topic, .timeline-item, .publication, .metric"
    );

    if (!("IntersectionObserver" in window)) {
        return;
    }

    const observer = new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.style.opacity = "1";
                    entry.target.style.transform =
                        "translateY(0)";

                    observer.unobserve(
                        entry.target
                    );

                }

            });

        },
        {
            threshold: 0.08
        }
    );

    elements.forEach(element => {

        element.style.opacity = "0";
        element.style.transform =
            "translateY(18px)";

        element.style.transition =
            "opacity 0.7s ease, transform 0.7s ease";

        observer.observe(element);

    });

}


/* ============================================================
   SPOTIFY CONFIGURATION
   ============================================================

   IMPORTANT:

   Replace YOUR_SPOTIFY_CLIENT_ID with the Client ID from
   your Spotify Developer app.

   Do NOT put a Spotify Client Secret here.

   ============================================================ */

const SPOTIFY_CLIENT_ID =
    "35a0986ab845424ab49ae52549f9c943";


/*
    This must EXACTLY match the Redirect URI registered
    in your Spotify Developer Dashboard.

    For your GitHub Pages site:
*/

const SPOTIFY_REDIRECT_URI =
    "https://mochiiten9158.github.io/mochiiten.github.io/";


/*
    Permissions needed by this site.

    user-top-read:
        Reads the user's top artists/tracks.

    user-read-currently-playing:
        Reads what the user is currently playing.
*/

const SPOTIFY_SCOPES = [
    "user-top-read",
    "user-read-currently-playing"
].join(" ");


/* ============================================================
   SPOTIFY STORAGE KEYS
   ============================================================ */

const SPOTIFY_ACCESS_TOKEN_KEY =
    "kaya_spotify_access_token";

const SPOTIFY_REFRESH_TOKEN_KEY =
    "kaya_spotify_refresh_token";

const SPOTIFY_EXPIRES_AT_KEY =
    "kaya_spotify_expires_at";

const SPOTIFY_CODE_VERIFIER_KEY =
    "kaya_spotify_code_verifier";

const SPOTIFY_STATE_KEY =
    "kaya_spotify_state";


/* ============================================================
   SPOTIFY INITIALIZATION
   ============================================================ */

async function initializeSpotify() {

    const connectButton =
        document.getElementById(
            "spotify-connect"
        );

    if (!connectButton) {
        return;
    }

    connectButton.addEventListener(
        "click",
        handleSpotifyButton
    );


    /*
        If Spotify redirected us back with
        ?code=...
        process the callback.
    */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code =
        params.get("code");

    const error =
        params.get("error");

    if (error) {

        console.error(
            "Spotify authorization error:",
            error
        );

        cleanSpotifyUrl();

        return;
    }

    if (code) {

        await handleSpotifyCallback(
            code
        );

        return;
    }


    /*
        If we already have a valid token,
        load the Spotify content.
    */

    const token =
        getStoredAccessToken();

    if (token) {

        await loadSpotifyData();

    }

}


/* ============================================================
   SPOTIFY BUTTON
   ============================================================ */

async function handleSpotifyButton() {

    const token =
        await getValidAccessToken();

    if (token) {

        await loadSpotifyData();

        return;
    }

    await beginSpotifyLogin();

}


/* ============================================================
   BEGIN PKCE LOGIN
   ============================================================ */

async function beginSpotifyLogin() {

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


    /*
        PKCE verifier.

        Spotify's current documentation recommends
        Authorization Code + PKCE for browser apps.
    */

    const codeVerifier =
        generateRandomString(64);

    localStorage.setItem(
        SPOTIFY_CODE_VERIFIER_KEY,
        codeVerifier
    );


    /*
        State protects the OAuth callback against
        request-forgery attacks.
    */

    const state =
        generateRandomString(32);

    localStorage.setItem(
        SPOTIFY_STATE_KEY,
        state
    );


    const codeChallenge =
        await generateCodeChallenge(
            codeVerifier
        );


    const authorizationURL =
        new URL(
            "https://accounts.spotify.com/authorize"
        );


    authorizationURL.search =
        new URLSearchParams({

            response_type: "code",

            client_id:
                SPOTIFY_CLIENT_ID,

            scope:
                SPOTIFY_SCOPES,

            code_challenge_method:
                "S256",

            code_challenge:
                codeChallenge,

            redirect_uri:
                SPOTIFY_REDIRECT_URI,

            state

        }).toString();


    window.location.href =
        authorizationURL.toString();

}


/* ============================================================
   RANDOM STRING
   ============================================================ */

function generateRandomString(length) {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    const values =
        crypto.getRandomValues(
            new Uint8Array(length)
        );

    return Array.from(values)
        .map(
            value =>
                characters[
                    value % characters.length
                ]
        )
        .join("");

}


/* ============================================================
   SHA-256
   ============================================================ */

async function sha256(plainText) {

    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(
            plainText
        );

    return window.crypto.subtle.digest(
        "SHA-256",
        data
    );

}


/* ============================================================
   BASE64 URL ENCODING
   ============================================================ */

function base64UrlEncode(input) {

    return btoa(
        String.fromCharCode(
            ...new Uint8Array(input)
        )
    )
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

}


/* ============================================================
   PKCE CODE CHALLENGE
   ============================================================ */

async function generateCodeChallenge(
    codeVerifier
) {

    const hashed =
        await sha256(
            codeVerifier
        );

    return base64UrlEncode(
        hashed
    );

}


/* ============================================================
   CALLBACK
   ============================================================ */

async function handleSpotifyCallback(
    code
) {

    try {

        const returnedState =
            new URLSearchParams(
                window.location.search
            ).get("state");

        const savedState =
            localStorage.getItem(
                SPOTIFY_STATE_KEY
            );


        /*
            Validate OAuth state.
        */

        if (
            !returnedState ||
            !savedState ||
            returnedState !== savedState
        ) {

            throw new Error(
                "Spotify state validation failed."
            );

        }


        const codeVerifier =
            localStorage.getItem(
                SPOTIFY_CODE_VERIFIER_KEY
            );


        if (!codeVerifier) {

            throw new Error(
                "Spotify PKCE verifier is missing."
            );

        }


        /*
            Exchange authorization code
            for access + refresh tokens.
        */

        const response =
            await fetch(
                "https://accounts.spotify.com/api/token",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        new URLSearchParams({

                            grant_type:
                                "authorization_code",

                            code,

                            redirect_uri:
                                SPOTIFY_REDIRECT_URI,

                            client_id:
                                SPOTIFY_CLIENT_ID,

                            code_verifier:
                                codeVerifier

                        })

                }
            );


        if (!response.ok) {

            const message =
                await response.text();

            throw new Error(
                `Spotify token exchange failed: ${message}`
            );

        }


        const tokenData =
            await response.json();


        saveSpotifyTokens(
            tokenData
        );


        localStorage.removeItem(
            SPOTIFY_CODE_VERIFIER_KEY
        );

        localStorage.removeItem(
            SPOTIFY_STATE_KEY
        );


        cleanSpotifyUrl();


        await loadSpotifyData();


    } catch (error) {

        console.error(
            "Spotify callback failed:",
            error
        );

        alert(
            "Spotify connection failed. Check the browser console for details."
        );

    }

}


/* ============================================================
   SAVE TOKENS
   ============================================================ */

function saveSpotifyTokens(
    tokenData
) {

    if (tokenData.access_token) {

        localStorage.setItem(
            SPOTIFY_ACCESS_TOKEN_KEY,
            tokenData.access_token
        );

    }


    if (tokenData.refresh_token) {

        localStorage.setItem(
            SPOTIFY_REFRESH_TOKEN_KEY,
            tokenData.refresh_token
        );

    }


    if (tokenData.expires_in) {

        const expiresAt =
            Date.now() +
            tokenData.expires_in * 1000;

        localStorage.setItem(
            SPOTIFY_EXPIRES_AT_KEY,
            String(expiresAt)
        );

    }

}


/* ============================================================
   STORED ACCESS TOKEN
   ============================================================ */

function getStoredAccessToken() {

    return localStorage.getItem(
        SPOTIFY_ACCESS_TOKEN_KEY
    );

}


/* ============================================================
   VALID ACCESS TOKEN
   ============================================================ */

async function getValidAccessToken() {

    const accessToken =
        localStorage.getItem(
            SPOTIFY_ACCESS_TOKEN_KEY
        );

    const expiresAt =
        Number(
            localStorage.getItem(
                SPOTIFY_EXPIRES_AT_KEY
            )
        );


    if (
        accessToken &&
        expiresAt &&
        Date.now() <
            expiresAt - 60_000
    ) {

        return accessToken;

    }


    /*
        Try refreshing.
    */

    const refreshToken =
        localStorage.getItem(
            SPOTIFY_REFRESH_TOKEN_KEY
        );


    if (!refreshToken) {

        return null;

    }


    return refreshSpotifyToken(
        refreshToken
    );

}


/* ============================================================
   REFRESH TOKEN
   ============================================================ */

async function refreshSpotifyToken(
    refreshToken
) {

    try {

        const response =
            await fetch(
                "https://accounts.spotify.com/api/token",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        new URLSearchParams({

                            grant_type:
                                "refresh_token",

                            refresh_token:
                                refreshToken,

                            client_id:
                                SPOTIFY_CLIENT_ID

                        })

                }
            );


        if (!response.ok) {

            throw new Error(
                "Could not refresh Spotify token."
            );

        }


        const tokenData =
            await response.json();


        saveSpotifyTokens(
            tokenData
        );


        return tokenData.access_token;


    } catch (error) {

        console.error(
            "Spotify refresh failed:",
            error
        );


        clearSpotifyTokens();

        return null;

    }

}


/* ============================================================
   CLEAR SPOTIFY TOKENS
   ============================================================ */

function clearSpotifyTokens() {

    localStorage.removeItem(
        SPOTIFY_ACCESS_TOKEN_KEY
    );

    localStorage.removeItem(
        SPOTIFY_REFRESH_TOKEN_KEY
    );

    localStorage.removeItem(
        SPOTIFY_EXPIRES_AT_KEY
    );

}


/* ============================================================
   CLEAN CALLBACK URL
   ============================================================ */

function cleanSpotifyUrl() {

    const cleanURL =
        window.location.origin +
        window.location.pathname;

    window.history.replaceState(
        {},
        document.title,
        cleanURL
    );

}


/* ============================================================
   SPOTIFY API WRAPPER
   ============================================================ */

async function spotifyFetch(
    endpoint,
    options = {}
) {

    let token =
        await getValidAccessToken();


    if (!token) {

        throw new Error(
            "No valid Spotify access token."
        );

    }


    const response =
        await fetch(
            `https://api.spotify.com/v1${endpoint}`,
            {
                ...options,

                headers: {

                    ...(options.headers || {}),

                    Authorization:
                        `Bearer ${token}`

                }

            }
        );


    /*
        Token may have expired unexpectedly.
    */

    if (response.status === 401) {

        clearSpotifyTokens();

        throw new Error(
            "Spotify session expired."
        );

    }


    return response;

}


/* ============================================================
   LOAD ALL SPOTIFY DATA
   ============================================================ */

async function loadSpotifyData() {

    const button =
        document.getElementById(
            "spotify-connect"
        );


    if (button) {

        button.innerHTML =
            "LOADING SPOTIFY <span>...</span>";

    }


    try {

        await Promise.all([
            loadTopArtists(
                "short_term"
            ),
            loadTopTracks(
                "short_term"
            ),
            loadCurrentlyPlaying()
        ]);


        if (button) {

            button.innerHTML =
                "SPOTIFY CONNECTED <span>✓</span>";

        }


    } catch (error) {

        console.error(
            "Could not load Spotify data:",
            error
        );


        if (button) {

            button.innerHTML =
                "CONNECT SPOTIFY <span>↗</span>";

        }

    }

}


/* ============================================================
   TOP ARTISTS
   ============================================================ */

async function loadTopArtists(
    timeRange = "short_term"
) {

    const response =
        await spotifyFetch(
            `/me/top/artists?time_range=${encodeURIComponent(
                timeRange
            )}&limit=10`
        );


    if (!response.ok) {

        throw new Error(
            "Could not load top artists."
        );

    }


    const data =
        await response.json();


    renderArtists(
        data.items || []
    );

}


/* ============================================================
   RENDER ARTISTS
   ============================================================ */

function renderArtists(
    artists
) {

    const container =
        document.getElementById(
            "top-artists"
        );


    if (!container) {
        return;
    }


    if (!artists.length) {

        container.innerHTML = `
            <div class="spotify-empty">
                NO ARTISTS FOUND.
            </div>
        `;

        return;

    }


    container.innerHTML =
        artists
            .map(
                (artist, index) => {

                    const image =
                        artist.images &&
                        artist.images.length
                            ? artist.images[0].url
                            : "";


                    return `

                        <a
                            class="artist-card"
                            href="${escapeHTML(
                                artist.external_urls?.spotify || "#"
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            ${
                                image
                                    ? `
                                        <img
                                            class="artist-image"
                                            src="${escapeHTML(image)}"
                                            alt="${escapeHTML(
                                                artist.name
                                            )}"
                                            loading="lazy"
                                        >
                                      `
                                    : `
                                        <div
                                            class="artist-image"
                                            style="
                                                display:grid;
                                                place-items:center;
                                                background:#151112;
                                            "
                                        >
                                            ♫
                                        </div>
                                      `
                            }

                            <div class="artist-info">

                                <span class="artist-rank">
                                    ${String(
                                        index + 1
                                    ).padStart(
                                        2,
                                        "0"
                                    )}
                                </span>

                                <h4>
                                    ${escapeHTML(
                                        artist.name
                                    )}
                                </h4>

                            </div>

                        </a>

                    `;

                }
            )
            .join("");

}


/* ============================================================
   TOP TRACKS
   ============================================================ */

async function loadTopTracks(
    timeRange = "short_term"
) {

    const response =
        await spotifyFetch(
            `/me/top/tracks?time_range=${encodeURIComponent(
                timeRange
            )}&limit=10`
        );


    if (!response.ok) {

        throw new Error(
            "Could not load top tracks."
        );

    }


    const data =
        await response.json();


    renderTracks(
        data.items || []
    );

}


/* ============================================================
   RENDER TRACKS
   ============================================================ */

function renderTracks(
    tracks
) {

    const container =
        document.getElementById(
            "top-tracks"
        );


    if (!container) {
        return;
    }


    if (!tracks.length) {

        container.innerHTML = `
            <div class="spotify-empty">
                NO TRACKS FOUND.
            </div>
        `;

        return;

    }


    container.innerHTML =
        tracks
            .map(
                (track, index) => {

                    const image =
                        track.album?.images?.length
                            ? track.album.images[
                                  track.album.images.length - 1
                              ].url
                            : "";


                    const artists =
                        track.artists
                            ?.map(
                                artist =>
                                    artist.name
                            )
                            .join(", ") ||
                        "Unknown Artist";


                    return `

                        <a
                            class="track-row"
                            href="${escapeHTML(
                                track.external_urls?.spotify || "#"
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >

                            <span class="track-number">
                                ${String(
                                    index + 1
                                ).padStart(
                                    2,
                                    "0"
                                )}
                            </span>

                            ${
                                image
                                    ? `
                                        <img
                                            class="track-image"
                                            src="${escapeHTML(image)}"
                                            alt=""
                                            loading="lazy"
                                        >
                                      `
                                    : `
                                        <div class="track-image">
                                            ♫
                                        </div>
                                      `
                            }

                            <div class="track-info">

                                <h4>
                                    ${escapeHTML(
                                        track.name
                                    )}
                                </h4>

                                <p>
                                    ${escapeHTML(
                                        artists
                                    )}
                                </p>

                            </div>

                            <span class="track-album">
                                ${escapeHTML(
                                    track.album?.name ||
                                    ""
                                )}
                            </span>

                        </a>

                    `;

                }
            )
            .join("");

}


/* ============================================================
   CURRENTLY PLAYING
   ============================================================ */

async function loadCurrentlyPlaying() {

    const response =
        await spotifyFetch(
            "/me/player/currently-playing"
        );


    if (response.status === 204) {

        renderCurrentlyPlaying(
            null
        );

        return;

    }


    if (!response.ok) {

        throw new Error(
            "Could not load currently playing."
        );

    }


    const data =
        await response.json();


    if (
        !data ||
        !data.item
    ) {

        renderCurrentlyPlaying(
            null
        );

        return;

    }


    renderCurrentlyPlaying(
        data
    );

}


/* ============================================================
   RENDER CURRENTLY PLAYING
   ============================================================ */

function renderCurrentlyPlaying(
    data
) {

    const container =
        document.getElementById(
            "now-playing-content"
        );


    if (!container) {
        return;
    }


    if (
        !data ||
        !data.item
    ) {

        container.innerHTML = `

            <div class="music-placeholder">

                <span>♩</span>

                <p>
                    Nothing is playing right now.
                </p>

            </div>

        `;

        return;

    }


    const track =
        data.item;


    const image =
        track.album?.images?.length
            ? track.album.images[
                  track.album.images.length - 1
              ].url
            : "";


    const artists =
        track.artists
            ?.map(
                artist =>
                    artist.name
            )
            .join(", ") ||
        "Unknown Artist";


    container.innerHTML = `

        <a
            class="now-playing-track"
            href="${escapeHTML(
                track.external_urls?.spotify || "#"
            )}"
            target="_blank"
            rel="noopener noreferrer"
        >

            ${
                image
                    ? `
                        <img
                            class="now-playing-art"
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(
                                track.name
                            )}"
                        >
                      `
                    : ""
            }

            <div class="now-playing-info">

                <h4>
                    ${escapeHTML(
                        track.name
                    )}
                </h4>

                <p>
                    ${escapeHTML(
                        artists
                    )}
                </p>

            </div>

        </a>

    `;

}


/* ============================================================
   TIME RANGE TABS
   ============================================================ */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                ".time-tab"
            );


        if (!button) {
            return;
        }


        const range =
            button.dataset.range;


        if (!range) {
            return;
        }


        document
            .querySelectorAll(
                ".time-tab"
            )
            .forEach(
                tab =>
                    tab.classList.remove(
                        "active"
                    )
            );


        button.classList.add(
            "active"
        );


        try {

            await loadTopArtists(
                range
            );

            await loadTopTracks(
                range
            );

        } catch (error) {

            console.error(
                "Could not change Spotify time range:",
                error
            );

        }

    }
);


/* ============================================================
   HTML ESCAPING
   ============================================================ */

function escapeHTML(
    value
) {

    if (value === null ||
        value === undefined) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   OPTIONAL:
   PERIODICALLY UPDATE CURRENTLY PLAYING
   ============================================================ */

setInterval(
    async () => {

        const token =
            getStoredAccessToken();


        if (!token) {
            return;
        }


        try {

            await loadCurrentlyPlaying();

        } catch (error) {

            console.debug(
                "Currently-playing refresh skipped."
            );

        }

    },
    30_000
);