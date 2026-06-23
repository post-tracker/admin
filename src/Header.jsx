import PropTypes from 'prop-types';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import GameSwitcher from './GameSwitcher.jsx';
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
            <Toolbar
                sx = { {
                    // On phones the title + tabs + actions don't fit one row, so
                    // let the actions wrap onto their own full-width row below
                    // (md+ keeps everything on a single line).
                    flexWrap: {
                        md: 'nowrap',
                        xs: 'wrap',
                    },
                    gap: {
                        md: 0,
                        xs: 1,
                    },
                    py: {
                        md: 0,
                        xs: 1,
                    },
                } }
            >
                <Typography
                    noWrap
                    onClick = { () => {
                        props.onNavigate( 'dashboard' );
                    } }
                    sx = { {
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontWeight: 700,
                        mr: {
                            md: 4,
                            xs: 2,
                        },
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
                        alignItems: 'center',
                        display: 'flex',
                        // Fill the row and right-align on desktop; drop to a full
                        // width row of its own on mobile.
                        flexBasis: {
                            md: 'auto',
                            xs: '100%',
                        },
                        gap: 1,
                        justifyContent: 'flex-end',
                        ml: {
                            md: 'auto',
                        },
                    } }
                >
                    <GameSwitcher />
                    { props.actions }
                </Box>
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
