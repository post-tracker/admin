// Twitch box art lives at a predictable public CDN path:
//   https://static-cdn.jtvnw.net/ttv-boxart/{slug}-{size}.jpg
// where {slug} is the URL-encoded game name (e.g. "ARK%3A%20Survival%20Evolved")
// for most games, but a numeric Twitch game id (e.g. "32399") for some. We can't
// query Twitch from the browser without OAuth, so instead we build the URL
// heuristically from whatever the user types — a name or an id, both work since
// encodeURIComponent leaves digits untouched — and let an <img> load tell us
// whether the guess actually exists.

const CDN_PREFIX = 'https://static-cdn.jtvnw.net/ttv-boxart/';

// Every game currently on developertracker.com uses this size; match it so new
// art is consistent with the existing set.
export const BOXART_SIZE = '285x380';

// Build a box art URL from a name or numeric Twitch id. Returns '' for blank
// input so callers can treat "no query" as "no boxart".
export const buildBoxartUrl = function buildBoxartUrl ( query ) {
    const trimmed = ( query || '' ).trim();

    if ( !trimmed ) {
        return '';
    }

    return `${ CDN_PREFIX }${ encodeURIComponent( trimmed ) }-${ BOXART_SIZE }.jpg`;
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
