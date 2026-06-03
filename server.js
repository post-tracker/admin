import 'dotenv/config';

import path from 'path';

import express from 'express';
import cookieParser from 'cookie-parser';

import { getQueueCounts } from './queues.js';

const LISTEN_PORT = 4000;
const INTERNAL_SERVER_ERROR = 500;

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

app.listen( process.env.PORT || LISTEN_PORT, '0.0.0.0', () => {
    console.log( `Admin interface listening on port ${ process.env.PORT || LISTEN_PORT }!` );
} );
