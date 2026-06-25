// Tiny shared navigation helpers used by both App.jsx (the router) and the
// header components (Header.jsx / NavTabs.jsx). Kept in their own module so the
// header components don't have to import from App.jsx — that would create an
// import cycle back into the module that bootstraps the app (createRoot).

// The Dashboard is the home page, so its canonical path is '/'; Games, Game
// Finder and Tokens sit at '/games', '/game-finder' and '/tokens'.
export const pathForView = function pathForView ( view ) {
    if ( view === 'dashboard' ) {
        return '/';
    }

    return '/' + view;
};

// A left-click with no modifier keys is the only case we hijack for in-app
// (SPA) navigation. Ctrl/Cmd/Shift/Alt clicks, or any non-primary button
// (e.g. middle-click), are left alone so the browser's native anchor
// behaviour — open in a new tab/window — takes over.
export const isPlainLeftClick = function isPlainLeftClick ( event ) {
    return event.button === 0 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey;
};
