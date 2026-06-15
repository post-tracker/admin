// Subreddit flair sampler for the Reddit flair editor. The browser can't read
// reddit.com directly (CORS), so the admin server samples recent posts here and
// reports every author flair currently in use, with a count and a dev/community
// suggestion, so flair blocklists can be curated by point-and-click instead of
// editing finder/modules/flair/*.js by hand.
//
// Transport: Reddit blocks unauthenticated .json requests from datacenter IPs
// (403), so when REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET are set (the same app the
// finder uses) we read through OAuth at oauth.reddit.com — the reliable path.
// With no credentials we fall back to the public www.reddit.com .json endpoints,
// which work from residential IPs but commonly 403 from servers. Either way a
// failure is thrown so the route can surface it rather than crashing.

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const OAUTH_HOST = 'https://oauth.reddit.com';
const PUBLIC_HOST = 'https://www.reddit.com';

const LISTINGS = [ 'hot', 'new', 'top' ];
const POST_LIMIT = 100;

const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;
const MS_PER_SECOND = 1000;

// Reddit asks for a unique, descriptive User-Agent; an empty/browser-y one is
// the quickest way to get 429'd. Honour an explicit override.
const USER_AGENT = process.env.REDDIT_USER_AGENT
    || 'developertracker-admin/1.0 (flair scan)';

// A flair held by at most this many distinct users in the sample is treated as a
// dev candidate — community flairs (regulars, weapon classes, subreddit veterans)
// are worn by many people, dev/staff flairs by a handful.
const RARE_USER_THRESHOLD = 2;

// Substrings that mark a flair as a likely developer/staff flair regardless of
// how many people hold it.
const DEV_KEYWORDS = [
    'dev', 'developer', 'staff', 'team', 'official', 'community manager',
    'cm', 'founder', 'designer', 'programmer', 'artist', 'qa', 'studio',
];

const FLAIR_FIELDS = [ 'author_flair_css_class', 'author_flair_text' ];

const SAMPLE_USER_LIMIT = 5;

const resolveConfig = function resolveConfig () {
    return {
        clientId: process.env.REDDIT_CLIENT_ID || '',
        clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
    };
};

const isConfigured = function isConfigured () {
    const { clientId, clientSecret } = resolveConfig();

    return Boolean( clientId && clientSecret );
};

// Cached app-only access token: { value, expiresAt }. Reused across requests
// until it nears expiry, like twitch.js caches its token.
let tokenCache = null;

const getToken = async function getToken () {
    const now = Date.now();

    if ( tokenCache && tokenCache.expiresAt > now ) {
        return tokenCache.value;
    }

    const { clientId, clientSecret } = resolveConfig();
    const encoded = Buffer.from( `${ clientId }:${ clientSecret }` ).toString( 'base64' );

    const response = await fetch( TOKEN_URL, {
        body: new URLSearchParams( {
            grant_type: 'client_credentials',
        } ),
        headers: {
            Authorization: `Basic ${ encoded }`,
            'User-Agent': USER_AGENT,
        },
        method: 'POST',
    } );

    if ( !response.ok ) {
        throw new Error( `Reddit token request returned ${ response.status }` );
    }

    const body = await response.json();

    tokenCache = {
        expiresAt: now + ( body.expires_in * MS_PER_SECOND ) - TOKEN_EXPIRY_MARGIN_MS,
        value: body.access_token,
    };

    return tokenCache.value;
};

const looksLikeDev = function looksLikeDev ( value, userCount ) {
    if ( userCount <= RARE_USER_THRESHOLD ) {
        return true;
    }

    const lower = String( value ).toLowerCase();

    return DEV_KEYWORDS.some( ( keyword ) => {
        return lower.includes( keyword );
    } );
};

const fetchListing = async function fetchListing ( subreddit, listing ) {
    const headers = {
        'User-Agent': USER_AGENT,
    };
    let host = PUBLIC_HOST;

    if ( isConfigured() ) {
        host = OAUTH_HOST;
        headers.Authorization = `Bearer ${ await getToken() }`;
    }

    const url = `${ host }/r/${ encodeURIComponent( subreddit ) }/${ listing }/.json?limit=${ POST_LIMIT }`;
    const response = await fetch( url, { headers: headers } );

    if ( !response.ok ) {
        throw new Error( `Reddit r/${ subreddit } ${ listing } returned ${ response.status }` );
    }

    const body = await response.json();

    return ( body.data && body.data.children ) || [];
};

// Sample recent posts across a few listings and aggregate the author flairs in
// use. Returns { flairs: [{ value, type, count, sampleUsers, suggestion }] }
// where `type` is the flair field, `count` is distinct users seen wearing it,
// and `suggestion` is 'dev' or 'community' (a hint only). Throws on an upstream
// failure.
export const sampleFlairs = async function sampleFlairs ( subreddit ) {
    const trimmed = String( subreddit || '' ).trim().replace( /^\/?r\//i, '' );

    if ( !trimmed ) {
        return { flairs: [] };
    }

    const listings = await Promise.all( LISTINGS.map( ( listing ) => {
        return fetchListing( trimmed, listing );
    } ) );

    // Key each distinct flair by type+value; track the set of users wearing it.
    const seen = new Map();

    listings.flat().forEach( ( child ) => {
        const data = child.data || {};
        const username = data.author;

        if ( !username || username === '[deleted]' ) {
            return;
        }

        FLAIR_FIELDS.forEach( ( field ) => {
            const value = data[ field ] && String( data[ field ] ).trim();

            if ( !value ) {
                return;
            }

            const key = `${ field } ${ value }`;

            if ( !seen.has( key ) ) {
                seen.set( key, {
                    field: field,
                    users: new Set(),
                    value: value,
                } );
            }

            seen.get( key ).users.add( username );
        } );
    } );

    const flairs = [ ...seen.values() ].map( ( entry ) => {
        const count = entry.users.size;

        return {
            count: count,
            sampleUsers: [ ...entry.users ].slice( 0, SAMPLE_USER_LIMIT ),
            suggestion: looksLikeDev( entry.value, count ) ? 'dev' : 'community',
            type: entry.field,
            value: entry.value,
        };
    } );

    // Most-worn first, so the obvious community flairs surface at the top.
    flairs.sort( ( first, second ) => {
        return second.count - first.count;
    } );

    return { flairs: flairs };
};
