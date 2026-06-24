import * as cheerio from 'cheerio';

// Generic RSS author finder for the Game Sources editor's "Find developers on
// RSS" picker, the RSS counterpart to steam.js / reddit.js. grunt attributes an
// RSS post to the account whose identifier matches the item's <dc:creator>, so
// this surfaces those creator names — the people writing a dev blog — to be
// added as developers in one click, just like the Steam/Reddit finders. The
// browser can't read most feeds (CORS), so the fetch + parse happen here.
//
// <dc:creator> is grunt's attribution field, so it's read first; a plain RSS
// <author> or an Atom <author><name> is the fallback. Items with none are
// anonymous — only a catch-all '*' account collects them (e.g. Axie's "The
// Lunacian", a creatorless feed) — so they aren't discoverable individuals and
// yield nothing here.

// Read the first child element whose (lowercased) tag name is in `names`. cheerio
// in xmlMode exposes the namespaced <dc:creator> as the literal name 'dc:creator',
// which a CSS selector can't target portably, so match on the raw element name.
const childText = function childText ( $, $parent, names ) {
    let value = '';

    $parent.children().each( ( index, child ) => {
        if ( value ) {
            return;
        }

        if ( names.indexOf( ( child.name || '' ).toLowerCase() ) > -1 ) {
            value = $( child ).text().trim();
        }
    } );

    return value;
};

// Discover candidate developers in an RSS/Atom feed by collecting the distinct
// authors of its items. Returns [{ identifier, name, profile }] — identifier and
// name are the creator string (grunt matches the account identifier against
// <dc:creator>), profile is that author's most recent item link for a quick
// "is this really them" check. Deduped on the exact creator string, keeping the
// first (newest — feeds are reverse-chronological) item seen. A non-OK response
// throws so the route surfaces a broken/blocked feed rather than reporting "no
// authors"; a reachable feed with no creators returns [].
export const findRssDevelopers = async function findRssDevelopers ( endpoint ) {
    // Trim defensively: a stray trailing space (Project Zomboid's stored endpoint
    // has one) makes fetch build a malformed URL — the same guard grunt's reader
    // applies. Only http(s) feeds are fetchable; anything else yields nothing.
    const url = String( endpoint || '' ).trim();

    if ( !( /^https?:\/\//i ).test( url ) ) {
        return [];
    }

    const response = await fetch( url, {
        headers: {
            'user-agent': 'Mozilla/5.0',
        },
    } );

    if ( !response.ok ) {
        throw new Error( `RSS feed ${ url } returned ${ response.status }` );
    }

    const xml = await response.text();
    const $ = cheerio.load( xml, {
        xmlMode: true,
    } );

    // creator string -> that author's latest item link.
    const byCreator = new Map();

    $( 'item, entry' ).each( ( index, element ) => {
        const $item = $( element );

        let creator = childText( $, $item, [ 'dc:creator', 'creator' ] );

        if ( !creator ) {
            // Plain RSS <author> is text; Atom <author> wraps a <name> child.
            const $author = $item.children( 'author' ).first();

            if ( $author.length ) {
                creator = ( $author.children( 'name' ).first().text() || $author.text() ).trim();
            }
        }

        if ( !creator || byCreator.has( creator ) ) {
            return;
        }

        // RSS <link> is text; Atom <link> carries the URL in an href attribute.
        const $link = $item.children( 'link' ).first();

        byCreator.set( creator, $link.text().trim() || $link.attr( 'href' ) || '' );
    } );

    return [ ...byCreator.entries() ].map( ( [ creator, link ] ) => {
        return {
            identifier: creator,
            name: creator,
            profile: link,
        };
    } );
};
