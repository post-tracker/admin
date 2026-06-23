import * as cheerio from 'cheerio';

// Steam discovery for Game Finder: the best-selling Early Access games are
// studios with real momentum and an active community worth tracking. Steam has
// no clean "early access success" API, so we use the storefront search filtered
// to the Early Access tag (493), ordered by top sellers — one request is the
// discovery primitive. A candidate's rank is its position in that list; the
// developer/release-date label is fetched separately via appdetails, but only
// for the games that actually make the final list (see gameFinder.js).
//
// The Early Access *tag* (tags=493) is used rather than the category2=70 genre
// filter: the json/infinite search endpoint silently ignores category2 and
// returns general top sellers, while the tag filter correctly restricts to
// Early Access titles. The search returns rows as an HTML blob (results_html),
// not a structured list, so app id + title are parsed out with a regex.

const SEARCH_URL = 'https://store.steampowered.com/search/results/';
const APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const CURRENT_PLAYERS_URL = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';

export const APP_URL = 'https://store.steampowered.com/app';

const SEARCH_COUNT = 100;

const HTML_ENTITIES = {
    '&#39;': '\'',
    '&amp;': '&',
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
};

const decodeEntities = function decodeEntities ( value ) {
    return value.replace( /&(?:#39|amp|gt|lt|quot);/g, ( match ) => {
        return HTML_ENTITIES[ match ] || match;
    } );
};

// Extract { id, name } pairs from the search endpoint's results_html. Each row
// carries data-ds-appid and a <span class="title"> with the game name.
const parseRows = function parseRows ( html ) {
    const rowPattern = /data-ds-appid="(\d+)"[\s\S]*?<span class="title">([^<]+)<\/span>/g;
    const rows = [];
    let match = rowPattern.exec( html );

    while ( match ) {
        rows.push( {
            id: match[ 1 ],
            name: decodeEntities( match[ 2 ].trim() ),
        } );

        match = rowPattern.exec( html );
    }

    return rows;
};

// Early Access top sellers, in chart order (index 0 = best seller). Returns
// [{ id, name }]; returns [] on any upstream failure so the scan still yields
// Twitch results. Enrichment (developer/date) is deferred to enrich() below.
export const search = async function search () {
    try {
        const params = new URLSearchParams( {
            tags: '493',
            filter: 'topsellers',
            json: '1',
            count: String( SEARCH_COUNT ),
            infinite: '1',
        } );

        const response = await fetch( `${ SEARCH_URL }?${ params.toString() }` );

        if ( !response.ok ) {
            throw new Error( `search returned ${ response.status }` );
        }

        const body = await response.json();

        return parseRows( body.results_html || '' );
    } catch ( searchError ) {
        console.error( `[steam] search failed: ${ searchError.message }` );

        return [];
    }
};

// Developer + release date for one app via the public appdetails endpoint.
// Returns { developer, released, releasedAt }: `released` is Steam's display
// string ("6 Dec, 2024"), `releasedAt` its parsed epoch-ms for sorting (null
// when the string is a placeholder like "Coming soon"). Any field may be null,
// and on failure all are — enrichment is a nice-to-have, never a gate.
export const enrich = async function enrich ( appId ) {
    const result = {
        developer: null,
        released: null,
        releasedAt: null,
    };

    try {
        const params = new URLSearchParams( {
            appids: appId,
            filters: 'basic,developers,release_date',
        } );

        const response = await fetch( `${ APPDETAILS_URL }?${ params.toString() }` );

        if ( response.ok ) {
            const body = await response.json();
            const data = body[ appId ] && body[ appId ].success && body[ appId ].data;

            if ( data ) {
                result.developer = ( data.developers || [] )[ 0 ] || null;
                result.released = ( data.release_date && data.release_date.date ) || null;

                const parsed = result.released ? Date.parse( result.released ) : NaN;

                result.releasedAt = Number.isNaN( parsed ) ? null : parsed;
            }
        }
    } catch ( detailError ) {
        console.error( `[steam] appdetails ${ appId } failed: ${ detailError.message }` );
    }

    return result;
};

// Extract the community id from whatever the admin pastes: a full community URL
// (steamcommunity.com/games/<id> or /app/<id>), a store URL
// (store.steampowered.com/app/<n>), or a bare slug/number. The community id is
// what /games/<id>/rss/ (the announcements feed) is keyed on — the vanity slug
// for games with a custom community URL, otherwise the numeric app id.
const parseCommunityId = function parseCommunityId ( input ) {
    const raw = String( input || '' ).trim();

    if ( !raw ) {
        return false;
    }

    const urlMatch = raw.match( /(?:steamcommunity\.com\/(?:games|app)|store\.steampowered\.com\/app)\/([A-Za-z0-9_]+)/i );

    if ( urlMatch ) {
        return urlMatch[ 1 ];
    }

    // A bare token (slug or number) — reject anything with path/space noise.
    if ( /^[A-Za-z0-9_]+$/.test( raw ) ) {
        return raw;
    }

    return false;
};

// Resolve a Steam source's two ids from one input. The forum scrape needs the
// numeric app id but a custom-URL game's announcements feed only works under its
// vanity slug, and app-id -> vanity isn't reliably resolvable — but the reverse
// is: the community hub page (vanity OR numeric) always links its store app page,
// so we read the numeric app id from there. Also counts announcement-feed items
// so the caller can confirm the feed id actually works. Never throws; unresolved
// fields come back null, matching the other helpers in this file.
export const resolveSteam = async function resolveSteam ( input ) {
    const communityId = parseCommunityId( input );

    if ( !communityId ) {
        return {
            announcements: null,
            appId: null,
            communityId: null,
        };
    }

    const result = {
        announcements: null,
        appId: null,
        communityId,
    };

    try {
        const response = await fetch( `https://steamcommunity.com/games/${ communityId }`, {
            headers: {
                'user-agent': 'Mozilla/5.0',
            },
        } );

        if ( response.ok ) {
            const body = await response.text();
            const appMatch = body.match( /store\.steampowered\.com\/app\/(\d+)/ );

            if ( appMatch ) {
                result.appId = appMatch[ 1 ];
            }
        }
    } catch ( resolveError ) {
        console.error( `[steam] resolve ${ communityId } failed: ${ resolveError.message }` );
    }

    try {
        const feedResponse = await fetch( `https://steamcommunity.com/games/${ communityId }/rss/`, {
            headers: {
                'user-agent': 'Mozilla/5.0',
            },
        } );

        if ( feedResponse.ok ) {
            const feedBody = await feedResponse.text();

            result.announcements = ( feedBody.match( /<item>/g ) || [] ).length;
        }
    } catch ( feedError ) {
        console.error( `[steam] feed check ${ communityId } failed: ${ feedError.message }` );
    }

    // A purely numeric input is itself a valid app id for the discussions scrape,
    // even when the community page didn't yield one (e.g. a custom-URL game's
    // numeric hub is empty). The zero announcement count then signals the caller
    // to use the game's vanity community URL for the feed instead.
    if ( !result.appId && /^\d+$/.test( communityId ) ) {
        result.appId = communityId;
    }

    return result;
};

const SEARCH_RESULT_LIMIT = 8;

// Search Steam's catalogue by game name for the Game Sources editor's Steam
// picker, so the admin types a name instead of hunting down a numeric app id.
// Uses the community SearchApps AJAX endpoint, which returns clean JSON
// ([{ appid, name, icon }]) — the appid is exactly the numeric forum id and the
// default announcements feed id. Returns [] on any failure, like search() above,
// so the picker degrades to the manual id fields rather than erroring.
export const searchSteamGames = async function searchSteamGames ( term ) {
    const query = String( term || '' ).trim();

    if ( !query ) {
        return [];
    }

    try {
        const response = await fetch(
            `https://steamcommunity.com/actions/SearchApps/${ encodeURIComponent( query ) }`,
            {
                headers: {
                    'user-agent': 'Mozilla/5.0',
                },
            },
        );

        if ( !response.ok ) {
            throw new Error( `SearchApps returned ${ response.status }` );
        }

        const body = await response.json();

        if ( !Array.isArray( body ) ) {
            return [];
        }

        return body.slice( 0, SEARCH_RESULT_LIMIT ).map( ( row ) => {
            return {
                appId: String( row.appid ),
                name: row.name,
                icon: row.icon || null,
            };
        } );
    } catch ( searchError ) {
        console.error( `[steam] game search "${ query }" failed: ${ searchError.message }` );

        return [];
    }
};

// SteamID64 = this base + the 32-bit account id exposed as `data-miniprofile`.
// (Same conversion the indexer's SteamDiscussions uses.)
const STEAM_ID64_BASE = 76561197960265728n;

// Page-1 discussions lists return ~15 threads; cap the per-thread crawl so a busy
// forum doesn't fan out unbounded, and run a few in parallel so the lookup is snappy.
const DEV_THREAD_LIMIT = 15;
const DEV_FETCH_CONCURRENCY = 5;

const miniProfileToSteamId64 = function miniProfileToSteamId64 ( miniProfile ) {
    try {
        return ( STEAM_ID64_BASE + BigInt( miniProfile ) ).toString();
    } catch {
        return false;
    }
};

const fetchSteamHtml = function fetchSteamHtml ( url ) {
    return fetch( url, {
        headers: {
            'user-agent': 'Mozilla/5.0',
        },
    } )
        .then( ( response ) => {
            if ( !response.ok ) {
                throw new Error( `${ url } returned ${ response.status }` );
            }

            return response.text();
        } )
        .catch( ( fetchError ) => {
            console.error( `[steam] fetch ${ url } failed: ${ fetchError.message }` );

            return false;
        } );
};

// Pull the developer-badged OP + replies out of one thread page, appending
// { steamId64, name } to `found`. Mirrors the indexer's SteamDiscussions.parseThread
// selectors (Steam's own `commentthread_author_developer` badge + `data-miniprofile`).
const parseThreadDevs = function parseThreadDevs ( threadHtml, found ) {
    const $ = cheerio.load( threadHtml );

    const push = ( miniProfile, author ) => {
        const steamId64 = miniProfileToSteamId64( miniProfile );

        if ( !steamId64 ) {
            return;
        }

        found.push( {
            name: ( author || '' ).replace( /\s+/g, ' ' ).trim(),
            steamId64: steamId64,
        } );
    };

    const $op = $( '.forum_op' ).first();

    if ( $op.length && $op.find( '.forum_op_author' ).hasClass( 'commentthread_author_developer' ) ) {
        push(
            $op.find( '[data-miniprofile]' ).first().attr( 'data-miniprofile' ),
            $op.find( '.forum_op_author' ).text()
        );
    }

    $( '.commentthread_comment' ).each( ( index, element ) => {
        const $comment = $( element );

        if ( !$comment.find( '.commentthread_author_link' ).hasClass( 'commentthread_author_developer' ) ) {
            return;
        }

        push(
            $comment.find( '[data-miniprofile]' ).first().attr( 'data-miniprofile' ),
            $comment.find( '.commentthread_author_link' ).text()
        );
    } );
};

// Discover a game's developers for the admin's "find developers on Steam" picker
// by reading Steam's own Developer badge in the discussions forum — the same
// signal the indexer uses to nudge for untracked devs (SteamDiscussions). Crawls
// page 1 of /app/<appId>/discussions/ and the threads it links, collecting badged
// authors as { steamId64, name, profile }. Deduped by steamId64. Never throws;
// returns [] on failure, matching the other helpers here. A studio that only posts
// announcements (not the forum) won't surface — those carry no SteamID.
export const findSteamDevelopers = async function findSteamDevelopers ( appId ) {
    const id = String( appId || '' ).trim();

    if ( !/^\d+$/.test( id ) ) {
        return [];
    }

    const listHtml = await fetchSteamHtml( `https://steamcommunity.com/app/${ id }/discussions/` );

    if ( !listHtml ) {
        return [];
    }

    const $ = cheerio.load( listHtml );
    const threadUrls = [];
    const seen = new Set();

    $( '.forum_topic' ).each( ( index, element ) => {
        const url = $( element ).find( 'a.forum_topic_overlay' ).attr( 'href' );

        if ( url && !seen.has( url ) ) {
            seen.add( url );
            threadUrls.push( url );
        }
    } );

    if ( threadUrls.length > DEV_THREAD_LIMIT ) {
        console.error( `[steam] dev finder ${ id }: capping ${ threadUrls.length } threads to ${ DEV_THREAD_LIMIT }` );
    }

    const queue = threadUrls.slice( 0, DEV_THREAD_LIMIT );
    const found = [];

    const worker = async () => {
        while ( queue.length ) {
            const url = queue.shift();
            const threadHtml = await fetchSteamHtml( url );

            if ( threadHtml ) {
                try {
                    parseThreadDevs( threadHtml, found );
                } catch ( parseError ) {
                    console.error( `[steam] dev finder parse ${ url } failed: ${ parseError.message }` );
                }
            }
        }
    };

    await Promise.all(
        Array.from( { length: DEV_FETCH_CONCURRENCY }, () => {
            return worker();
        } )
    );

    // Dedupe by SteamID64, keeping the first non-empty display name seen.
    const byId = new Map();

    for ( const dev of found ) {
        const existing = byId.get( dev.steamId64 );

        if ( !existing ) {
            byId.set( dev.steamId64, dev );
        } else if ( !existing.name && dev.name ) {
            existing.name = dev.name;
        }
    }

    return [ ...byId.values() ].map( ( dev ) => {
        return {
            name: dev.name,
            profile: `https://steamcommunity.com/profiles/${ dev.steamId64 }`,
            steamId64: dev.steamId64,
        };
    } );
};

// Current concurrent players for an app via Steam's public stats endpoint — the
// same "players right now" figure SteamCharts is built on, straight from the
// source, no API key required. Returns null on any failure so player stats stay
// a nice-to-have, never a gate.
export const currentPlayers = async function currentPlayers ( appId ) {
    try {
        const params = new URLSearchParams( {
            appid: String( appId ),
        } );

        const response = await fetch( `${ CURRENT_PLAYERS_URL }?${ params.toString() }` );

        if ( !response.ok ) {
            return null;
        }

        const body = await response.json();
        const playerCount = body.response && body.response.player_count;

        if ( typeof playerCount === 'number' ) {
            return playerCount;
        }

        return null;
    } catch ( playersError ) {
        console.error( `[steam] current players ${ appId } failed: ${ playersError.message }` );

        return null;
    }
};
