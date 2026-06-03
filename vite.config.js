import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import express from 'express';

import { getQueueCounts } from './queues.js';
import { createQueuesRouter } from './bullBoard.js';

const QUEUES_BASE_PATH = '/queues';

// Load the same .env the production server (server.js) uses, so the dev
// /api-token endpoint below can hand out the real token.
dotenv.config();

// Dev-only middleware that mirrors server.js's /api-token route. In production
// the built bundle is served by server.js, which serves this same endpoint.
const apiTokenPlugin = {
    name: 'dev-api-token',
    configureServer ( server ) {
        server.middlewares.use( '/api-token', ( request, response ) => {
            response.end( process.env.API_TOKEN || '' );
        } );
    },
};

// Mirrors server.js's /api/queues route in dev so the dashboard's queue panel
// works under `vite`. Returns [] when no REDIS_URL is set (no local Redis).
const apiQueuesPlugin = {
    name: 'dev-api-queues',
    configureServer ( server ) {
        server.middlewares.use( '/api/queues', async ( request, response ) => {
            try {
                const data = await getQueueCounts();

                response.setHeader( 'Content-Type', 'application/json' );
                response.end( JSON.stringify( data ) );
            } catch ( queuesError ) {
                response.statusCode = 500;
                response.end( JSON.stringify( {
                    error: queuesError.message,
                } ) );
            }
        } );
    },
};

// Mirrors server.js's Bull Board mount in dev so /queues works under `vite`.
// Bull Board's router needs Express semantics (ejs render / express.static), so
// it's mounted on a tiny Express sub-app rather than directly on Vite's connect
// stack. Skipped when no REDIS_URL is set (router is null).
const bullBoardPlugin = {
    name: 'dev-bull-board',
    configureServer ( server ) {
        const router = createQueuesRouter( QUEUES_BASE_PATH );

        if ( !router ) {
            return;
        }

        const subApp = express();

        subApp.use( QUEUES_BASE_PATH, router );
        server.middlewares.use( subApp );
    },
};

// When launched through portless, it injects PORT/HOST (the port it proxies to)
// and PORTLESS_URL (the public https://<name>.localhost address). Honour those so
// Vite binds where the proxy expects and HMR connects back through it. Without
// portless these are unset and Vite falls back to its own defaults — no port is
// ever hardcoded here.
const port = process.env.PORT ? Number( process.env.PORT ) : undefined;
const host = process.env.HOST || undefined;

let hmr;

if ( process.env.PORTLESS_URL ) {
    const portlessUrl = new URL( process.env.PORTLESS_URL );

    hmr = {
        clientPort: portlessUrl.port
            ? Number( portlessUrl.port )
            : 443,
        host: portlessUrl.hostname,
        protocol: 'wss',
    };
}

export default defineConfig( {
    plugins: [
        react(),
        apiTokenPlugin,
        apiQueuesPlugin,
        bullBoardPlugin,
    ],
    build: {
        // Build into web/, which server.js serves statically in production.
        outDir: 'web',
        emptyOutDir: true,
    },
    server: {
        // Allow the .localhost hostnames portless proxies through.
        allowedHosts: [ '.localhost' ],
        hmr: hmr,
        host: host,
        port: port,
    },
} );
