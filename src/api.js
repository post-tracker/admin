// The admin talks to the production rest-api by default; the token served at
// /api-token authorises it, so data loads with no extra services running.
// To develop against a local rest-api instead, set VITE_API_BASE in .env — use
// an https origin (e.g. a portless https://*.localhost URL) so the browser does
// not block it as mixed content under the https dev server.
const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.developertracker.com';

const authHeaders = function authHeaders ( extra ) {
    return {
        Authorization: `Bearer ${ window.apiToken }`,
        ...extra,
    };
};

const ensureOk = function ensureOk ( response, requestPath ) {
    if ( !response.ok ) {
        throw new Error( `${ API_BASE }${ requestPath } returned ${ response.status }` );
    }

    return response;
};

const get = function get ( requestPath, queryParams ) {
    let path = requestPath;

    if ( queryParams ) {
        path = `${ path }?${ new URLSearchParams( queryParams ).toString() }`;
    }

    return fetch( `${ API_BASE }${ path }`, {
        headers: authHeaders(),
        method: 'GET',
    } )
        .then( ( response ) => {
            return ensureOk( response, path );
        } )
        .then( ( response ) => {
            return response.json();
        } );
};

const post = function post ( requestPath, item ) {
    return fetch( `${ API_BASE }${ requestPath }`, {
        body: JSON.stringify( item ),
        headers: authHeaders( {
            'Content-Type': 'application/json',
        } ),
        method: 'POST',
    } )
        .then( ( response ) => {
            ensureOk( response, requestPath );
        } );
};

const patch = function patch ( requestPath, id, properties ) {
    return fetch( `${ API_BASE }${ requestPath }`, {
        body: JSON.stringify( {
            id: id,
            properties: properties,
        } ),
        headers: authHeaders( {
            'Content-Type': 'application/json',
        } ),
        method: 'PATCH',
    } )
        .then( ( response ) => {
            ensureOk( response, requestPath );
        } );
};

const deleteResource = function deleteResource ( resourcePath ) {
    return fetch( `${ API_BASE }${ resourcePath }`, {
        headers: authHeaders(),
        method: 'DELETE',
    } )
        .then( ( response ) => {
            ensureOk( response, resourcePath );
        } );
};

export default {
    deleteResource: deleteResource,
    get: get,
    patch: patch,
    post: post,
};
