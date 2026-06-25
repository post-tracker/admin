import PropTypes from 'prop-types';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { isPlainLeftClick, pathForView } from './navigation.js';

// Shared top-bar navigation between the Dashboard landing view and the Games
// manager. Rendered inside each view's AppBar; the active view + switch handler
// are owned by App.jsx.
//
// Each tab renders as a real anchor (component="a" + href) so the browser can
// handle ctrl/cmd/middle-click natively (open in a new tab). A plain left-click
// is intercepted and handled as in-app SPA navigation instead.
const NavTabs = ( props ) => {
    const tabs = [
        {
            label: 'Dashboard',
            value: 'dashboard',
        },
        {
            label: 'Games',
            value: 'games',
        },
        {
            label: 'Game Finder',
            value: 'game-finder',
        },
        {
            label: 'Tokens',
            value: 'tokens',
        },
    ];

    return (
        <Tabs
            allowScrollButtonsMobile
            scrollButtons = { 'auto' }
            sx = { {
                // Scrollable so the four tabs never squeeze the title/actions on
                // a narrow phone — they scroll horizontally instead.
                maxWidth: '100%',
                mr: 2,
                '& .MuiTab-root': {
                    minHeight: 64,
                    textTransform: 'none',
                },
            } }
            value = { props.view }
            variant = { 'scrollable' }
        >
            { tabs.map( ( tab ) => {
                return (
                    <Tab
                        component = { 'a' }
                        href = { pathForView( tab.value ) }
                        key = { tab.value }
                        label = { tab.label }
                        onClick = { ( event ) => {
                            if ( !isPlainLeftClick( event ) ) {
                                return;
                            }

                            event.preventDefault();
                            props.onNavigate( tab.value );
                        } }
                        value = { tab.value }
                    />
                );
            } ) }
        </Tabs>
    );
};

NavTabs.displayName = 'NavTabs';

NavTabs.propTypes = {
    onNavigate: PropTypes.func.isRequired,
    view: PropTypes.oneOf( [ 'dashboard', 'games', 'game-finder', 'tokens' ] ).isRequired,
};

export default NavTabs;
