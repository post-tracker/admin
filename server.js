import 'dotenv/config';

import path from 'path';

import express from 'express';
import cookieParser from 'cookie-parser';

const LISTEN_PORT = 4000;

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

app.listen( process.env.PORT || LISTEN_PORT, '0.0.0.0', () => {
    console.log( `Admin interface listening on port ${ process.env.PORT || LISTEN_PORT }!` );
} );
