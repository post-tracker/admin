import https from 'https';
import querystring from 'querystring';

// const API_HOSTNAME = 'lvh.me';
// const API_HOSTNAME = 'localhost';
// const API_PORT = 3000;
const API_HOSTNAME = 'api.kokarn.com';
const API_PORT = 443;
const SUCESS_STATUS_CODE = 200;

const get = function get ( requestPath, queryParams ) {
    return new Promise( ( resolve, reject ) => {
        const options = {
            headers: {
                Authorization: `Bearer ${ window.apiToken }`,
            },
            hostname: API_HOSTNAME,
            method: 'GET',
            path: requestPath,
            port: API_PORT,
        };

        if ( queryParams ) {
            options.path = `${ options.path }?${ querystring.stringify( queryParams ) }`;
        }

        const request = https.request( options, ( response ) => {
            let body = '';

            response.setEncoding( 'utf8' );

            if ( response.statusCode !== SUCESS_STATUS_CODE ) {
                reject( new Error( `${ API_HOSTNAME }${ requestPath } returned ${ response.statusCode }` ) );

                return false;
            }

            response.on( 'data', ( chunk ) => {
                body = body + chunk;
            } );

            response.on( 'end', () => {
                resolve( JSON.parse( body ) );
            } );

            return true;
        } );

        request.on( 'error', ( requestError ) => {
            console.log( requestError );
            reject( requestError );
        } );

        request.end();
    } );
};

const post = function post ( requestPath, item ) {
    return new Promise( ( resolve, reject ) => {
        const payload = JSON.stringify( item );
        const options = {
            headers: {
                Authorization: `Bearer ${ window.apiToken }`,
                'Content-Length': Buffer.byteLength( payload ),
                'Content-Type': 'application/json',
            },
            hostname: API_HOSTNAME,
            method: 'POST',
            path: requestPath,
            port: API_PORT,
        };

        const request = https.request( options, ( response ) => {
            response.setEncoding( 'utf8' );

            if ( response.statusCode !== SUCESS_STATUS_CODE ) {
                reject( new Error( `${ API_HOSTNAME }${ requestPath } returned ${ response.statusCode }` ) );

                return false;
            }

            resolve();

            return true;
        } );

        request.on( 'error', ( requestError ) => {
            reject( requestError );
        } );

        request.write( payload );

        request.end();
    } );
};

const patch = function patch ( requestPath, id, properties ) {
    return new Promise( ( resolve, reject ) => {
        const payload = JSON.stringify( {
            id: id,
            properties: properties,
        } );
        const options = {
            headers: {
                Authorization: `Bearer ${ window.apiToken }`,
                'Content-Length': Buffer.byteLength( payload ),
                'Content-Type': 'application/json',
            },
            hostname: API_HOSTNAME,
            method: 'PATCH',
            path: requestPath,
            port: API_PORT,
        };

        const request = https.request( options, ( response ) => {
            response.setEncoding( 'utf8' );

            if ( response.statusCode !== SUCESS_STATUS_CODE ) {
                reject( new Error( `${ API_HOSTNAME }${ requestPath } returned ${ response.statusCode }` ) );

                return false;
            }

            resolve();

            return true;
        } );

        request.on( 'error', ( requestError ) => {
            reject( requestError );
        } );

        request.write( payload );

        request.end();
    } );
};

const deleteResource = function deleteResource ( resourcePath ) {
    return new Promise( ( resolve, reject ) => {
        const options = {
            headers: {
                Authorization: `Bearer ${ window.apiToken }`,
            },
            hostname: API_HOSTNAME,
            method: 'DELETE',
            path: resourcePath,
            port: API_PORT,
        };

        const request = https.request( options, ( response ) => {
            response.setEncoding( 'utf8' );

            if ( response.statusCode !== SUCESS_STATUS_CODE ) {
                reject( new Error( `${ API_HOSTNAME }${ resourcePath } returned ${ response.statusCode }` ) );

                return false;
            }

            resolve();

            return true;
        } );

        request.on( 'error', ( requestError ) => {
            console.log( requestError );
            reject( requestError );
        } );

        request.end();
    } );
};

module.exports = {
    deleteResource: deleteResource,
    get: get,
    patch: patch,
    post: post,
};
