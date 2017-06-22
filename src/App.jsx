import React from 'react';
import { render } from 'react-dom';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import injectTapEventPlugin from 'react-tap-event-plugin';

import Games from './Games.jsx';

const App = () => {
    return (
        <MuiThemeProvider>
            <Games />
        </MuiThemeProvider>
    );
};

injectTapEventPlugin();

render(
    <App />,
    document.getElementById( 'app' )
);
