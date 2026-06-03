import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Games from './Games.jsx';

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
    return (
        <ThemeProvider theme = { theme }>
            <CssBaseline />
            <Games />
        </ThemeProvider>
    );
};

const root = createRoot( document.getElementById( 'app' ) );

root.render( <App /> );
