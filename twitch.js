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
const GAMES_URL = 'https://api.twitch.tv/helix/games';
const STREAMS_URL = 'https://api.twitch.tv/helix/streams';

// How many matches to surface in the picker.
const RESULT_LIMIT = 8;

// Game Finder discovery. Viewers are read per game, not from the global stream
// firehose: Helix's /games?name= resolves up to this many names per request, and
// a single /streams?game_id= page (max 100) captures effectively the whole live
// audience for any game small enough to be a tracking candidate.
const GAMES_LOOKUP_CHUNK = 100;
const STREAMS_PER_GAME = 100;

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

// Authenticated Helix GET helper for the discovery calls below.
const helix = async function helix ( url ) {
    const token = await getToken();
    const { clientId } = resolveConfig();

    const response = await fetch( url, {
        headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${ token }`,
        },
    } );

    if ( !response.ok ) {
        throw new Error( `Twitch ${ url } returned ${ response.status }` );
    }

    return response.json();
};

// Comparison key for matching a Steam title to a Twitch category: lowercase,
// strip everything that isn't a letter or digit. Mirrors gameFinder's own
// normalizeName so "R.E.P.O." and "REPO" collapse to the same key.
const matchKey = function matchKey ( value ) {
    return String( value || '' ).toLowerCase().replace( /[^a-z0-9]/g, '' );
};

// Roman numerals 1-20 as standalone words, for sequel-number matching.
const ROMAN_NUMERALS = {
    i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8',
    ix: '9', x: '10', xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15',
    xvi: '16', xvii: '17', xviii: '18', xix: '19', xx: '20',
};

// Looser key than matchKey: also folds Roman sequel numerals to Arabic so a
// Steam "Slay the Spire 2" matches a Twitch "Slay the Spire II". Tokenises on
// non-alphanumerics first (so the numeral words survive), converts known Roman
// tokens, then joins. Applied symmetrically to both names, so the worst case is
// a rare false match between two titles that differ only by numeral form.
const numeralKey = function numeralKey ( value ) {
    return String( value || '' )
        .toLowerCase()
        .split( /[^a-z0-9]+/ )
        .filter( Boolean )
        .map( ( token ) => {
            return ROMAN_NUMERALS[ token ] || token;
        } )
        .join( '' );
};

// Fuzzy fallback for one name: search Twitch's category catalogue and accept the
// first result whose numeral-folded key matches. Returns { id, name } or null.
const searchGameId = async function searchGameId ( name ) {
    try {
        const params = new URLSearchParams( {
            query: name,
            first: '10',
        } );

        const body = await helix( `${ SEARCH_URL }?${ params.toString() }` );
        const want = numeralKey( name );

        const hit = ( body.data || [] ).find( ( game ) => {
            return numeralKey( game.name ) === want;
        } );

        return hit ? { id: hit.id, name: hit.name } : null;
    } catch ( searchError ) {
        console.error( `[twitch] category search for ${ name } failed: ${ searchError.message }` );

        return null;
    }
};

// Resolve a list of game names to Twitch game ids. First pass: exact name
// lookups via /games, batched up to 100 names per call (Twitch matches the
// full category name case-insensitively). Second pass: any name that didn't get
// an exact hit falls back to a numeral-aware catalogue search, so Arabic/Roman
// sequel mismatches ("...2" vs "...II") still resolve. Returns a Map keyed by
// matchKey(inputName) -> { id, name } — the same key Game Finder looks up by;
// names Twitch doesn't know stay absent. Empty Map when unconfigured.
export const resolveGameIds = async function resolveGameIds ( names ) {
    const resolved = new Map();

    if ( !isConfigured() || names.length === 0 ) {
        return resolved;
    }

    const byExactName = new Map();

    for ( let offset = 0; offset < names.length; offset += GAMES_LOOKUP_CHUNK ) {
        const chunk = names.slice( offset, offset + GAMES_LOOKUP_CHUNK );
        const params = new URLSearchParams();

        chunk.forEach( ( name ) => {
            params.append( 'name', name );
        } );

        const body = await helix( `${ GAMES_URL }?${ params.toString() }` );

        ( body.data || [] ).forEach( ( game ) => {
            byExactName.set( matchKey( game.name ), {
                id: game.id,
                name: game.name,
            } );
        } );
    }

    for ( const name of names ) {
        const key = matchKey( name );

        if ( resolved.has( key ) ) {
            continue;
        }

        const exact = byExactName.get( key );

        if ( exact ) {
            resolved.set( key, exact );

            continue;
        }

        const fuzzy = await searchGameId( name );

        if ( fuzzy ) {
            resolved.set( key, fuzzy );
        }
    }

    return resolved;
};

// Current live viewers for one game id: the sum of viewer_count across a single
// page of its streams (sorted by viewers desc), which covers the full audience
// for any game small enough to be a tracking candidate. Returns null on failure
// so a missing reading shows as "—" rather than a misleading 0.
export const getGameViewers = async function getGameViewers ( gameId ) {
    if ( !isConfigured() ) {
        return null;
    }

    try {
        const body = await helix( `${ STREAMS_URL }?${ new URLSearchParams( {
            first: String( STREAMS_PER_GAME ),
            game_id: String( gameId ),
        } ).toString() }` );

        return ( body.data || [] ).reduce( ( sum, stream ) => {
            return sum + ( stream.viewer_count || 0 );
        }, 0 );
    } catch ( viewersError ) {
        console.error( `[twitch] viewers for game ${ gameId } failed: ${ viewersError.message }` );

        return null;
    }
};
