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
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';

// Read the game's Steam app id from its source config: the source whose
// type/name is Steam, preferring the explicit numeric `appId` over the
// announcements feed id (allowedSections[0], which IS numeric for non-vanity
// games). Returns false when the game has no Steam source.
const steamAppId = function steamAppId ( game ) {
    const sources = ( game && game.config && game.config.sources ) || {};

    for ( const [ name, config ] of Object.entries( sources ) ) {
        if ( config && ( ( config.type || name ) === 'Steam' ) ) {
            const id = config.appId
                || ( Array.isArray( config.allowedSections ) && config.allowedSections[ 0 ] );

            return id ? String( id ) : false;
        }
    }

    return false;
};

// "Find developers on Steam" — discovers a game's Steam Developer-badged forum
// authors via /api/steam-devs (server.js / vite dev mirror -> steam.js) and lists
// them in a popover. Each not-yet-tracked dev has an Add button that hands a
// prefill up to Games, which opens the existing AddDeveloper dialog ready to save
// (service Steam, identifier = SteamID64, nick = author). Renders nothing when the
// game has no Steam source.
class SteamDeveloperFinder extends React.Component {
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

    // SteamID64s already attached as Steam accounts, plus lowercased nicks/names,
    // so discovered devs that are already in the roster can be flagged rather than
    // re-added. Identifier matching is exact on the SteamID64; the name match is a
    // best-effort catch for devs stored under a vanity identifier instead.
    trackedSets () {
        const ids = new Set();
        const names = new Set();

        for ( const developer of this.props.developers ) {
            for ( const account of developer.accounts || [] ) {
                if ( account.service === 'Steam' && account.identifier ) {
                    ids.add( String( account.identifier ) );
                }
            }

            for ( const label of [ developer.nick, developer.name ] ) {
                if ( label ) {
                    names.add( String( label ).trim().toLowerCase() );
                }
            }
        }

        return {
            ids,
            names,
        };
    }

    handleOpen ( event ) {
        const appId = steamAppId( this.props.game );

        this.setState( {
            anchorEl: event.currentTarget,
            busy: true,
            developers: [],
            message: '',
        } );

        fetch( `/api/steam-devs?appId=${ encodeURIComponent( appId ) }` )
            .then( ( response ) => {
                if ( !response.ok ) {
                    return {
                        error: 'Steam developer lookup failed.',
                    };
                }

                return response.json();
            } )
            .then( ( body ) => {
                if ( body.error ) {
                    this.setState( {
                        busy: false,
                        message: body.error,
                    } );

                    return;
                }

                const developers = body.developers || [];

                this.setState( {
                    busy: false,
                    developers: developers,
                    message: developers.length
                        ? ''
                        : 'No Developer-badged forum posts found on page 1.',
                } );
            } )
            .catch( () => {
                this.setState( {
                    busy: false,
                    message: 'Steam developer lookup failed.',
                } );
            } );
    }

    handleClose () {
        this.setState( {
            anchorEl: null,
        } );
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
                        { 'Scanning the discussions forum…' }
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

        const tracked = this.trackedSets();

        return (
            <List
                dense
                disablePadding
            >
                { this.state.developers.map( ( developer ) => {
                    const isTracked = tracked.ids.has( developer.steamId64 )
                        || ( developer.name && tracked.names.has( developer.name.toLowerCase() ) );

                    return (
                        <ListItem
                            divider
                            key = { developer.steamId64 }
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
                                                identifier: developer.steamId64,
                                                name: developer.name || developer.steamId64,
                                                service: 'Steam',
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
                                primary = { developer.name || developer.steamId64 }
                                secondary = {
                                    <Link
                                        href = { developer.profile }
                                        rel = { 'noreferrer' }
                                        target = { '_blank' }
                                    >
                                        { 'Steam profile' }
                                    </Link>
                                }
                            />
                        </ListItem>
                    );
                } ) }
            </List>
        );
    }

    render () {
        if ( !steamAppId( this.props.game ) ) {
            return null;
        }

        return (
            <React.Fragment>
                <Button
                    onClick = { this.handleOpen }
                    startIcon = { <PersonSearchIcon /> }
                    variant = { 'outlined' }
                >
                    { 'Find developers on Steam' }
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

SteamDeveloperFinder.displayName = 'SteamDeveloperFinder';

SteamDeveloperFinder.defaultProps = {
    developers: [],
};

SteamDeveloperFinder.propTypes = {
    developers: PropTypes.arrayOf( PropTypes.shape( {
        accounts: PropTypes.array,
        name: PropTypes.string,
        nick: PropTypes.string,
    } ) ),
    game: PropTypes.shape( {
        config: PropTypes.object,
        identifier: PropTypes.string,
    } ).isRequired,
    onPickDeveloper: PropTypes.func.isRequired,
};

export default SteamDeveloperFinder;
