// Twitch game/category search for the box art picker. Turns a typed game name
// into the real box art URL by asking Twitch's catalogue, so the picker no
// longer has to guess CDN slugs.
//
// Note on the slug: Twitch box art lives at `ttv-boxart/{id}_IGDB-{w}x{h}.jpg`,
// where the `_IGDB` only means "art sourced from IGDB" — the {id} is Twitch's
// own game id (a large number, e.g. 1872074204), NOT an IGDB game id (those are
// ~6 digits). So the authoritative source is Twitch's Helix Search Categories
// endpoint, which hands back each match's box_art_url directly; we just resize
// it. No id-shape guessing.
//
// Auth is a Twitch developer app: a client_credentials grant against
// id.twitch.tv yields an app access token, which (with the Client-ID) authorises
// api.twitch.tv/helix. The client secret can't live in the browser, so this runs
// server-side — admin/server.js and the Vite dev middleware expose it at
// /api/twitch-games. With no TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET set,
// searchGames throws and the endpoint reports "not configured" so the picker
// falls back to manual entry.

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const SEARCH_URL = 'https://api.twitch.tv/helix/search/categories';

// How many matches to surface in the picker.
const RESULT_LIMIT = 8;

// Must match BOXART_SIZE in src/boxart.js — every game on developertracker.com
// uses this size, so we normalise Twitch's box_art_url to it.
const BOXART_SIZE = '285x380';

// Refresh the cached token this many ms before it actually expires, so a request
// never races a just-expired token.
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;

const MS_PER_SECOND = 1000;

// Cached app access token: { value, expiresAt } (expiresAt in epoch ms). Reused
// across requests until it nears expiry, like queues.js caches its connections.
let tokenCache = null;

const resolveConfig = function resolveConfig () {
    return {
        clientId: process.env.TWITCH_CLIENT_ID || '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    };
};

export const isConfigured = function isConfigured () {
    const { clientId, clientSecret } = resolveConfig();

    return Boolean( clientId && clientSecret );
};

const getToken = async function getToken () {
    const now = Date.now();

    if ( tokenCache && tokenCache.expiresAt > now ) {
        return tokenCache.value;
    }

    const { clientId, clientSecret } = resolveConfig();

    const params = new URLSearchParams( {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
    } );

    const response = await fetch( `${ TOKEN_URL }?${ params.toString() }`, {
        method: 'POST',
    } );

    if ( !response.ok ) {
        throw new Error( `Twitch token request returned ${ response.status }` );
    }

    const body = await response.json();

    tokenCache = {
        value: body.access_token,
        expiresAt: now + ( body.expires_in * MS_PER_SECOND ) - TOKEN_EXPIRY_MARGIN_MS,
    };

    return tokenCache.value;
};

// Twitch's box_art_url comes either templated (`-{width}x{height}.jpg`) or at a
// fixed size (`-52x72.jpg`); swap whichever trailing size segment for ours so
// every result matches the existing catalogue.
const normaliseBoxartSize = function normaliseBoxartSize ( url ) {
    if ( !url ) {
        return '';
    }

    return url.replace( /-(?:\{width\}x\{height\}|\d+x\d+)\.jpg$/i, `-${ BOXART_SIZE }.jpg` );
};

// Search Twitch's catalogue by name. Returns [{ id, name, boxart }] where
// `boxart` is the ready-to-store CDN URL at our size. Throws when unconfigured
// or on an upstream failure.
export const searchGames = async function searchGames ( query ) {
    const trimmed = ( query || '' ).trim();

    if ( !trimmed ) {
        return [];
    }

    if ( !isConfigured() ) {
        throw new Error( 'Twitch not configured' );
    }

    const token = await getToken();
    const { clientId } = resolveConfig();

    const params = new URLSearchParams( {
        query: trimmed,
        first: String( RESULT_LIMIT ),
    } );

    const response = await fetch( `${ SEARCH_URL }?${ params.toString() }`, {
        headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${ token }`,
        },
    } );

    if ( !response.ok ) {
        throw new Error( `Twitch search request returned ${ response.status }` );
    }

    const body = await response.json();

    return ( body.data || [] ).map( ( game ) => {
        return {
            id: game.id,
            name: game.name,
            boxart: normaliseBoxartSize( game.box_art_url ),
        };
    } );
};
