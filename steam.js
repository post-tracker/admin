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
