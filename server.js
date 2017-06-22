const path = require( 'path' );

const express = require( 'express' );
const basicAuth = require( 'express-basic-auth' );

const LISTEN_PORT =  4000;

const app = express();
const users = {};

// eslint-disable-next-line no-process-env
users[ process.env.ACCESS_USERNAME ] = process.env.ACCESS_PASSWORD;

const getUnauthorizedResponse = function getUnauthorizedResponse ( request ) {
    if ( request.auth ) {
        return `Credentials ${ request.auth.user }:${ request.auth.password } rejected`;
    }

    return 'No credentials provided';
};

app.use( basicAuth( {
    challenge: true,
    unauthorizedResponse: getUnauthorizedResponse,
    users: users,
} ) );
app.use( express.static( path.join( __dirname, 'web' ) ) );

app.listen( LISTEN_PORT, () => {
    // eslint-disable-next-line no-process-env
    console.log( `Admin interface listening on port ${ process.env.PORT || LISTEN_PORT }!` );
} );
