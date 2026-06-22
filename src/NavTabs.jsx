import PropTypes from 'prop-types';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

// Shared top-bar navigation between the Dashboard landing view and the Games
// manager. Rendered inside each view's AppBar; the active view + switch handler
// are owned by App.jsx.
const NavTabs = ( props ) => {
    return (
        <Tabs
            allowScrollButtonsMobile
            onChange = { ( event, value ) => {
                props.onNavigate( value );
            } }
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
            <Tab
                label = { 'Dashboard' }
                value = { 'dashboard' }
            />
            <Tab
                label = { 'Games' }
                value = { 'games' }
            />
            <Tab
                label = { 'Game Finder' }
                value = { 'game-finder' }
            />
            <Tab
                label = { 'Tokens' }
                value = { 'tokens' }
            />
        </Tabs>
    );
};

NavTabs.displayName = 'NavTabs';

NavTabs.propTypes = {
    onNavigate: PropTypes.func.isRequired,
    view: PropTypes.oneOf( [ 'dashboard', 'games', 'game-finder', 'tokens' ] ).isRequired,
};

export default NavTabs;
