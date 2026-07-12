// Subreddit flair sampler for the Reddit flair editor. The browser can't read
// reddit.com directly (CORS), so the admin server samples recent posts and their
// comment threads here and reports every flair currently in use, with a count of
// the distinct users wearing it, so flair blocklists can be curated by point-and-
// click instead of editing finder/modules/flair/*.js by hand. Comment threads are
// crawled because devs/staff overwhelmingly comment with their flair rather than
// post — sampling post authors alone misses them (which the finder does catch).
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

// Devs/staff overwhelmingly show up *commenting* with their flair rather than
// submitting posts, so — like the finder — we walk each post's comment thread.
// Crawling every unique post across three listings would be hundreds of extra
// requests, so cap the number of threads fetched and fire them in small batches
// to stay clear of Reddit's rate limit.
const COMMENT_CRAWL_LIMIT = 60;
const COMMENT_FETCH_CONCURRENCY = 8;

const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;
const MS_PER_SECOND = 1000;

// Reddit asks for a unique, descriptive User-Agent; an empty/browser-y one is
// the quickest way to get 429'd. Honour an explicit override.
const USER_AGENT = process.env.REDDIT_USER_AGENT
    || 'developertracker-admin/1.0 (flair scan)';

const FLAIR_FIELDS = [ 'author_flair_css_class', 'author_flair_text' ];

const SAMPLE_USER_LIMIT = 5;

// The flair field a dev scan keys on when the caller doesn't specify one. Matches
// RedditFlairEditor's DEFAULT_TYPE so the finder and the flair editor agree.
const DEFAULT_FLAIR_TYPE = 'author_flair_css_class';

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

// GET a path under Reddit (OAuth when configured, public www otherwise) and
// return the parsed JSON. Throws on a non-OK response so callers can surface it.
const fetchJson = async function fetchJson ( path ) {
    const headers = {
        'User-Agent': USER_AGENT,
    };
    let host = PUBLIC_HOST;

    if ( isConfigured() ) {
        host = OAUTH_HOST;
        headers.Authorization = `Bearer ${ await getToken() }`;
    }

    const response = await fetch( `${ host }${ path }`, { headers: headers } );

    if ( !response.ok ) {
        throw new Error( `Reddit ${ path } returned ${ response.status }` );
    }

    return response.json();
};

const fetchListing = async function fetchListing ( subreddit, listing ) {
    const path = `/r/${ encodeURIComponent( subreddit ) }/${ listing }/.json?limit=${ POST_LIMIT }`;
    const body = await fetchJson( path );

    return ( body.data && body.data.children ) || [];
};

// Record both flair fields for one Reddit "thing" (post or comment) into the
// aggregation map, keyed by field+value and tracking the distinct users wearing
// each flair. Shared between post authors and commenters.
const recordFlairs = function recordFlairs ( data, seen ) {
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
};

// Walk a comment listing's children (and their nested replies) calling visit on
// each comment's data. Mirrors the finder's getUsersInPost recursion. 'more'
// stubs hold only comment IDs (no author/flair), so they're skipped like the
// finder.
const visitComments = function visitComments ( children, visit ) {
    if ( !Array.isArray( children ) ) {
        return;
    }

    children.forEach( ( child ) => {
        if ( !child || child.kind !== 't1' ) {
            return;
        }

        const data = child.data || {};

        visit( data );

        if ( data.replies && data.replies.data ) {
            visitComments( data.replies.data.children, visit );
        }
    } );
};

// Fetch one post's comment thread and return its top-level comment children.
// The comments endpoint responds with [ postListing, commentsListing ].
const fetchPostComments = async function fetchPostComments ( permalink ) {
    const body = await fetchJson( `${ permalink }.json?limit=${ POST_LIMIT }` );
    const commentsListing = Array.isArray( body ) ? body[ 1 ] : null;

    return ( commentsListing && commentsListing.data && commentsListing.data.children ) || [];
};

// Crawl a subreddit's hot/new/top listings and the comment threads of the
// sampled posts, calling visit(data) once per post author and once per commenter
// (data = the Reddit "thing" carrying `author` and the flair fields). Shared by
// sampleFlairs (aggregates by flair) and findRedditDevelopers (aggregates by
// username). A no-op for a blank subreddit; throws on an upstream listing failure.
const crawlSubreddit = async function crawlSubreddit ( subreddit, visit ) {
    const trimmed = String( subreddit || '' ).trim().replace( /^\/?r\//i, '' );

    if ( !trimmed ) {
        return;
    }

    const listings = await Promise.all( LISTINGS.map( ( listing ) => {
        return fetchListing( trimmed, listing );
    } ) );

    // Dedupe posts across the listings so a post appearing in both hot and new
    // is only crawled once.
    const permalinks = new Map();

    listings.flat().forEach( ( child ) => {
        const data = child.data || {};

        visit( data );

        if ( data.id && data.permalink && !permalinks.has( data.id ) ) {
            permalinks.set( data.id, data.permalink );
        }
    } );

    // Crawl comment threads so commenter flairs — where devs/staff actually show
    // up — are included, matching what the finder acts on. Capped and batched.
    const threads = [ ...permalinks.values() ].slice( 0, COMMENT_CRAWL_LIMIT );

    for ( let offset = 0; offset < threads.length; offset += COMMENT_FETCH_CONCURRENCY ) {
        const batch = threads.slice( offset, offset + COMMENT_FETCH_CONCURRENCY );

        await Promise.all( batch.map( async ( permalink ) => {
            try {
                visitComments( await fetchPostComments( permalink ), visit );
            } catch ( commentError ) {
                // A single unreadable thread shouldn't sink the whole scan.
                console.error( `[reddit] comment fetch failed for ${ permalink }: ${ commentError.message }` );
            }
        } ) );
    }
};

// Sample recent posts and their comment threads across a few listings and
// aggregate the flairs in use. Returns { flairs: [{ value, type, count,
// sampleUsers }] } where `type` is the flair field and `count` is distinct users
// seen wearing it. Throws on an upstream failure.
export const sampleFlairs = async function sampleFlairs ( subreddit ) {
    // Key each distinct flair by type+value; track the set of users wearing it.
    const seen = new Map();

    await crawlSubreddit( subreddit, ( data ) => {
        recordFlairs( data, seen );
    } );

    const flairs = [ ...seen.values() ].map( ( entry ) => {
        return {
            count: entry.users.size,
            sampleUsers: [ ...entry.users ].slice( 0, SAMPLE_USER_LIMIT ),
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

// Discover candidate developers in a subreddit by flair. Crawls the same posts
// and comment threads sampleFlairs does, but aggregates by username, keeping each
// user's flair of the requested `type` (defaulting to DEFAULT_FLAIR_TYPE).
//
// Two modes, mirroring the finder (finder/modules/finders/Reddit.js resolveFlair):
//   block (default) — a user is a candidate when they wear a non-empty flair of
//     that type whose lowercased value is NOT in `blocklist`.
//   allow — a user is a candidate ONLY if their flair's lowercased value IS in
//     `allowlist`. For subs where everyone wears a flair, whitelist the staff/dev
//     flair instead of blocklisting endless community flairs.
// Reddit account identifiers are the bare username, so `username` doubles as the
// identifier to add. Returns [{ username, flair, profile }] sorted by flair then
// username so same-flair candidates cluster. Throws on an upstream failure.
export const findRedditDevelopers = async function findRedditDevelopers ( subreddit, options ) {
    const settings = options || {};
    const type = settings.type || DEFAULT_FLAIR_TYPE;
    const mode = settings.mode === 'allow' ? 'allow' : 'block';
    const listKey = mode === 'allow' ? 'allowlist' : 'blocklist';
    const list = new Set( ( settings[ listKey ] || [] ).map( ( value ) => {
        return String( value ).trim().toLowerCase();
    } ).filter( Boolean ) );

    // username -> flair value of `type`. Only flaired users are recorded, so a
    // present key means "seen wearing a flair"; skip re-recording once set.
    const flairByUser = new Map();

    await crawlSubreddit( subreddit, ( data ) => {
        const username = data.author;

        if ( !username || username === '[deleted]' || flairByUser.has( username ) ) {
            return;
        }

        const flair = data[ type ] && String( data[ type ] ).trim();

        if ( flair ) {
            flairByUser.set( username, flair );
        }
    } );

    const developers = [ ...flairByUser.entries() ]
        .filter( ( [ , flair ] ) => {
            const isListed = list.has( flair.toLowerCase() );

            return mode === 'allow' ? isListed : !isListed;
        } )
        .map( ( [ username, flair ] ) => {
            return {
                flair: flair,
                profile: `${ PUBLIC_HOST }/user/${ encodeURIComponent( username ) }`,
                username: username,
            };
        } );

    developers.sort( ( first, second ) => {
        return first.flair.localeCompare( second.flair )
            || first.username.localeCompare( second.username );
    } );

    return developers;
};
