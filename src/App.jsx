import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Dashboard from './Dashboard.jsx';
import Games from './Games.jsx';
import GameFinder from './GameFinder.jsx';
import Tokens from './Tokens.jsx';

const theme = createTheme( {
    palette: {
        background: {
            // Grey page background so the white Paper cards stand out against it.
            // (CssBaseline otherwise paints the body white, hiding the cards.)
            default: '#edecec',
        },
    },
    components: {
        MuiTextField: {
            defaultProps: {
                margin: 'dense',
                variant: 'standard',
            },
        },
        MuiInput: {
            defaultProps: {
                // Mirrors the legacy material-ui underlineShow={false}: the
                // separating lines come from the explicit <Divider/>s, not the
                // input's own underline.
                disableUnderline: true,
            },
        },
    },
} );

// The Dashboard is the home page, so its canonical path is '/'; Games and Tokens
// sit at '/games' and '/tokens'.
const pathForView = function pathForView ( view ) {
    if ( view === 'dashboard' ) {
        return '/';
    }

    return '/' + view;
};

// Each view (Dashboard/Games/Tokens) already knows its own name and hands an
// `onNavigate(view)` callback to the shared Header/NavTabs. Bridge that existing
// contract onto the router: a view name ('dashboard'|'games'|'tokens') becomes
// the matching path, so the views themselves need no router awareness.
const RoutedView = ( props ) => {
    const navigate = useNavigate();
    const Component = props.component;

    return (
        <Component
            onNavigate = { ( view ) => {
                navigate( pathForView( view ) );
            } }
        />
    );
};

RoutedView.displayName = 'RoutedView';

RoutedView.propTypes = {
    component: PropTypes.elementType.isRequired,
};

// Games gets a dedicated wrapper because it carries a selected-game in the path
// ('/games/:gameId'). The `:gameId` route param (a game identifier, e.g. 'tab')
// flows in as `routeGameId`, and picking a game in the switcher navigates to the
// matching path via `onSelectGame` so the selection is deep-linkable and
// back/forward works. Bare '/games' (no param) leaves Games to fall back to its
// cookie/first-game default.
const RoutedGames = () => {
    const navigate = useNavigate();
    const params = useParams();

    return (
        <Games
            onNavigate = { ( view ) => {
                navigate( pathForView( view ) );
            } }
            onSelectGame = { ( identifier ) => {
                navigate( '/games/' + identifier );
            } }
            routeGameId = { params.gameId || false }
        />
    );
};

RoutedGames.displayName = 'RoutedGames';

// '/' is the Dashboard home. The ?action=add-dev deep link also points at '/'
// (e.g. https://post-admin.kokarn.com/?action=add-dev&game=...), so when that
// param is present, route to Games with the query intact to preserve the
// prefill flow; otherwise render the Dashboard in place.
const IndexRoute = () => {
    const location = useLocation();
    const navigate = useNavigate();

    if ( location.search.includes( 'action=add-dev' ) ) {
        return (
            <Navigate
                replace
                to = { '/games' + location.search }
            />
        );
    }

    // Dashboard navigates like RoutedGames: onNavigate switches top-level views,
    // onSelectGame deep-links a quiet game to its '/games/:gameId' page.
    return (
        <Dashboard
            onNavigate = { ( view ) => {
                navigate( pathForView( view ) );
            } }
            onSelectGame = { ( identifier ) => {
                navigate( '/games/' + identifier );
            } }
        />
    );
};

IndexRoute.displayName = 'IndexRoute';

const App = () => {
    return (
        <ThemeProvider theme = { theme }>
            <CssBaseline />
            <BrowserRouter>
                <Routes>
                    <Route
                        element = { <IndexRoute /> }
                        path = { '/' }
                    />
                    <Route
                        element = { <RoutedGames /> }
                        path = { '/games' }
                    />
                    <Route
                        element = { <RoutedGames /> }
                        path = { '/games/:gameId' }
                    />
                    <Route
                        element = { <RoutedView component = { GameFinder } /> }
                        path = { '/game-finder' }
                    />
                    <Route
                        element = { <RoutedView component = { Tokens } /> }
                        path = { '/tokens' }
                    />
                    { /* Unknown paths (incl. any old /dashboard) fall back home. */ }
                    <Route
                        element = {
                            <Navigate
                                replace
                                to = { '/' }
                            />
                        }
                        path = { '*' }
                    />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
};

const root = createRoot( document.getElementById( 'app' ) );

root.render( <App /> );
