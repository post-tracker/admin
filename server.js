import 'dotenv/config';

import path from 'path';

import express from 'express';
import cookieParser from 'cookie-parser';

import { getQueueCounts } from './queues.js';
import { isConfigured as twitchConfigured, searchGames } from './twitch.js';
import { findRedditDevelopers, sampleFlairs } from './reddit.js';
import { findSteamDevelopers, resolveSteam, searchSteamGames } from './steam.js';
import { addIgnore, discover as discoverGames, removeIgnore } from './gameFinder.js';
import { createQueuesRouter } from './bullBoard.js';

const LISTEN_PORT = 4000;
const INTERNAL_SERVER_ERROR = 500;
const SERVICE_UNAVAILABLE = 503;
const QUEUES_BASE_PATH = '/queues';

const app = express();

const API_TOKEN = process.env.API_TOKEN;

if ( !API_TOKEN ) {
    throw new Error( 'Unable to load API token' );
}

app.use( cookieParser() );
app.use( express.static( path.join( import.meta.dirname, 'web' ) ) );

app.get( '/api-token', ( request, response ) => {
    response.send( API_TOKEN );
} );

app.get( '/api/queues', async ( request, response ) => {
    try {
        response.json( await getQueueCounts() );
    } catch ( queuesError ) {
        console.error( queuesError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Failed to read queues',
        } );
    }
} );

// Twitch game search for the box art picker. The browser can't call Twitch
// (CORS + the client secret), so the lookup happens here; see twitch.js. Reports
// 503 when no Twitch credentials are configured so the picker can fall back to
// manual entry.
app.get( '/api/twitch-games', async ( request, response ) => {
    if ( !twitchConfigured() ) {
        response.status( SERVICE_UNAVAILABLE ).json( {
            error: 'Twitch not configured',
        } );

        return;
    }

    try {
        response.json( {
            results: await searchGames( request.query.q ),
        } );
    } catch ( twitchError ) {
        console.error( twitchError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Twitch lookup failed',
        } );
    }
} );

// Subreddit flair sampler for the Reddit flair editor (see reddit.js). The
// browser can't read reddit.com (CORS), so the scan happens here. No credentials
// needed — uses the public .json endpoints — so a failure is a real upstream
// error (rate limit, banned/empty subreddit), reported as 500.
app.get( '/api/reddit-flairs', async ( request, response ) => {
    try {
        response.json( await sampleFlairs( request.query.subreddit ) );
    } catch ( redditError ) {
        console.error( redditError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Reddit flair scan failed',
        } );
    }
} );

// Reddit developer finder for the Game Sources editor: given a subreddit plus the
// game's flair config (`type` + comma-separated `blocklist`), scans recent posts
// and comment threads and returns the distinct users wearing a non-blocklisted
// flair — the set the finder would treat as devs. Same CORS rationale as the
// flair scan above; see reddit.js findRedditDevelopers.
app.get( '/api/reddit-devs', async ( request, response ) => {
    const blocklist = String( request.query.blocklist || '' )
        .split( ',' )
        .map( ( value ) => {
            return value.trim();
        } )
        .filter( Boolean );

    try {
        response.json( {
            developers: await findRedditDevelopers( request.query.subreddit, {
                blocklist: blocklist,
                type: request.query.type,
            } ),
        } );
    } catch ( redditError ) {
        console.error( redditError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Reddit developer lookup failed',
        } );
    }
} );

// Steam id resolver for the Game Sources editor: given a community id, vanity
// slug, or Steam URL, returns the numeric app id (for the forum/discussions
// scrape) and the announcement-feed item count. The browser can't read
// steamcommunity.com (CORS), so the lookup happens here; see steam.js. No
// credentials needed (public Steam pages), so a failure is a real upstream error.
app.get( '/api/steam-resolve', async ( request, response ) => {
    try {
        response.json( await resolveSteam( request.query.id ) );
    } catch ( steamError ) {
        console.error( steamError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Steam resolve failed',
        } );
    }
} );

// Steam game search for the Game Sources editor's Steam picker: given a name,
// returns matching games ([{ appId, name, icon }]) so the admin picks one
// instead of pasting a numeric app id. The browser can't read steamcommunity.com
// (CORS), so the search happens here; see steam.js. No credentials needed (public
// endpoint), so a failure is a real upstream error.
app.get( '/api/steam-search', async ( request, response ) => {
    try {
        response.json( {
            results: await searchSteamGames( request.query.q ),
        } );
    } catch ( steamError ) {
        console.error( steamError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Steam search failed',
        } );
    }
} );

// Steam developer finder for the Game Sources editor: given a numeric app id,
// scrapes the discussions forum for Steam's own Developer-badged authors so the
// admin can add a game's devs without hunting down each SteamID. The browser
// can't read steamcommunity.com (CORS), so it happens here; see steam.js. No
// credentials needed (public pages).
app.get( '/api/steam-devs', async ( request, response ) => {
    try {
        response.json( {
            developers: await findSteamDevelopers( request.query.appId ),
        } );
    } catch ( steamError ) {
        console.error( steamError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Steam developer lookup failed',
        } );
    }
} );

// Game Finder discovery scan: untracked games trending on Twitch / topping
// Steam's Early Access sellers. Runs server-side (Twitch secret + Steam CORS),
// result cached ~10 min; ?force=1 (the Rescan button) bypasses the cache. An
// unconfigured Twitch just yields Steam-only results, so no 503.
app.get( '/api/game-finder', async ( request, response ) => {
    try {
        response.json( await discoverGames( {
            force: request.query.force === '1',
        } ) );
    } catch ( finderError ) {
        console.error( finderError );
        response.status( INTERNAL_SERVER_ERROR ).json( {
            error: 'Game finder scan failed',
        } );
    }
} );

// Add / remove a game from the persistent ignore list. The name is passed in
// the query string (not a JSON body) so the dev-server middleware can mirror
// this without body parsing. Returns the updated ignore list.
app.post( '/api/game-finder/ignore', ( request, response ) => {
    response.json( {
        ignored: addIgnore( request.query.name || '' ),
    } );
} );

app.post( '/api/game-finder/unignore', ( request, response ) => {
    response.json( {
        ignored: removeIgnore( request.query.name || '' ),
    } );
} );

// The full Bull Board UI, behind the same basic auth the rest of the admin sits
// behind. Only mounted when a REDIS_URL is configured (otherwise null).
const queuesRouter = createQueuesRouter( QUEUES_BASE_PATH );

if ( queuesRouter ) {
    app.use( QUEUES_BASE_PATH, queuesRouter );
}

// SPA fallback: the client uses BrowserRouter (clean paths like /games), so a
// direct hit or refresh on a client route must return the built shell rather
// than 404. This runs only for requests not matched above — real assets
// (express.static), /api-token, /api/queues, and /queues are all registered
// earlier, so the router takes only what's left. (Express 5 requires the
// wildcard to be named, hence '*splat' rather than '*'.)
app.get( '*splat', ( request, response ) => {
    response.sendFile( path.join( import.meta.dirname, 'web', 'index.html' ) );
} );

app.listen( process.env.PORT || LISTEN_PORT, '0.0.0.0', () => {
    console.log( `Admin interface listening on port ${ process.env.PORT || LISTEN_PORT }!` );
} );
