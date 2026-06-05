import React from 'react';
import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import Header from './Header.jsx';
import api from './api.js';

const TOKEN_WAIT_TIMEOUT = 100;
const STATS_TIMEOUT = 10000;
const CHART_HEIGHT = 120;
// Queue states shown on the dashboard card, in lifecycle order. The Bull Board
// UI at /queues (the "Open queue manager" link) is the place to act on them.
const QUEUE_FIELDS = [ 'waiting', 'active', 'completed', 'failed', 'delayed' ];

// Rolling windows offered by the per-service breakdown. Keys match the
// `counts` object returned by /stats so the toggle needs no refetch.
const TIMEFRAMES = [
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: 'all', label: 'All' },
];
const DEFAULT_TIMEFRAME = '7d';

const sectionTitleSx = {
    color: 'text.secondary',
    display: 'block',
    letterSpacing: 1,
    mb: 1.5,
};

const formatNumber = function formatNumber ( value ) {
    return Number( value || 0 ).toLocaleString();
};

class Dashboard extends React.Component {
    constructor ( props ) {
        super( props );

        this.loadStats = this.loadStats.bind( this );
        this.loadGames = this.loadGames.bind( this );

        this.state = {
            games: null,
            gamesError: false,
            queues: null,
            queuesError: false,
            queuesLoading: true,
            stats: null,
            statsError: false,
            statsLoading: true,
            timeframe: DEFAULT_TIMEFRAME,
        };
    }

    componentDidMount () {
        this.loadStats();
        this.loadGames();
        this.loadQueues();
    }

    loadStats () {
        // api.js authorises with window.apiToken, which is fetched from
        // /api-token on startup; wait for it like Games does.
        if ( !window.apiToken ) {
            setTimeout( this.loadStats, TOKEN_WAIT_TIMEOUT );

            return;
        }

        // Bound the loading state so a slow/unreachable endpoint degrades to an
        // error instead of spinning forever.
        Promise.race( [
            api.get( '/stats' ),
            new Promise( ( resolve, reject ) => {
                setTimeout( () => {
                    reject( new Error( 'request timed out' ) );
                }, STATS_TIMEOUT );
            } ),
        ] )
            .then( ( stats ) => {
                this.setState( {
                    stats: stats,
                    statsLoading: false,
                } );
            } )
            .catch( ( statsError ) => {
                this.setState( {
                    statsError: statsError.message || 'Failed to load stats',
                    statsLoading: false,
                } );
            } );
    }

    loadGames () {
        // The "quiet games" section needs the full game list — /stats only
        // reports games with at least one post ever, so never-posted games
        // would otherwise be invisible. Wait for the token like loadStats.
        if ( !window.apiToken ) {
            setTimeout( this.loadGames, TOKEN_WAIT_TIMEOUT );

            return;
        }

        api.get( '/games' )
            .then( ( games ) => {
                this.setState( {
                    games: games.data || [],
                } );
            } )
            .catch( ( gamesError ) => {
                this.setState( {
                    gamesError: gamesError.message || 'Failed to load games',
                } );
            } );
    }

    loadQueues () {
        fetch( '/api/queues' )
            .then( ( queuesResponse ) => {
                return queuesResponse.json();
            } )
            .then( ( queues ) => {
                this.setState( {
                    queues: queues,
                    queuesLoading: false,
                } );
            } )
            .catch( ( queuesError ) => {
                this.setState( {
                    queuesError: queuesError.message || 'Failed to load queues',
                    queuesLoading: false,
                } );
            } );
    }

    renderTotals () {
        const totals = ( this.state.stats && this.state.stats.totals ) || {};
        const cards = [
            {
                key: 'games',
                label: 'Games',
            },
            {
                key: 'developers',
                label: 'Developers',
            },
            {
                key: 'accounts',
                label: 'Accounts',
            },
            {
                key: 'posts',
                label: 'Posts',
            },
        ];

        return (
            <Box
                sx = { {
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                        sm: 'repeat(4, 1fr)',
                        xs: 'repeat(2, 1fr)',
                    },
                } }
            >
                { cards.map( ( card ) => {
                    return (
                        <Paper
                            elevation = { 2 }
                            key = { card.key }
                            sx = { {
                                p: 2,
                            } }
                        >
                            <Typography
                                color = { 'text.secondary' }
                                variant = { 'body2' }
                            >
                                { card.label }
                            </Typography>
                            <Typography
                                sx = { {
                                    fontWeight: 600,
                                } }
                                variant = { 'h5' }
                            >
                                { formatNumber( totals[ card.key ] ) }
                            </Typography>
                        </Paper>
                    );
                } ) }
            </Box>
        );
    }

    renderOverTime () {
        const series = ( this.state.stats && this.state.stats.postsOverTime ) || [];

        if ( series.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No recent posts.' }
                </Typography>
            );
        }

        const max = Math.max( ...series.map( ( point ) => {
            return point.count;
        } ), 1 );

        return (
            <Box>
                <Box
                    sx = { {
                        alignItems: 'flex-end',
                        display: 'flex',
                        gap: '2px',
                        // Taller on mobile, where vertical space is cheap and a
                        // 120px chart reads as a thin strip.
                        height: {
                            sm: CHART_HEIGHT,
                            xs: 180,
                        },
                    } }
                >
                    { series.map( ( point ) => {
                        return (
                            <Tooltip
                                arrow
                                key = { point.date }
                                title = { `${ point.date }: ${ formatNumber( point.count ) }` }
                            >
                                <Box
                                    sx = { {
                                        bgcolor: 'primary.main',
                                        borderRadius: '2px 2px 0 0',
                                        flexGrow: 1,
                                        height: `${ Math.max( ( point.count / max ) * 100, 1 ) }%`,
                                        minWidth: 4,
                                    } }
                                />
                            </Tooltip>
                        );
                    } ) }
                </Box>
                <Box
                    sx = { {
                        color: 'text.secondary',
                        display: 'flex',
                        fontSize: 12,
                        justifyContent: 'space-between',
                        mt: 0.5,
                    } }
                >
                    <span>{ series[ 0 ].date }</span>
                    <span>{ series[ series.length - 1 ].date }</span>
                </Box>
            </Box>
        );
    }

    windowedCount ( entry ) {
        // Per-service and per-game payloads both carry a `counts` map keyed by
        // window; tolerate the older single `count` shape if a stale response is
        // served from cache.
        if ( entry.counts ) {
            return entry.counts[ this.state.timeframe ] || 0;
        }

        return entry.count || 0;
    }

    renderTimeframeToggle () {
        return (
            <ToggleButtonGroup
                exclusive
                onChange = { ( event, value ) => {
                    if ( value ) {
                        this.setState( {
                            timeframe: value,
                        } );
                    }
                } }
                size = { 'small' }
                value = { this.state.timeframe }
            >
                { TIMEFRAMES.map( ( frame ) => {
                    return (
                        <ToggleButton
                            key = { frame.key }
                            sx = { {
                                px: 1.5,
                                py: 0.25,
                                textTransform: 'none',
                            } }
                            value = { frame.key }
                        >
                            { frame.label }
                        </ToggleButton>
                    );
                } ) }
            </ToggleButtonGroup>
        );
    }

    renderBars ( rows, labelKey ) {
        const max = Math.max( ...rows.map( ( row ) => {
            return row.value;
        } ), 1 );

        return (
            <Box
                sx = { {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                } }
            >
                { rows.map( ( row ) => {
                    return (
                        <Box
                            key = { row[ labelKey ] }
                            sx = { {
                                alignItems: 'center',
                                display: 'flex',
                                gap: {
                                    sm: 2,
                                    xs: 1,
                                },
                            } }
                        >
                            <Tooltip
                                arrow
                                title = { row[ labelKey ] }
                            >
                                <Box
                                    sx = { {
                                        color: 'text.secondary',
                                        flexShrink: 0,
                                        fontSize: 14,
                                        overflow: 'hidden',
                                        textAlign: 'right',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        // Narrower label/value columns on mobile so
                                        // the bar itself gets most of the width.
                                        width: {
                                            sm: 140,
                                            xs: 96,
                                        },
                                    } }
                                >
                                    { row[ labelKey ] }
                                </Box>
                            </Tooltip>
                            <Box
                                sx = { {
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                    flexGrow: 1,
                                } }
                            >
                                <Box
                                    sx = { {
                                        bgcolor: 'primary.main',
                                        borderRadius: 1,
                                        height: 20,
                                        width: `${ Math.max( ( row.value / max ) * 100, 1 ) }%`,
                                    } }
                                />
                            </Box>
                            <Box
                                sx = { {
                                    flexShrink: 0,
                                    fontSize: 14,
                                    width: {
                                        sm: 80,
                                        xs: 52,
                                    },
                                } }
                            >
                                { formatNumber( row.value ) }
                            </Box>
                        </Box>
                    );
                } ) }
            </Box>
        );
    }

    renderPerService () {
        const services = ( this.state.stats && this.state.stats.postsPerService ) || [];

        if ( services.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No posts yet.' }
                </Typography>
            );
        }

        const rows = services
            .map( ( entry ) => {
                return {
                    service: entry.service,
                    value: this.windowedCount( entry ),
                };
            } )
            .sort( ( a, b ) => {
                return b.value - a.value;
            } );

        return this.renderBars( rows, 'service' );
    }

    renderPerGame () {
        const games = ( this.state.stats && this.state.stats.postsPerGame ) || [];

        // Every game is returned now (no top-N cap); the timeframe toggle drives
        // this list too, so drop games with no posts in the selected window
        // rather than render a long tail of empty bars.
        const rows = games
            .map( ( entry ) => {
                return {
                    name: entry.name,
                    value: this.windowedCount( entry ),
                };
            } )
            .filter( ( row ) => {
                return row.value > 0;
            } )
            .sort( ( a, b ) => {
                return b.value - a.value;
            } );

        if ( rows.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No posts in this timeframe.' }
                </Typography>
            );
        }

        return this.renderBars( rows, 'name' );
    }

    // True when a game has been explicitly taken off the public site
    // (config.live defined and falsy). Mirrors the rest-api /games gate
    // (server.js ~708); a game with live undefined defaults to live.
    isGameDisabled ( game ) {
        return Boolean(
            game.config && typeof game.config.live !== 'undefined' && !game.config.live
        );
    }

    renderQuietChips ( names, disabled ) {
        return (
            <Box
                sx = { {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                } }
            >
                { names.map( ( name ) => {
                    return (
                        <Chip
                            key = { name }
                            label = { name }
                            size = { 'small' }
                            sx = { disabled ? { opacity: 0.55 } : undefined }
                            variant = { 'outlined' }
                        />
                    );
                } ) }
            </Box>
        );
    }

    // Inverse of renderPerGame: every tracked game with zero posts in the
    // selected window. Drives off the full /games list (loadGames) since
    // postsPerGame omits games that have never posted at all. Disabled games
    // (taken off the public site) are split into their own group so the live
    // list stays focused on games that are supposed to be posting.
    renderQuietGames () {
        const games = this.state.games || [];

        if ( games.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { this.state.gamesError
                        ? `Couldn't load games: ${ this.state.gamesError }`
                        : 'No games.' }
                </Typography>
            );
        }

        const countsByName = {};

        ( ( this.state.stats && this.state.stats.postsPerGame ) || [] ).forEach( ( entry ) => {
            countsByName[ entry.name ] = entry;
        } );

        const quietGames = games
            .filter( ( game ) => {
                return game.name && this.windowedCount( countsByName[ game.name ] || {} ) === 0;
            } )
            .sort( ( a, b ) => {
                return a.name.localeCompare( b.name );
            } );

        if ( quietGames.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'All tracked games have posts in this timeframe.' }
                </Typography>
            );
        }

        const liveNames = quietGames
            .filter( ( game ) => {
                return !this.isGameDisabled( game );
            } )
            .map( ( game ) => {
                return game.name;
            } );

        const disabledNames = quietGames
            .filter( ( game ) => {
                return this.isGameDisabled( game );
            } )
            .map( ( game ) => {
                return game.name;
            } );

        return (
            <Box
                sx = { {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                } }
            >
                { liveNames.length > 0
                    ? this.renderQuietChips( liveNames, false )
                    : <Typography
                        color = { 'text.secondary' }
                        variant = { 'body2' }
                    >
                        { 'No active games are quiet in this timeframe.' }
                    </Typography>
                }
                { disabledNames.length > 0 &&
                    <Box>
                        <Typography
                            color = { 'text.secondary' }
                            sx = { {
                                display: 'block',
                                mb: 1,
                            } }
                            variant = { 'caption' }
                        >
                            { `Disabled (${ disabledNames.length })` }
                        </Typography>
                        { this.renderQuietChips( disabledNames, true ) }
                    </Box>
                }
            </Box>
        );
    }

    renderQueues () {
        if ( this.state.queuesLoading ) {
            return (
                <CircularProgress
                    size = { 24 }
                />
            );
        }

        const queues = this.state.queues || [];

        if ( queues.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No queue data available (Redis not configured).' }
                </Typography>
            );
        }

        return (
            <Box
                sx = { {
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                        md: 'repeat(2, 1fr)',
                        xs: '1fr',
                    },
                } }
            >
                { queues.map( ( queue ) => {
                    return (
                        <Paper
                            elevation = { 2 }
                            key = { queue.name }
                            sx = { {
                                p: 2,
                            } }
                        >
                            <Typography
                                sx = { {
                                    mb: 1,
                                } }
                                variant = { 'subtitle1' }
                            >
                                { queue.name }
                            </Typography>
                            { queue.error &&
                                <Typography
                                    color = { 'error' }
                                    variant = { 'body2' }
                                >
                                    { `Unavailable: ${ queue.error }` }
                                </Typography>
                            }
                            { !queue.error && this.renderQueueStats( queue ) }
                        </Paper>
                    );
                } ) }
            </Box>
        );
    }

    // Each state as a column — count above its label — so the two line up,
    // with slash separators between columns (failed turns red when > 0). The
    // slashes sit on the count's baseline via alignItems, so they track the
    // numbers rather than floating between the two rows.
    renderQueueStats ( queue ) {
        return (
            <Box
                sx = { {
                    alignItems: 'baseline',
                    display: 'flex',
                    gap: 1,
                } }
            >
                { QUEUE_FIELDS.map( ( field, index ) => {
                    return (
                        <React.Fragment
                            key = { field }
                        >
                            { index > 0 &&
                                <Typography
                                    component = { 'span' }
                                    sx = { {
                                        color: 'text.disabled',
                                        fontWeight: 600,
                                    } }
                                    variant = { 'h5' }
                                >
                                    { '/' }
                                </Typography>
                            }
                            <Box
                                sx = { {
                                    alignItems: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                } }
                            >
                                <Typography
                                    sx = { {
                                        color: field === 'failed' && queue.counts[ field ] > 0
                                            ? 'error.main'
                                            : 'text.primary',
                                        fontWeight: 600,
                                    } }
                                    variant = { 'h5' }
                                >
                                    { formatNumber( queue.counts[ field ] ) }
                                </Typography>
                                <Typography
                                    color = { 'text.secondary' }
                                    sx = { {
                                        textTransform: 'capitalize',
                                    } }
                                    variant = { 'caption' }
                                >
                                    { field }
                                </Typography>
                            </Box>
                        </React.Fragment>
                    );
                } ) }
            </Box>
        );
    }

    renderQueueManagerLink () {
        // Bull Board is its own server-rendered app mounted at /queues by the
        // admin server; open it in a new tab for the full job-inspection UI.
        return (
            <Button
                endIcon = { <OpenInNewIcon /> }
                href = { '/queues' }
                rel = { 'noopener' }
                size = { 'small' }
                target = { '_blank' }
            >
                { 'Open queue manager' }
            </Button>
        );
    }

    renderSection ( title, content, action ) {
        return (
            <Box
                sx = { {
                    mb: 4,
                } }
            >
                <Box
                    sx = { {
                        alignItems: 'center',
                        display: 'flex',
                        justifyContent: 'space-between',
                        minHeight: 34,
                    } }
                >
                    <Typography
                        sx = { sectionTitleSx }
                        variant = { 'overline' }
                    >
                        { title }
                    </Typography>
                    { action }
                </Box>
                { content }
            </Box>
        );
    }

    renderBody () {
        if ( this.state.statsLoading ) {
            return (
                <Box
                    sx = { {
                        display: 'flex',
                        justifyContent: 'center',
                        p: 6,
                    } }
                >
                    <CircularProgress />
                </Box>
            );
        }

        return (
            <Box>
                { this.state.statsError &&
                    <Alert
                        severity = { 'error' }
                        sx = { {
                            mb: 3,
                        } }
                    >
                        { `Couldn't load stats: ${ this.state.statsError }` }
                    </Alert>
                }
                { this.renderSection( 'Totals', this.renderTotals() ) }
                { this.renderSection( 'Queue health', this.renderQueues(), this.renderQueueManagerLink() ) }
                { this.renderSection( 'Quiet games (no posts in timeframe)', this.renderQuietGames(), this.renderTimeframeToggle() ) }
                { this.renderSection( 'Posts over time (30 days)', this.renderOverTime() ) }
                { this.renderSection( 'Posts per service', this.renderPerService(), this.renderTimeframeToggle() ) }
                { this.renderSection( 'Posts per game', this.renderPerGame(), this.renderTimeframeToggle() ) }
            </Box>
        );
    }

    render () {
        return (
            <div>
                <Header
                    onNavigate = { this.props.onNavigate }
                    view = { 'dashboard' }
                />
                <Box
                    sx = { {
                        m: '0 auto',
                        maxWidth: 1100,
                        p: {
                            sm: 3,
                            xs: 1.5,
                        },
                    } }
                >
                    { this.renderBody() }
                </Box>
            </div>
        );
    }
}

Dashboard.displayName = 'Dashboard';

Dashboard.propTypes = {
    onNavigate: PropTypes.func.isRequired,
};

export default Dashboard;
