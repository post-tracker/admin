import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

import api from './api.js';

const TOKEN_WAIT_TIMEOUT = 100;

// Module-level cache so navigating between pages — each of which mounts its own
// Header, hence its own GameSwitcher — doesn't refetch the game list every time.
// Busted on the 'games-update' event AddGame dispatches when a game is created.
let gamesCache = null;
let gamesPromise = null;

const loadGames = function loadGames () {
    if ( gamesCache ) {
        return Promise.resolve( gamesCache );
    }

    if ( !gamesPromise ) {
        gamesPromise = api.get( '/games' )
            .then( ( games ) => {
                gamesCache = ( games.data || [] ).slice().sort( ( a, b ) => {
                    return a.identifier.localeCompare( b.identifier );
                } );

                return gamesCache;
            } )
            .catch( ( error ) => {
                // Let the next mount retry rather than caching the failure.
                gamesPromise = null;

                throw error;
            } );
    }

    return gamesPromise;
};

// A game picker that lives in the shared Header, so any page can jump straight
// to a game's editor. Self-contained: it loads the game list itself (cached
// across mounts) and drives selection through the router — picking a game
// navigates to '/games/:identifier', and on a '/games/:gameId' route it shows
// that game as the current value. On the other pages it reads as an empty
// "Jump to game" control rather than implying a page-scoped selection.
const GameSwitcher = () => {
    const navigate = useNavigate();
    const params = useParams();

    const [ games, setGames ] = useState( gamesCache || [] );

    useEffect( () => {
        let cancelled = false;
        let timer = null;

        const attempt = () => {
            // api.js authorises with window.apiToken, fetched from /api-token on
            // startup; wait for it like the page views do.
            if ( !window.apiToken ) {
                timer = setTimeout( attempt, TOKEN_WAIT_TIMEOUT );

                return;
            }

            loadGames()
                .then( ( loaded ) => {
                    if ( !cancelled ) {
                        setGames( loaded );
                    }
                } )
                .catch( () => {
                    // Leave the switcher empty on failure; the nav tabs still work.
                } );
        };

        const refresh = () => {
            gamesCache = null;
            gamesPromise = null;

            attempt();
        };

        attempt();
        window.addEventListener( 'games-update', refresh );

        return () => {
            cancelled = true;

            if ( timer ) {
                clearTimeout( timer );
            }

            window.removeEventListener( 'games-update', refresh );
        };
    }, [] );

    const currentGame = games.find( ( game ) => {
        return game.identifier === params.gameId;
    } ) || null;

    return (
        <Autocomplete
            getOptionLabel = { ( game ) => {
                return game.name || '';
            } }
            isOptionEqualToValue = { ( option, value ) => {
                return option.identifier === value.identifier;
            } }
            onChange = { ( event, game ) => {
                if ( game && game.identifier ) {
                    navigate( '/games/' + game.identifier );
                }
            } }
            options = { games }
            renderInput = { ( renderParams ) => {
                return (
                    <TextField
                        { ...renderParams }
                        label = { 'Jump to game' }
                        size = { 'small' }
                        variant = { 'outlined' }
                    />
                );
            } }
            sx = { {
                // Grow to fill the mobile actions row; fixed width on desktop.
                flexGrow: {
                    sm: 0,
                    xs: 1,
                },
                minWidth: 0,
                width: {
                    sm: 240,
                },
            } }
            value = { currentGame }
        />
    );
};

GameSwitcher.displayName = 'GameSwitcher';

export default GameSwitcher;
