import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { getQueueInstances } from './queues.js';

// Builds the Bull Board UI router — the full Bull experience (browse jobs by
// state, inspect job data/logs, retry/promote/remove) — over the same Bull queue
// instances the dashboard's count endpoint uses. Mounted by server.js (prod) and
// vite.config.js (dev) at a shared base path. Returns null when no REDIS_URL is
// configured, so callers simply skip mounting it (matches getQueueCounts → []).

// Cache the built router keyed by base path; the underlying queue instances are
// already cached in queues.js.
let routerCache = null;

export const createQueuesRouter = function createQueuesRouter ( basePath ) {
    if ( routerCache && routerCache.basePath === basePath ) {
        return routerCache.router;
    }

    const queues = getQueueInstances();

    if ( queues.length === 0 ) {
        return null;
    }

    const serverAdapter = new ExpressAdapter();

    serverAdapter.setBasePath( basePath );

    createBullBoard( {
        queues: queues.map( ( queue ) => {
            return new BullAdapter( queue );
        } ),
        serverAdapter: serverAdapter,
    } );

    routerCache = {
        basePath: basePath,
        router: serverAdapter.getRouter(),
    };

    return routerCache.router;
};
