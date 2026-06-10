import 'dotenv/config';

import path from 'path';

import express from 'express';
import cookieParser from 'cookie-parser';

import { getQueueCounts } from './queues.js';
import { isConfigured as twitchConfigured, searchGames } from './twitch.js';
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
