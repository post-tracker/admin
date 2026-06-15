import fs from 'fs';
import path from 'path';

// Persistent "not interested" list for Game Finder. Stores canonical
// normalizeName keys (source-agnostic, e.g. 'overwatch') so an ignored game
// stays hidden no matter which source surfaces it. Backed by a JSON array on
// disk — mounted on a Docker volume in production so it survives restarts and
// is shared across browsers/devices.
const STORE_FILE = process.env.GAME_FINDER_IGNORE_FILE || path.join( import.meta.dirname, 'data', 'ignored.json' );

export const load = function load () {
    try {
        return new Set( JSON.parse( fs.readFileSync( STORE_FILE, 'utf8' ) ) );
    } catch ( readError ) {
        if ( readError.code !== 'ENOENT' ) {
            console.error( `[ignore] could not read ${ STORE_FILE }: ${ readError.message }` );
        }

        return new Set();
    }
};

const save = function save ( keys ) {
    fs.mkdirSync( path.dirname( STORE_FILE ), {
        recursive: true,
    } );

    fs.writeFileSync( STORE_FILE, JSON.stringify( [ ...keys ] ) );
};

// Add / remove a key and return the updated set. Callers pass an already
// normalized key (see normalizeName in gameFinder.js).
export const add = function add ( key ) {
    const keys = load();

    keys.add( key );
    save( keys );

    return keys;
};

export const remove = function remove ( key ) {
    const keys = load();

    keys.delete( key );
    save( keys );

    return keys;
};
