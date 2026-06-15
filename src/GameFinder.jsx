import React from 'react';
import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import Header from './Header.jsx';

// The scan runs Twitch + Steam + per-app enrichment server-side, so it's slower
// than a normal API read — give it a generous ceiling before giving up.
const REQUEST_TIMEOUT = 45000;

// Sortable columns. `key` is the candidate field compared; `released` sorts on
// the parsed releasedAt timestamp, not the display string.
const COLUMNS = [
    { id: 'name', label: 'Game', numeric: false, sortKey: 'name' },
    { id: 'released', label: 'Released', numeric: false, sortKey: 'releasedAt' },
    { id: 'viewers', label: 'Viewers', numeric: true, sortKey: 'viewers' },
    { id: 'players', label: 'Players', numeric: true, sortKey: 'players' },
    { id: 'score', label: 'Score', numeric: true, sortKey: 'score' },
];

class GameFinder extends React.Component {
    constructor ( props ) {
        super( props );

        this.load = this.load.bind( this );
        this.refresh = this.refresh.bind( this );
        this.handleRescan = this.handleRescan.bind( this );

        this.state = {
            candidates: [],
            error: false,
            ignored: [],
            loading: true,
            order: 'desc',
            orderBy: 'score',
            scannedAt: false,
            showIgnored: false,
        };
    }

    // Toggle direction when re-clicking the active column, otherwise switch to
    // the new column starting descending (high-first, the natural read for these
    // ranking-style metrics).
    handleSort ( columnId ) {
        this.setState( ( state ) => {
            if ( state.orderBy === columnId ) {
                return {
                    order: state.order === 'asc' ? 'desc' : 'asc',
                };
            }

            return {
                order: 'desc',
                orderBy: columnId,
            };
        } );
    }

    // Sort a copy of the candidates by the active column. Missing values (null
    // viewers/players, unparseable release dates) always sink to the bottom
    // regardless of direction, so they never crowd out real data.
    sortedCandidates () {
        const column = COLUMNS.find( ( entry ) => {
            return entry.id === this.state.orderBy;
        } ) || COLUMNS[ 0 ];

        const direction = this.state.order === 'asc' ? 1 : -1;

        const valueOf = ( candidate ) => {
            const raw = candidate[ column.sortKey ];

            if ( column.id === 'name' ) {
                return String( raw ).toLowerCase();
            }

            return raw;
        };

        const isMissing = ( value ) => {
            return value === null || value === undefined || value === '';
        };

        return [ ...this.state.candidates ].sort( ( first, second ) => {
            const firstValue = valueOf( first );
            const secondValue = valueOf( second );
            const firstMissing = isMissing( firstValue );
            const secondMissing = isMissing( secondValue );

            if ( firstMissing || secondMissing ) {
                return firstMissing - secondMissing;
            }

            if ( firstValue < secondValue ) {
                return -1 * direction;
            }

            if ( firstValue > secondValue ) {
                return direction;
            }

            return 0;
        } );
    }

    componentDidMount () {
        this.load( false );
    }

    fetchFinder ( path ) {
        return Promise.race( [
            fetch( `/api/game-finder${ path }`, {
                method: path.startsWith( '/' ) && path !== '' ? 'POST' : 'GET',
            } )
                .then( ( response ) => {
                    if ( !response.ok ) {
                        throw new Error( `request returned ${ response.status }` );
                    }

                    return response.json();
                } ),
            new Promise( ( resolve, reject ) => {
                setTimeout( () => {
                    reject( new Error( 'request timed out' ) );
                }, REQUEST_TIMEOUT );
            } ),
        ] );
    }

    // Full (re)load with the page-level spinner — initial mount and Rescan.
    load ( force ) {
        this.setState( {
            error: false,
            loading: true,
        } );

        this.fetchFinder( force ? '?force=1' : '' )
            .then( ( result ) => {
                this.setState( {
                    candidates: ( result && result.candidates ) || [],
                    error: false,
                    ignored: ( result && result.ignored ) || [],
                    loading: false,
                    scannedAt: ( result && result.scannedAt ) || false,
                } );
            } )
            .catch( ( loadError ) => {
                this.setState( {
                    error: loadError.message || 'Failed to run scan',
                    loading: false,
                } );
            } );
    }

    // Silent refresh after an ignore/unignore — the scan is cached, so this is
    // instant and avoids flashing the spinner over the whole table.
    refresh () {
        this.fetchFinder( '' )
            .then( ( result ) => {
                this.setState( {
                    candidates: ( result && result.candidates ) || [],
                    ignored: ( result && result.ignored ) || [],
                    scannedAt: ( result && result.scannedAt ) || false,
                } );
            } )
            .catch( ( refreshError ) => {
                this.setState( {
                    error: refreshError.message || 'Failed to refresh',
                } );
            } );
    }

    handleRescan () {
        this.load( true );
    }

    ignore ( name ) {
        this.fetchFinder( `/ignore?name=${ encodeURIComponent( name ) }` )
            .then( () => {
                this.refresh();
            } )
            .catch( ( ignoreError ) => {
                this.setState( {
                    error: ignoreError.message || 'Failed to ignore game',
                } );
            } );
    }

    unignore ( name ) {
        this.fetchFinder( `/unignore?name=${ encodeURIComponent( name ) }` )
            .then( () => {
                this.refresh();
            } )
            .catch( ( unignoreError ) => {
                this.setState( {
                    error: unignoreError.message || 'Failed to restore game',
                } );
            } );
    }

    renderHead () {
        return (
            <TableHead>
                <TableRow>
                    { COLUMNS.map( ( column ) => {
                        return (
                            <TableCell
                                key = { column.id }
                                align = { column.numeric ? 'right' : 'left' }
                                sortDirection = { this.state.orderBy === column.id ? this.state.order : false }
                            >
                                <TableSortLabel
                                    active = { this.state.orderBy === column.id }
                                    direction = { this.state.orderBy === column.id ? this.state.order : 'desc' }
                                    onClick = { () => {
                                        this.handleSort( column.id );
                                    } }
                                >
                                    { column.label }
                                </TableSortLabel>
                            </TableCell>
                        );
                    } ) }
                    <TableCell align = { 'right' }>{ '' }</TableCell>
                </TableRow>
            </TableHead>
        );
    }

    renderTable () {
        return (
            <Paper
                elevation = { 2 }
            >
                <Table>
                    { this.renderHead() }
                    <TableBody>
                        { this.sortedCandidates().map( ( candidate ) => {
                            return (
                                <TableRow
                                    key = { candidate.key }
                                >
                                    <TableCell>
                                        <Typography
                                            variant = { 'body2' }
                                            sx = { {
                                                fontWeight: 600,
                                            } }
                                        >
                                            { candidate.name }
                                        </Typography>
                                        { candidate.developer &&
                                            <Typography
                                                color = { 'text.secondary' }
                                                variant = { 'caption' }
                                                sx = { {
                                                    display: 'block',
                                                } }
                                            >
                                                { candidate.developer }
                                            </Typography>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            color = { 'text.secondary' }
                                            variant = { 'body2' }
                                        >
                                            { candidate.released || '—' }
                                        </Typography>
                                    </TableCell>
                                    <TableCell align = { 'right' }>
                                        { typeof candidate.viewers === 'number'
                                            ? <Link
                                                href = { candidate.twitchUrl }
                                                rel = { 'noopener noreferrer' }
                                                sx = { {
                                                    fontVariantNumeric: 'tabular-nums',
                                                } }
                                                target = { '_blank' }
                                            >
                                                { candidate.viewers.toLocaleString( 'en-US' ) }
                                            </Link>
                                            : <Typography
                                                color = { 'text.secondary' }
                                                variant = { 'body2' }
                                            >
                                                { '—' }
                                            </Typography>
                                        }
                                    </TableCell>
                                    <TableCell align = { 'right' }>
                                        { typeof candidate.players === 'number'
                                            ? <Link
                                                href = { candidate.steamUrl }
                                                rel = { 'noopener noreferrer' }
                                                sx = { {
                                                    fontVariantNumeric: 'tabular-nums',
                                                } }
                                                target = { '_blank' }
                                            >
                                                { candidate.players.toLocaleString( 'en-US' ) }
                                            </Link>
                                            : <Link
                                                href = { candidate.steamUrl }
                                                rel = { 'noopener noreferrer' }
                                                target = { '_blank' }
                                            >
                                                { '—' }
                                            </Link>
                                        }
                                    </TableCell>
                                    <TableCell align = { 'right' }>
                                        <Typography
                                            variant = { 'body2' }
                                            sx = { {
                                                fontVariantNumeric: 'tabular-nums',
                                                fontWeight: 600,
                                            } }
                                        >
                                            { Math.round( candidate.score ) }
                                        </Typography>
                                    </TableCell>
                                    <TableCell align = { 'right' }>
                                        <Tooltip
                                            title = { 'Not interested — ignore' }
                                        >
                                            <IconButton
                                                onClick = { () => {
                                                    this.ignore( candidate.name );
                                                } }
                                                size = { 'small' }
                                            >
                                                <VisibilityOffIcon
                                                    fontSize = { 'small' }
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        } ) }
                    </TableBody>
                </Table>
            </Paper>
        );
    }

    renderIgnored () {
        if ( this.state.ignored.length === 0 ) {
            return null;
        }

        return (
            <Box
                sx = { {
                    mt: 3,
                } }
            >
                <Button
                    color = { 'inherit' }
                    onClick = { () => {
                        this.setState( {
                            showIgnored: !this.state.showIgnored,
                        } );
                    } }
                    size = { 'small' }
                    sx = { {
                        textTransform: 'none',
                    } }
                >
                    { `${ this.state.showIgnored ? 'Hide' : 'Show' } ignored (${ this.state.ignored.length })` }
                </Button>
                { this.state.showIgnored &&
                    <Box
                        sx = { {
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            mt: 1,
                        } }
                    >
                        { this.state.ignored.map( ( name ) => {
                            return (
                                <Chip
                                    key = { name }
                                    label = { name }
                                    onDelete = { () => {
                                        this.unignore( name );
                                    } }
                                    size = { 'small' }
                                />
                            );
                        } ) }
                    </Box>
                }
            </Box>
        );
    }

    renderBody () {
        if ( this.state.loading ) {
            return (
                <Box
                    sx = { {
                        alignItems: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        p: 6,
                    } }
                >
                    <CircularProgress />
                    <Typography
                        color = { 'text.secondary' }
                        variant = { 'body2' }
                    >
                        { 'Scanning Twitch and Steam…' }
                    </Typography>
                </Box>
            );
        }

        if ( this.state.candidates.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No new candidates — every Early Access top seller is already tracked or ignored.' }
                </Typography>
            );
        }

        return (
            <React.Fragment>
                { this.renderTable() }
                { this.renderIgnored() }
            </React.Fragment>
        );
    }

    render () {
        return (
            <div>
                <Header
                    actions = {
                        <Button
                            color = { 'inherit' }
                            disabled = { this.state.loading }
                            onClick = { this.handleRescan }
                            startIcon = { <RefreshIcon /> }
                        >
                            { 'Rescan' }
                        </Button>
                    }
                    onNavigate = { this.props.onNavigate }
                    view = { 'game-finder' }
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
                    { this.state.error &&
                        <Alert
                            severity = { 'error' }
                            sx = { {
                                mb: 3,
                            } }
                        >
                            { `Couldn't run scan: ${ this.state.error }` }
                        </Alert>
                    }
                    { this.renderBody() }
                    { this.state.scannedAt && !this.state.loading &&
                        <Typography
                            color = { 'text.secondary' }
                            sx = { {
                                display: 'block',
                                mt: 2,
                            } }
                            variant = { 'caption' }
                        >
                            { `Scanned ${ new Date( this.state.scannedAt ).toLocaleString() }` }
                        </Typography>
                    }
                </Box>
            </div>
        );
    }
}

GameFinder.displayName = 'GameFinder';

GameFinder.propTypes = {
    onNavigate: PropTypes.func.isRequired,
};

export default GameFinder;
