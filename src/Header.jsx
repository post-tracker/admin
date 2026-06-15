import PropTypes from 'prop-types';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import NavTabs from './NavTabs.jsx';

// The single application header shared by every view: the product name on the
// far left (doubles as a home link to the Dashboard), primary navigation next
// to it, and a right-aligned slot for page-specific actions. The active page is
// conveyed by the highlighted tab, so views no longer repeat their name as a
// title in the bar.
const Header = ( props ) => {
    return (
        <AppBar
            color = { 'default' }
            position = { 'static' }
        >
            <Toolbar>
                <Typography
                    noWrap
                    onClick = { () => {
                        props.onNavigate( 'dashboard' );
                    } }
                    sx = { {
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontWeight: 700,
                        mr: 4,
                    } }
                    variant = { 'h6' }
                >
                    { 'Post Tracker' }
                </Typography>
                <NavTabs
                    onNavigate = { props.onNavigate }
                    view = { props.view }
                />
                <Box
                    sx = { {
                        flexGrow: 1,
                    } }
                />
                { props.actions }
            </Toolbar>
        </AppBar>
    );
};

Header.displayName = 'Header';

Header.propTypes = {
    actions: PropTypes.node,
    onNavigate: PropTypes.func.isRequired,
    view: PropTypes.oneOf( [ 'dashboard', 'games', 'game-finder', 'tokens' ] ).isRequired,
};

export default Header;
