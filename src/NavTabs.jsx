import PropTypes from 'prop-types';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

// Shared top-bar navigation between the Dashboard landing view and the Games
// manager. Rendered inside each view's AppBar; the active view + switch handler
// are owned by App.jsx.
const NavTabs = ( props ) => {
    return (
        <Tabs
            onChange = { ( event, value ) => {
                props.onNavigate( value );
            } }
            sx = { {
                mr: 2,
                '& .MuiTab-root': {
                    minHeight: 64,
                    textTransform: 'none',
                },
            } }
            value = { props.view }
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
