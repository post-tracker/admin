import React from 'react';
import PropTypes from 'prop-types';

import AppBar from '@mui/material/AppBar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import NavTabs from './NavTabs.jsx';
import api from './api.js';

const TOKEN_WAIT_TIMEOUT = 100;
const STATS_TIMEOUT = 10000;
const CHART_HEIGHT = 120;
const QUEUE_FIELDS = [ 'waiting', 'active', 'completed', 'failed', 'delayed' ];

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

        const max = Math.max( ...services.map( ( entry ) => {
            return entry.count;
        } ), 1 );

        return (
            <Box
                sx = { {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                } }
            >
                { services.map( ( entry ) => {
                    return (
                        <Box
                            key = { entry.service }
                            sx = { {
                                alignItems: 'center',
                                display: 'flex',
                                gap: 2,
                            } }
                        >
                            <Box
                                sx = { {
                                    color: 'text.secondary',
                                    flexShrink: 0,
                                    fontSize: 14,
                                    textAlign: 'right',
                                    width: 120,
                                } }
                            >
                                { entry.service }
                            </Box>
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
                                        width: `${ Math.max( ( entry.count / max ) * 100, 1 ) }%`,
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
                                { formatNumber( entry.count ) }
                            </Box>
                        </Box>
                    );
                } ) }
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

    renderSection ( title, content ) {
        return (
            <Box
                sx = { {
                    mb: 4,
                } }
            >
                <Typography
                    sx = { sectionTitleSx }
                    variant = { 'overline' }
                >
                    { title }
                </Typography>
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
                { this.renderSection( 'Posts per service', this.renderPerService() ) }
                { this.renderSection( 'Queue health', this.renderQueues() ) }
            </Box>
        );
    }

    render () {
        return (
            <div>
                <AppBar
                    color = { 'default' }
                    position = { 'static' }
                >
                    <Toolbar>
                        <NavTabs
                            onNavigate = { this.props.onNavigate }
                            view = { 'dashboard' }
                        />
                        <Typography
                            variant = { 'h6' }
                        >
                            { 'Dashboard' }
                        </Typography>
                    </Toolbar>
                </AppBar>
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
