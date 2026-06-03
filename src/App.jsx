import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Dashboard from './Dashboard.jsx';
import Games from './Games.jsx';
import Tokens from './Tokens.jsx';

// Land on the Games manager (not the Dashboard) when arriving via the
// ?action=add-dev deep link so that prefill flow still works.
const initialView = function initialView () {
    if ( typeof window !== 'undefined' && window.location.search.includes( 'action=add-dev' ) ) {
        return 'games';
    }

    return 'dashboard';
};

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

const App = () => {
    const [ view, setView ] = useState( initialView );

    return (
        <ThemeProvider theme = { theme }>
            <CssBaseline />
            { view === 'dashboard' &&
                <Dashboard
                    onNavigate = { setView }
                />
            }
            { view === 'games' &&
                <Games
                    onNavigate = { setView }
                />
            }
            { view === 'tokens' &&
                <Tokens
                    onNavigate = { setView }
                />
            }
        </ThemeProvider>
    );
};

const root = createRoot( document.getElementById( 'app' ) );

root.render( <App /> );
