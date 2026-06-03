import React from 'react';
import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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

        this.state = {
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
                        height: CHART_HEIGHT,
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

    serviceCount ( entry ) {
        // New payloads carry a `counts` map per window; tolerate the older
        // single `count` shape if a stale response is served from cache.
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
                                gap: 2,
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
                                        width: 140,
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
                                    width: 80,
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
                    value: this.serviceCount( entry ),
                };
            } )
            .sort( ( a, b ) => {
                return b.value - a.value;
            } );

        return this.renderBars( rows, 'service' );
    }

    renderPerGame () {
        const games = ( this.state.stats && this.state.stats.postsPerGame ) || [];

        if ( games.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No posts yet.' }
                </Typography>
            );
        }

        const rows = games.map( ( entry ) => {
            return {
                name: entry.name,
                value: entry.count,
            };
        } );

        return this.renderBars( rows, 'name' );
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
                        sm: 'repeat(2, 1fr)',
                        xs: '1fr',
                    },
                } }
            >
                { queues.map( ( queue ) => {
                    return (
                        <Paper
                            key = { queue.name }
                            sx = { {
                                p: 2,
                            } }
                            variant = { 'outlined' }
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
                            { !queue.error &&
                                <Box
                                    sx = { {
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 2,
                                    } }
                                >
                                    { QUEUE_FIELDS.map( ( field ) => {
                                        return (
                                            <Box
                                                key = { field }
                                            >
                                                <Typography
                                                    sx = { {
                                                        color: field === 'failed' && queue.counts[ field ] > 0
                                                            ? 'error.main'
                                                            : 'text.primary',
                                                        fontWeight: 600,
                                                    } }
                                                    variant = { 'h6' }
                                                >
                                                    { formatNumber( queue.counts[ field ] ) }
                                                </Typography>
                                                <Typography
                                                    color = { 'text.secondary' }
                                                    variant = { 'caption' }
                                                >
                                                    { field }
                                                </Typography>
                                            </Box>
                                        );
                                    } ) }
                                </Box>
                            }
                        </Paper>
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
                { this.renderSection( 'Posts over time (30 days)', this.renderOverTime() ) }
                { this.renderSection( 'Posts per service', this.renderPerService(), this.renderTimeframeToggle() ) }
                { this.renderSection( 'Posts per game (top 20)', this.renderPerGame() ) }
                { this.renderSection( 'Queue health', this.renderQueues(), this.renderQueueManagerLink() ) }
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
                            xs: 2,
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
