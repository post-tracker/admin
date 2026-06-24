import React from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';

// The game's RSS sources: every source whose type/name is RSS that carries a
// feed endpoint. A game can have several (e.g. Project Zomboid's "Thursdoid" and
// a separate dev blog), each its own feed with its own developers, so this
// returns a list. Each entry keeps the source `key` and `label`: the label (or
// the key when unlabelled) is the DB `service` an added account must carry —
// queue-users resolves an account back to its source by label-then-key, and it's
// what the add-account picker offers. Returns [] when the game has no RSS source.
const rssSources = function rssSources ( game ) {
    const sources = ( game && game.config && game.config.sources ) || {};

    return Object.entries( sources )
        .filter( ( [ name, config ] ) => {
            return config && ( ( config.type || name ) === 'RSS' ) && config.endpoint;
        } )
        .map( ( [ name, config ] ) => {
            return {
                endpoint: config.endpoint,
                key: name,
                label: config.label || name,
            };
        } );
};

// "Find developers on RSS" — discovers a dev blog's authors via /api/rss-devs
// (server.js / vite dev mirror -> rss.js), which reads each feed's <dc:creator>
// (the field grunt attributes posts on). Candidates are grouped by source so a
// multi-feed game stays legible, and each not-yet-tracked author has an Add
// button that hands a prefill up to Games, opening the existing AddDeveloper
// dialog ready to save (service = the source's label||key, identifier = the
// creator). Renders nothing when the game has no RSS source.
class RssDeveloperFinder extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleOpen = this.handleOpen.bind( this );
        this.handleClose = this.handleClose.bind( this );

        this.state = {
            anchorEl: null,
            busy: false,
            developers: [],
            message: '',
        };
    }

    // Map of source service value (label or key, as stored on an account) ->
    // Set of that source's tracked identifiers, lowercased. grunt matches a feed
    // creator against the account identifier case-insensitively, so match the
    // same way here or a case difference would offer an already-tracked author.
    trackedByService () {
        const map = new Map();

        for ( const developer of this.props.developers ) {
            for ( const account of developer.accounts || [] ) {
                if ( !account.service || !account.identifier ) {
                    continue;
                }

                if ( !map.has( account.service ) ) {
                    map.set( account.service, new Set() );
                }

                map.get( account.service ).add( String( account.identifier ).trim().toLowerCase() );
            }
        }

        return map;
    }

    // The identifiers tracked under a source, whether stored against its label or
    // its key (queue-users accepts either). A '*' in the set is a catch-all
    // account that already ingests the whole feed, so every author counts as
    // covered — flag them tracked rather than offering a redundant add.
    trackedForSource ( source, byService ) {
        const ids = new Set( [
            ...( byService.get( source.label ) || [] ),
            ...( byService.get( source.key ) || [] ),
        ] );

        return {
            catchAll: ids.has( '*' ),
            ids: ids,
        };
    }

    // Scan one RSS source's feed. Resolves to its developers tagged with the
    // source, or rejects so handleOpen can report the failure.
    async scanSource ( source ) {
        const response = await fetch( `/api/rss-devs?endpoint=${ encodeURIComponent( source.endpoint ) }` );

        if ( !response.ok ) {
            throw new Error( 'request failed' );
        }

        const body = await response.json();

        if ( body.error ) {
            throw new Error( body.error );
        }

        return ( body.developers || [] ).map( ( developer ) => {
            return {
                ...developer,
                sourceKey: source.key,
                sourceLabel: source.label,
            };
        } );
    }

    handleOpen ( event ) {
        const sources = rssSources( this.props.game );

        this.setState( {
            anchorEl: event.currentTarget,
            busy: true,
            developers: [],
            message: '',
        } );

        Promise.all( sources.map( ( source ) => {
            return this.scanSource( source );
        } ) )
            .then( ( perSource ) => {
                const developers = perSource.flat();

                this.setState( {
                    busy: false,
                    developers: developers,
                    message: developers.length
                        ? ''
                        : 'No <dc:creator> authors found in the feed — it may be a single anonymous feed (add a catch-all "*" account instead).',
                } );
            } )
            .catch( () => {
                this.setState( {
                    busy: false,
                    message: 'RSS developer lookup failed — the feed may be unreachable.',
                } );
            } );
    }

    handleClose () {
        this.setState( {
            anchorEl: null,
        } );
    }

    // The discovered authors as a flat list of [sourceLabel, developers] groups,
    // source order preserved from the scan.
    groups () {
        const order = [];
        const byLabel = new Map();

        for ( const developer of this.state.developers ) {
            if ( !byLabel.has( developer.sourceLabel ) ) {
                byLabel.set( developer.sourceLabel, [] );
                order.push( developer.sourceLabel );
            }

            byLabel.get( developer.sourceLabel ).push( developer );
        }

        return order.map( ( label ) => {
            return [ label, byLabel.get( label ) ];
        } );
    }

    renderDeveloper ( developer, tracked ) {
        const isTracked = tracked.catchAll
            || tracked.ids.has( developer.identifier.toLowerCase() );

        return (
            <ListItem
                divider
                key = { `${ developer.sourceKey }:${ developer.identifier }` }
                secondaryAction = {
                    isTracked
                        ? <Chip
                            color = { 'success' }
                            label = { 'Tracked' }
                            size = { 'small' }
                            variant = { 'outlined' }
                        />
                        : <Button
                            onClick = { () => {
                                this.props.onPickDeveloper( {
                                    game: this.props.game.identifier,
                                    identifier: developer.identifier,
                                    name: developer.name || developer.identifier,
                                    service: developer.sourceLabel,
                                } );
                                this.handleClose();
                            } }
                            size = { 'small' }
                            variant = { 'outlined' }
                        >
                            { 'Add' }
                        </Button>
                }
            >
                <ListItemText
                    primary = { developer.name || developer.identifier }
                    secondary = {
                        developer.profile
                            ? <Link
                                href = { developer.profile }
                                rel = { 'noreferrer' }
                                target = { '_blank' }
                            >
                                { 'Latest post' }
                            </Link>
                            : null
                    }
                />
            </ListItem>
        );
    }

    renderList () {
        if ( this.state.busy ) {
            return (
                <Box
                    sx = { {
                        alignItems: 'center',
                        display: 'flex',
                        gap: 1,
                        p: 2,
                    } }
                >
                    <CircularProgress size = { 18 } />
                    <Typography variant = { 'body2' }>
                        { 'Reading the feed…' }
                    </Typography>
                </Box>
            );
        }

        if ( this.state.message ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        display: 'block',
                        p: 2,
                    } }
                    variant = { 'body2' }
                >
                    { this.state.message }
                </Typography>
            );
        }

        const byService = this.trackedByService();
        const trackedBySource = {};

        for ( const source of rssSources( this.props.game ) ) {
            trackedBySource[ source.label ] = this.trackedForSource( source, byService );
        }

        return (
            <React.Fragment>
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        display: 'block',
                        px: 2,
                        py: 1,
                    } }
                    variant = { 'caption' }
                >
                    { 'Authors of the feed (by <dc:creator>). Adding one attaches it to this source, so grunt attributes that author\'s posts to it.' }
                </Typography>
                <List
                    dense
                    disablePadding
                >
                    { this.groups().map( ( [ label, developers ] ) => {
                        return (
                            <li key = { label }>
                                <ul style = { { padding: 0 } }>
                                    <ListSubheader>
                                        { label }
                                    </ListSubheader>
                                    { developers.map( ( developer ) => {
                                        return this.renderDeveloper( developer, trackedBySource[ label ] );
                                    } ) }
                                </ul>
                            </li>
                        );
                    } ) }
                </List>
            </React.Fragment>
        );
    }

    render () {
        if ( !rssSources( this.props.game ).length ) {
            return null;
        }

        return (
            <React.Fragment>
                <Button
                    onClick = { this.handleOpen }
                    startIcon = { <PersonSearchIcon /> }
                    variant = { 'outlined' }
                >
                    { 'Find developers on RSS' }
                </Button>
                <Popover
                    anchorEl = { this.state.anchorEl }
                    anchorOrigin = { {
                        horizontal: 'left',
                        vertical: 'bottom',
                    } }
                    onClose = { this.handleClose }
                    open = { Boolean( this.state.anchorEl ) }
                    slotProps = { {
                        paper: {
                            sx: {
                                maxHeight: 360,
                                mt: 1,
                                width: 360,
                            },
                        },
                    } }
                >
                    { this.renderList() }
                </Popover>
            </React.Fragment>
        );
    }
}

RssDeveloperFinder.displayName = 'RssDeveloperFinder';

RssDeveloperFinder.defaultProps = {
    developers: [],
};

RssDeveloperFinder.propTypes = {
    developers: PropTypes.arrayOf( PropTypes.shape( {
        accounts: PropTypes.array,
    } ) ),
    game: PropTypes.shape( {
        config: PropTypes.object,
        identifier: PropTypes.string,
    } ).isRequired,
    onPickDeveloper: PropTypes.func.isRequired,
};

export default RssDeveloperFinder;
