import Queue from 'bull';

// Reads Bull queue job counts from Redis for the dashboard. The browser can't
// reach Redis, so admin/server.js (and the Vite dev middleware) expose this over
// HTTP at /api/queues. Connection details come from the same REDIS_URL the
// queue workers use; with no REDIS_URL (e.g. local dev) it returns [] so the
// dashboard renders an empty queue state instead of erroring.

// How long to wait on a single queue before reporting it as unreachable, so a
// down Redis can't hang the HTTP request.
const QUEUE_TIMEOUT_MS = 3000;

// Cache the Bull queue instances (each holds a Redis connection) keyed by the
// resolved config, rebuilt only if REDIS_URL / QUEUE_NAMES change.
let queueCache = null;

const resolveConfig = function resolveConfig () {
    return {
        names: ( process.env.QUEUE_NAMES || 'posts,users' )
            .split( ',' )
            .map( ( name ) => {
                return name.trim();
            } )
            .filter( Boolean ),
        url: process.env.REDIS_URL || '',
    };
};

const getQueues = function getQueues () {
    const { names, url } = resolveConfig();

    if ( !url ) {
        return [];
    }

    const cacheKey = `${ url }|${ names.join( ',' ) }`;

    if ( queueCache && queueCache.key === cacheKey ) {
        return queueCache.queues;
    }

    const queues = names.map( ( name ) => {
        const queue = new Queue( name, url );

        // Surface connection problems per-request (below) rather than as
        // unhandled error events / log spam.
        queue.on( 'error', () => {} );

        return {
            name: name,
            queue: queue,
        };
    } );

    queueCache = {
        key: cacheKey,
        queues: queues,
    };

    return queues;
};

const withTimeout = function withTimeout ( promise, milliseconds ) {
    return Promise.race( [
        promise,
        new Promise( ( resolve ) => {
            setTimeout( () => {
                resolve( null );
            }, milliseconds );
        } ),
    ] );
};

export const getQueueCounts = async function getQueueCounts () {
    const queues = getQueues();

    if ( queues.length === 0 ) {
        return [];
    }

    return Promise.all( queues.map( async ( { name, queue } ) => {
        try {
            const counts = await withTimeout( queue.getJobCounts(), QUEUE_TIMEOUT_MS );

            if ( !counts ) {
                return {
                    error: 'timeout',
                    name: name,
                };
            }

            return {
                counts: counts,
                name: name,
            };
        } catch ( countError ) {
            return {
                error: countError.message,
                name: name,
            };
        }
    } ) );
};
