require('dotenv').config();

const path = require( 'path' );

const express = require( 'express' );
const basicAuth = require( 'express-basic-auth' );
const cookieParser = require( 'cookie-parser' );

const LISTEN_PORT =  4000;

const app = express();
const users = {};

// eslint-disable-next-line no-process-env
const API_TOKEN = process.env.API_TOKEN;

if ( !API_TOKEN ) {
    throw new Error( 'Unable to load API token' );
}

// eslint-disable-next-line no-process-env
users[ process.env.ACCESS_USERNAME ] = process.env.ACCESS_PASSWORD;

const getUnauthorizedResponse = function getUnauthorizedResponse ( request ) {
    if ( request.auth ) {
        return `Credentials ${ request.auth.user }:${ request.auth.password } rejected`;
    }

    return 'No credentials provided';
};

app.use( cookieParser() );
app.use( express.static( path.join( __dirname, 'web' ) ) );

app.get( '/api-token', ( request, response ) => {
    response.send( API_TOKEN );
} );

app.listen( process.env.PORT || LISTEN_PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-process-env
    console.log( `Admin interface listening on port ${ process.env.PORT || LISTEN_PORT }!` );
} );
