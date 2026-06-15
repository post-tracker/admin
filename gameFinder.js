// Game Finder discovery orchestrator. Steam's Early Access top sellers are the
// spine of the list — studios with real momentum worth tracking. Twitch's top
// games are folded in as a bonus signal: live viewers lift a game's score but
// aren't required, so a strong EA seller nobody streams still surfaces. (Pure
// Twitch games that aren't EA top sellers are dropped — that's the noise the EA
// filter exists to cut.) Survivors are enriched with developer/date + the current
// concurrent-player count, scored as Steam rank + Twitch viewers + players, with
// already-tracked games dropped and admin-ignored ones hidden. Server-side only:
// Twitch needs the client secret and Steam sends no CORS headers, so neither can
// be called from the browser.

import { resolveGameIds, getGameViewers } from './twitch.js';
import { search as searchSteam, enrich as enrichSteam, currentPlayers, APP_URL as STEAM_APP_URL } from './steam.js';
import * as ignoreStore from './ignoreStore.js';

const API_BASE = 'https://api.developertracker.com';

// Pool is built larger than the visible result count so ignoring games simply
// promotes the next-ranked ones (backfill) instead of shrinking the list.
const POOL_SIZE = 60;
const RESULT_LIMIT = 30;

// Politeness gap between the per-app Steam enrichment calls.
const ENRICH_DELAY_MS = 120;

// Cache a scan for this long so reopening the page, ignoring a game, or a stray
// refresh is instant; the Rescan button forces a fresh scan.
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = null;

const sleep = function sleep ( ms ) {
    return new Promise( ( resolve ) => {
        setTimeout( resolve, ms );
    } );
};

// Collapse a game title to a comparison key: lowercase, drop everything that
// isn't a letter or digit. Used for dedup, cross-source merge identity, and the
// ignore list. Matching is deliberately loose — the page only suggests
// candidates to a human, so over-suggesting is cheap while a false match that
// hides a genuinely new game is the expensive failure.
const normalizeName = function normalizeName ( value ) {
    return String( value || '' ).toLowerCase().replace( /[^a-z0-9]/g, '' );
};

const normalizeService = function normalizeService ( service ) {
    return String( service ).toLowerCase().replace( /[\s.]/g, '-' );
};

const sectionsOf = function sectionsOf ( source ) {
    const sections = source.findSections || source.allowedSections || [];

    return Array.isArray( sections ) ? sections : [ sections ];
};

// Fetch every tracked game and reduce it to two lookup sets: normalized
// names, and the Steam app ids / Twitch category ids from each game's
// config.sources.
const loadTracked = async function loadTracked () {
    const response = await fetch( `${ API_BASE }/games`, {
        headers: {
            Authorization: `Bearer ${ process.env.API_TOKEN }`,
        },
    } );

    if ( !response.ok ) {
        throw new Error( `${ API_BASE }/games returned ${ response.status }` );
    }

    const games = ( await response.json() ).data || [];

    const names = new Set();
    const ids = new Set();

    for ( const game of games ) {
        names.add( normalizeName( game.name ) );
        names.add( normalizeName( game.shortName ) );
        names.add( normalizeName( game.identifier ) );

        const sources = game.config && game.config.sources;

        if ( !sources ) {
            continue;
        }

        for ( const service in sources ) {
            if ( !Reflect.apply( {}.hasOwnProperty, sources, [ service ] ) ) {
                continue;
            }

            const key = normalizeService( service );

            if ( key !== 'steam' && key !== 'steam-feed' && key !== 'twitch' ) {
                continue;
            }

            for ( const section of sectionsOf( sources[ service ] ) ) {
                ids.add( String( section ) );
            }

            if ( sources[ service ].name ) {
                ids.add( String( sources[ service ].name ) );
            }
        }
    }

    names.delete( '' );

    return {
        ids,
        names,
    };
};

const makeIsTracked = function makeIsTracked ( tracked ) {
    return function isTracked ( id, name ) {
        if ( id && tracked.ids.has( String( id ) ) ) {
            return true;
        }

        return tracked.names.has( normalizeName( name ) );
    };
};

// Twitch directory slugs are the lowercased name with spaces as hyphens.
const directoryUrl = function directoryUrl ( name ) {
    const slug = encodeURIComponent( String( name ).toLowerCase().replace( /\s+/g, '-' ) );

    return `https://www.twitch.tv/directory/category/${ slug }`;
};

// Per-source 0-100 sub-scores. Twitch viewers are log-scaled so a mid-tier
// 15k-viewer game isn't crushed by a 100k megagame while magnitude still
// counts; Steam uses its top-seller chart position directly.
const twitchScore = function twitchScore ( viewers, maxViewers ) {
    if ( maxViewers <= 0 ) {
        return 0;
    }

    return 100 * ( Math.log( viewers + 1 ) / Math.log( maxViewers + 1 ) );
};

const steamScore = function steamScore ( index, count ) {
    return 100 * ( ( count - index ) / count );
};

// Concurrent players, log-scaled across the surviving candidates for the same
// reason as Twitch viewers: a healthy 5k-player game shouldn't read as zero next
// to a 200k juggernaut. A candidate with no player reading contributes 0.
const playerScore = function playerScore ( players, maxPlayers ) {
    if ( maxPlayers <= 0 || players <= 0 ) {
        return 0;
    }

    return 100 * ( Math.log( players + 1 ) / Math.log( maxPlayers + 1 ) );
};

// Build the scored pool. Steam's Early Access top sellers are the candidate set
// (ranked by chart position); already-tracked games are dropped and the top
// POOL_SIZE survive. Each is then enriched with developer/date, current players,
// and — looked up per game, not from Twitch's global stream firehose — its live
// Twitch viewers. Viewers + players fold into the score so a game with traction
// on multiple fronts rises, but neither is required.
const scan = async function scan () {
    const tracked = await loadTracked();
    const isTracked = makeIsTracked( tracked );

    const steamRows = await searchSteam();
    const steamCount = steamRows.length;

    const seen = new Set();
    const pool = [];

    steamRows.forEach( ( row, index ) => {
        const key = normalizeName( row.name );

        if ( seen.has( key ) || isTracked( row.id, row.name ) ) {
            return;
        }

        seen.add( key );

        pool.push( {
            appId: row.id,
            developer: null,
            key: key,
            name: row.name,
            players: null,
            released: null,
            releasedAt: null,
            score: steamScore( index, steamCount ),
            steamUrl: `${ STEAM_APP_URL }/${ row.id }`,
            twitchUrl: null,
            viewers: null,
        } );
    } );

    pool.splice( POOL_SIZE );

    // One batched lookup turns the pool's names into Twitch game ids; games
    // Twitch doesn't know stay absent (viewers: null -> "—").
    const twitchIds = await resolveGameIds( pool.map( ( candidate ) => {
        return candidate.name;
    } ) );

    // Enrich only the pool: developer/date + current players + live Twitch
    // viewers. The three calls hit different hosts, so run them together and
    // pace between candidates to stay polite to Steam's storefront.
    for ( const candidate of pool ) {
        const twitchGame = twitchIds.get( candidate.key );

        const [ details, players, viewers ] = await Promise.all( [
            enrichSteam( candidate.appId ),
            currentPlayers( candidate.appId ),
            twitchGame ? getGameViewers( twitchGame.id ) : Promise.resolve( null ),
        ] );

        candidate.developer = details.developer;
        candidate.released = details.released;
        candidate.releasedAt = details.releasedAt;
        candidate.players = players;
        candidate.viewers = viewers;

        // A resolved game (even with zero current viewers) links to its Twitch
        // directory category from the viewers column.
        if ( twitchGame && typeof viewers === 'number' ) {
            candidate.twitchUrl = directoryUrl( twitchGame.name );
        }

        await sleep( ENRICH_DELAY_MS );
    }

    // Fold the (log-scaled) viewer + player counts into the score now that the
    // pool has both readings, then re-rank.
    const maxViewers = pool.reduce( ( max, candidate ) => {
        return Math.max( max, candidate.viewers || 0 );
    }, 0 );
    const maxPlayers = pool.reduce( ( max, candidate ) => {
        return Math.max( max, candidate.players || 0 );
    }, 0 );

    for ( const candidate of pool ) {
        candidate.score = candidate.score
            + twitchScore( candidate.viewers || 0, maxViewers )
            + playerScore( candidate.players || 0, maxPlayers );
    }

    return pool.sort( ( first, second ) => {
        return second.score - first.score;
    } );
};

// Public entry point. Serves the scored pool from cache (unless `force` or
// expiry), then applies the current ignore list and slices the visible result
// count, so ignoring a game promotes the next one in.
export const discover = async function discover ( options ) {
    const force = Boolean( options && options.force );
    const now = Date.now();

    if ( force || !cache || cache.expiresAt <= now ) {
        const pool = await scan();

        cache = {
            expiresAt: now + CACHE_TTL_MS,
            pool: pool,
            scannedAt: new Date( now ).toISOString(),
        };
    }

    const ignoredNames = [ ...ignoreStore.load() ];
    const ignoredKeys = new Set( ignoredNames.map( normalizeName ) );

    const candidates = cache.pool
        .filter( ( candidate ) => {
            return !ignoredKeys.has( candidate.key );
        } )
        .slice( 0, RESULT_LIMIT );

    return {
        candidates: candidates,
        ignored: ignoredNames.sort(),
        scannedAt: cache.scannedAt,
    };
};

// Add / remove a display name from the persistent ignore list. Returns the
// updated, sorted list of ignored names.
export const addIgnore = function addIgnore ( name ) {
    return [ ...ignoreStore.add( String( name ).trim() ) ].sort();
};

export const removeIgnore = function removeIgnore ( name ) {
    return [ ...ignoreStore.remove( String( name ).trim() ) ].sort();
};
