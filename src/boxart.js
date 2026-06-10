// Twitch box art lives at a predictable public CDN path:
//   https://static-cdn.jtvnw.net/ttv-boxart/{slug}-{size}.jpg
// where {slug} is the URL-encoded game name (e.g. "ARK%3A%20Survival%20Evolved")
// for some games, a bare numeric Twitch game id (e.g. "32399") for older
// entries, and a Twitch game id suffixed with "_IGDB" (e.g. "1872074204_IGDB")
// for newer ones — the "_IGDB" just marks that the art was sourced from IGDB;
// the number is still Twitch's own game id, not an IGDB id. These helpers build
// the URL heuristically from whatever the user types and let an <img> load tell
// us whether the guess exists; the picker's Twitch search (twitch.js) is the
// reliable path, this is the manual fallback.

const CDN_PREFIX = 'https://static-cdn.jtvnw.net/ttv-boxart/';

// Every game currently on developertracker.com uses this size; match it so new
// art is consistent with the existing set.
export const BOXART_SIZE = '285x380';

const slugToUrl = function slugToUrl ( slug ) {
    // encodeURIComponent leaves digits and "_" untouched, so ids pass through
    // verbatim while names get their spaces/colons escaped.
    return `${ CDN_PREFIX }${ encodeURIComponent( slug ) }-${ BOXART_SIZE }.jpg`;
};

// Build the ordered list of box art URLs to try for a name or id, most likely
// first. For a bare numeric query we can't tell whether the CDN keys it under
// the newer "_IGDB" form or the older bare id, so we emit both — "_IGDB" first,
// since that's what current ids in our catalogue use — and let the caller's
// <img> probe pick whichever resolves. Returns [] for blank input so callers can
// treat "no query" as "no boxart".
export const buildBoxartUrls = function buildBoxartUrls ( query ) {
    const trimmed = ( query || '' ).trim();

    if ( !trimmed ) {
        return [];
    }

    // Pure digits → try the "_IGDB" form first, then the bare id. An already
    // "_IGDB"-suffixed query isn't pure digits, so it round-trips as-is.
    if ( /^\d+$/.test( trimmed ) ) {
        return [ slugToUrl( `${ trimmed }_IGDB` ), slugToUrl( trimmed ) ];
    }

    return [ slugToUrl( trimmed ) ];
};

// Reverse a box art URL back to the name/id that produced it, so an existing
// value can prefill the lookup field. Returns '' when the URL isn't a
// recognisable ttv-boxart URL (e.g. a hand-entered custom image), leaving the
// raw URL field as the source of truth instead.
export const extractBoxartQuery = function extractBoxartQuery ( url ) {
    if ( !url || url.indexOf( CDN_PREFIX ) !== 0 ) {
        return '';
    }

    const slug = url.slice( CDN_PREFIX.length ).replace( /-\d+x\d+\.(?:jpg|png)$/i, '' );

    try {
        return decodeURIComponent( slug );
    } catch {
        // Malformed percent-encoding — fall back to the raw slug.
        return slug;
    }
};
