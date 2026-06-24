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

// Default flair field, matching RedditFlairEditor's DEFAULT_TYPE and reddit.js
// DEFAULT_FLAIR_TYPE so the finder, the flair editor, and the scan all agree on
// which flair a subreddit with no stored config is keyed on.
const DEFAULT_FLAIR_TYPE = 'author_flair_css_class';

// Read the game's Reddit source config: the source whose type/name is Reddit,
// returning its subreddits (allowedSections) and per-subreddit flair config, or
// false when there's no Reddit source or it has no subreddits to scan.
const redditSource = function redditSource ( game ) {
    const sources = ( game && game.config && game.config.sources ) || {};

    for ( const [ name, config ] of Object.entries( sources ) ) {
        if ( config && ( ( config.type || name ) === 'Reddit' ) ) {
            const subreddits = Array.isArray( config.allowedSections )
                ? config.allowedSections.filter( Boolean )
                : [];

            if ( !subreddits.length ) {
                return false;
            }

            return {
                flair: config.flair || {},
                subreddits: subreddits,
            };
        }
    }

    return false;
};

// "Find developers on Reddit" — unlike Steam's authoritative Developer badge,
// Reddit's only dev signal is subreddit flair, so this scans the game's
// subreddit(s) via /api/reddit-devs (server.js / vite dev mirror -> reddit.js),
// applying the game's flair config (type + blocklist) to surface the users the
// finder would treat as devs. Candidates are grouped by flair so the admin can
// eyeball which flair the devs actually wear (for a freshly-added game with an
// empty blocklist, every flaired user shows up). Each not-yet-tracked candidate
// has an Add button that hands a prefill up to Games, opening the existing
// AddDeveloper dialog ready to save (service Reddit, identifier = username, nick
// = username). Renders nothing when the game has no Reddit source.
class RedditDeveloperFinder extends React.Component {
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

    // Reddit account identifiers already in the roster, lowercased so a
    // discovered candidate already tracked (even under a different case) is
    // flagged rather than offered again. Reddit identifiers are the bare
    // username.
    trackedUsernames () {
        const tracked = new Set();

        for ( const developer of this.props.developers ) {
            for ( const account of developer.accounts || [] ) {
                if ( account.service === 'Reddit' && account.identifier ) {
                    tracked.add( String( account.identifier ).trim().toLowerCase() );
                }
            }
        }

        return tracked;
    }

    // Scan one subreddit, passing its stored flair config (type + blocklist) so
    // the server applies the same dev rule the finder does. Resolves to the
    // developers array, or rejects so handleOpen can report the failure.
    async scanSubreddit ( subreddit, flair ) {
        const config = flair[ subreddit ] || {};
        const params = new URLSearchParams( {
            blocklist: ( Array.isArray( config.blocklist ) ? config.blocklist : [] ).join( ',' ),
            subreddit: subreddit,
            type: config.type || DEFAULT_FLAIR_TYPE,
        } );

        const response = await fetch( `/api/reddit-devs?${ params.toString() }` );

        if ( !response.ok ) {
            throw new Error( 'request failed' );
        }

        const body = await response.json();

        if ( body.error ) {
            throw new Error( body.error );
        }

        return body.developers || [];
    }

    handleOpen ( event ) {
        const source = redditSource( this.props.game );

        this.setState( {
            anchorEl: event.currentTarget,
            busy: true,
            developers: [],
            message: '',
        } );

        Promise.all( source.subreddits.map( ( subreddit ) => {
            return this.scanSubreddit( subreddit, source.flair );
        } ) )
            .then( ( perSubreddit ) => {
                // Merge across subreddits, deduping by username and keeping the
                // first flair seen for each.
                const byUsername = new Map();

                for ( const developer of perSubreddit.flat() ) {
                    if ( !byUsername.has( developer.username ) ) {
                        byUsername.set( developer.username, developer );
                    }
                }

                const developers = [ ...byUsername.values() ];

                this.setState( {
                    busy: false,
                    developers: developers,
                    message: developers.length
                        ? ''
                        : 'No flaired users found in the recent posts and comments sampled.',
                } );
            } )
            .catch( () => {
                this.setState( {
                    busy: false,
                    message: 'Reddit developer lookup failed — Reddit may be rate-limiting. Try again shortly.',
                } );
            } );
    }

    handleClose () {
        this.setState( {
            anchorEl: null,
        } );
    }

    // The discovered candidates as a flat list of [flair, developers] groups,
    // flair order preserved from the (already flair-sorted) server response.
    groups () {
        const order = [];
        const byFlair = new Map();

        for ( const developer of this.state.developers ) {
            if ( !byFlair.has( developer.flair ) ) {
                byFlair.set( developer.flair, [] );
                order.push( developer.flair );
            }

            byFlair.get( developer.flair ).push( developer );
        }

        return order.map( ( flair ) => {
            return [ flair, byFlair.get( flair ) ];
        } );
    }

    renderDeveloper ( developer, tracked ) {
        const isTracked = tracked.has( developer.username.toLowerCase() );

        return (
            <ListItem
                divider
                key = { developer.username }
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
                                    identifier: developer.username,
                                    name: developer.username,
                                    service: 'Reddit',
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
                    primary = { developer.username }
                    secondary = {
                        <Link
                            href = { developer.profile }
                            rel = { 'noreferrer' }
                            target = { '_blank' }
                        >
                            { 'Reddit profile' }
                        </Link>
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
                        { 'Scanning the subreddit…' }
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

        const tracked = this.trackedUsernames();

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
                    { 'Grouped by flair — Reddit\'s only dev signal. Add the users wearing your developers\' flair; curate the rest in the Flair editor.' }
                </Typography>
                <List
                    dense
                    disablePadding
                >
                    { this.groups().map( ( [ flair, developers ] ) => {
                        return (
                            <li key = { flair }>
                                <ul style = { { padding: 0 } }>
                                    <ListSubheader>
                                        { flair }
                                    </ListSubheader>
                                    { developers.map( ( developer ) => {
                                        return this.renderDeveloper( developer, tracked );
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
        if ( !redditSource( this.props.game ) ) {
            return null;
        }

        return (
            <React.Fragment>
                <Button
                    onClick = { this.handleOpen }
                    startIcon = { <PersonSearchIcon /> }
                    variant = { 'outlined' }
                >
                    { 'Find developers on Reddit' }
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

RedditDeveloperFinder.displayName = 'RedditDeveloperFinder';

RedditDeveloperFinder.defaultProps = {
    developers: [],
};

RedditDeveloperFinder.propTypes = {
    developers: PropTypes.arrayOf( PropTypes.shape( {
        accounts: PropTypes.array,
    } ) ),
    game: PropTypes.shape( {
        config: PropTypes.object,
        identifier: PropTypes.string,
    } ).isRequired,
    onPickDeveloper: PropTypes.func.isRequired,
};

export default RedditDeveloperFinder;
