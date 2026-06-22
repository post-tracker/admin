import React from 'react';
import PropTypes from 'prop-types';
import deepEqual from 'deep-equal';
import cookie from 'react-cookies';
import alphanumSort from 'alphanum-sort';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';

import Developer from './Developer.jsx';
import GameInfo from './GameInfo.jsx';
import AddDeveloper from './AddDeveloper.jsx';
import AddGame from './AddGame.jsx';
import Header from './Header.jsx';
import api from './api.js';

const INIT_LOAD_WAIT_TIMEOUT = 100;

const styles = {
    developersTitle: {
        fontSize: '1.25rem',
        fontWeight: 500,
        margin: 0,
    },
    wrapper: {
        // Top-align so expanding one card to its full editor height doesn't
        // stretch the collapsed cards sharing its row.
        alignItems: 'start',
        boxSizing: 'border-box',
        display: 'grid',
        gap: {
            sm: 2.5,
            xs: 2,
        },
        // Equal columns that share the row, so cards are all the same width and
        // the grid fills edge to edge. min(100%, 300px) keeps the track from
        // exceeding the viewport on phones narrower than 300px (no h-scroll).
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
        // Side padding matches the game settings box above on desktop; tighter
        // on mobile so cards use the full screen width.
        padding: {
            sm: '20px 40px',
            xs: '16px',
        },
        width: '100%',
    },
};

class Games extends React.Component {
    constructor ( props ) {
        super( props );

        this.selectGame = this.selectGame.bind( this );
        this.getGameData = this.getGameData.bind( this );
        this.getGamesData = this.getGamesData.bind( this );
        this.getCurrentGame = this.getCurrentGame.bind( this );
        this.handleGamePick = this.handleGamePick.bind( this );
        this.handleFilterChange = this.handleFilterChange.bind( this );
        this.handleSnackbarClose = this.handleSnackbarClose.bind( this );
        this.openSnackbar = this.openSnackbar.bind( this );

        this.handleAddDevSaved = this.handleAddDevSaved.bind( this );

        this.state = {
            developers: {},
            filter: '',
            gameId: false,
            games: [],
            prefill: this.readPrefillFromUrl(),
            showCreate: false,
            snackbarOpen: false,
            snackbarText: '',
        };
    }

    readPrefillFromUrl () {
        if ( typeof window === 'undefined' || !window.location ) {
            return false;
        }

        const params = new URLSearchParams( window.location.search );

        if ( params.get( 'action' ) !== 'add-dev' ) {
            return false;
        }

        const game = params.get( 'game' );
        const service = params.get( 'service' );
        const identifier = params.get( 'identifier' );

        if ( !game || !service || !identifier ) {
            return false;
        }

        return {
            game: game,
            group: params.get( 'group' ) || false,
            identifier: identifier,
            name: params.get( 'name' ) || identifier,
            service: service,
        };
    }

    handleAddDevSaved () {
        this.setState( {
            prefill: false,
        } );

        if ( window.history && window.history.replaceState ) {
            window.history.replaceState( {}, document.title, window.location.pathname );
        }
    }

    componentDidMount () {
        window.addEventListener( 'data-update', this.getGameData );
        window.addEventListener( 'games-update', this.getGamesData );
        window.addEventListener( 'open-snackbar', this.openSnackbar );

        this.getGamesData();
    }

    componentDidUpdate ( prevProps ) {
        // The selected game lives in the path ('/games/:gameId'). When it changes
        // — via the switcher (which navigates), or browser back/forward — load the
        // newly-targeted game, provided it's one we know about.
        const nextGameId = this.props.routeGameId;

        if (
            nextGameId &&
            nextGameId !== prevProps.routeGameId &&
            nextGameId !== this.state.gameId &&
            this.state.games.some( ( game ) => {
                return game.identifier === nextGameId;
            } )
        ) {
            this.selectGame( nextGameId );
        }
    }

    shouldComponentUpdate ( nextProps, nextState ) {
        if ( !deepEqual( this.props, nextProps ) ) {
            return true;
        }

        if ( !deepEqual( this.state, nextState ) ) {
            return true;
        }

        return false;
    }

    componentWillUnmount () {
        window.removeEventListener( 'data-update', this.getGameData );
        window.removeEventListener( 'games-update', this.getGamesData );
        window.removeEventListener( 'open-snackbar', this.openSnackbar );
    }

    handleSnackbarClose () {
        this.setState( {
            snackbarOpen: false,
        } );
    }

    handleGamePick ( event, game ) {
        if ( !game || !game.identifier ) {
            return;
        }

        // Drive selection through the URL so the choice is deep-linkable and
        // back/forward works; the routeGameId prop change then loads the game
        // (see componentDidUpdate). Fall back to a direct select if rendered
        // without the router wrapper.
        if ( this.props.onSelectGame ) {
            this.props.onSelectGame( game.identifier );
        } else {
            this.selectGame( game.identifier );
        }
    }

    handleFilterChange ( event ) {
        this.setState( {
            filter: event.target.value,
        } );
    }

    openSnackbar () {
        this.setState( {
            snackbarOpen: true,
            snackbarText: window.snackbarText,
        } );
    }

    getCurrentGame () {
        for ( let i = 0; i < this.state.games.length; i = i + 1 ) {
            if ( this.state.games[ i ].identifier === this.state.gameId ) {
                return this.state.games[ i ];
            }
        }

        return false;
    }

    getGameData ( overrideId ) {
        let useId = overrideId || this.state.gameId;

        if ( typeof useId === 'object' ) {
            useId = this.state.gameId;
        }

        api.get( `/${ useId }/developers` )
            .then( ( developers ) => {
                const services = [];
                const groups = [];

                for ( let i = 0; i < developers.data.length; i = i + 1 ) {
                    for ( let accountIndex = 0; accountIndex < developers.data[ i ].accounts.length; accountIndex = accountIndex + 1 ) {
                        services.push( developers.data[ i ].accounts[ accountIndex ].service );
                    }

                    if ( developers.data[ i ].group ) {
                        groups.push( developers.data[ i ].group );
                    }
                }

                developers.data.sort( ( a, b ) => {
                    if ( a.nick && b.nick ) {
                        return a.nick.localeCompare( b.nick );
                    }

                    return 1;
                } );

                this.setState( {
                    developers: developers.data,
                    groups: alphanumSort( [ ...new Set( groups ) ], {
                        insensitive: true,
                    } ),
                    services: alphanumSort( [ ...new Set( services ) ], {
                        insensitive: true,
                    } ),
                } );
            } )
            .catch( ( error ) => {
                console.error( error );
            } );
    }

    getGamesData () {
        if ( !window.apiToken ) {
            setTimeout( this.getGamesData.bind( this ), INIT_LOAD_WAIT_TIMEOUT );

            return false;
        }

        api.get( '/games' )
            .then( ( games ) => {
                let currentGame = games.data[ 0 ];
                // The URL param wins (deep link to /games/:gameId), then the
                // add-dev prefill target, then the last-used cookie.
                const preferredGameId = this.props.routeGameId ||
                    ( this.state.prefill && this.state.prefill.game ) ||
                    cookie.load( 'gameId' );

                if ( preferredGameId ) {
                    for ( let i = 0; i < games.data.length; i = i + 1 ) {
                        if ( games.data[ i ].identifier === preferredGameId ) {
                            currentGame = games.data[ i ];

                            break;
                        }
                    }
                }

                games.data.sort( ( a, b ) => {
                    return a.identifier.localeCompare( b.identifier );
                } );

                this.setState( {
                    gameId: currentGame.identifier,
                    gameNumber: currentGame.id,
                    games: games.data,
                } );

                this.getGameData( currentGame.identifier );
            } )
            .catch( ( error ) => {
                console.error( error );
            } );

        return true;
    }

    // Case-insensitive substring match across the fields shown on a card.
    matchesFilter ( developer, needle ) {
        return [ developer.nick, developer.name, developer.group ].some( ( field ) => {
            return field && String( field ).toLowerCase().includes( needle );
        } );
    }

    getDevelopers () {
        // developers starts as {} and becomes an array once loaded.
        const developers = Array.isArray( this.state.developers ) ? this.state.developers : [];
        const needle = this.state.filter.trim().toLowerCase();

        return developers
            .filter( ( developer ) => {
                return needle === '' || this.matchesFilter( developer, needle );
            } )
            .map( ( developer ) => {
                // Cards render as cheap read-only summaries until clicked, so the
                // whole roster (Star Citizen ~200, CS:GO ~240) mounts and scrolls
                // cheaply; only the expanded card mounts the heavy MUI editor.
                return (
                    <Developer
                        { ...developer }
                        availableDevelopers = { developers }
                        availableGroups = { this.state.groups }
                        availableServices = { this.state.services }
                        gameId = { this.state.gameId }
                        key = { developer.id }
                    />
                );
            } );
    }

    selectGame ( identifier ) {
        const newState = {
            developers: {},
            filter: '',
            gameId: identifier,
        };

        for ( let i = 0; i < this.state.games.length; i = i + 1 ) {
            if ( this.state.games[ i ].identifier === identifier ) {
                newState.gameNumber = this.state.games[ i ].id;

                break;
            }
        }

        cookie.save( 'gameId', identifier, {
            path: '/',
        } );

        this.setState( newState );

        this.getGameData( identifier );
    }

    render () {
        let addNode = false;

        if ( this.state.gameId && this.state.gameNumber ) {
            const prefillActive = Boolean(
                this.state.prefill && this.state.prefill.game === this.state.gameId
            );

            const developerList = Array.isArray( this.state.developers ) ? this.state.developers : [];

            addNode = (
                <AddDeveloper
                    availableDevelopers = { developerList }
                    availableGroups = { this.state.groups }
                    gameId = { this.state.gameId }
                    gameNumber = { this.state.gameNumber }
                    onSaved = { prefillActive ? this.handleAddDevSaved : false }
                    openOnMount = { prefillActive }
                    prefillGroup = { prefillActive ? this.state.prefill.group : false }
                    prefillIdentifier = { prefillActive ? this.state.prefill.identifier : false }
                    prefillName = { prefillActive ? this.state.prefill.name : false }
                    prefillService = { prefillActive ? this.state.prefill.service : false }
                />
            );
        }

        const currentGame = this.getCurrentGame() || null;

        return (
            <div>
                <Header
                    actions = {
                        <React.Fragment>
                            <Autocomplete
                                disableClearable
                                getOptionLabel = { ( game ) => {
                                    return game.name || '';
                                } }
                                isOptionEqualToValue = { ( option, value ) => {
                                    return option.identifier === value.identifier;
                                } }
                                onChange = { this.handleGamePick }
                                options = { this.state.games }
                                renderInput = { ( params ) => {
                                    return (
                                        <TextField
                                            { ...params }
                                            label = { 'Switch game' }
                                            size = { 'small' }
                                            variant = { 'outlined' }
                                        />
                                    );
                                } }
                                sx = { {
                                    // Grow to fill the mobile actions row beside
                                    // the Add-game button; fixed width on desktop.
                                    flexGrow: {
                                        sm: 0,
                                        xs: 1,
                                    },
                                    minWidth: 0,
                                    width: {
                                        sm: 260,
                                    },
                                } }
                                value = { currentGame }
                            />
                            <AddGame />
                        </React.Fragment>
                    }
                    onNavigate = { this.props.onNavigate }
                    view = { 'games' }
                />
                { currentGame &&
                    <GameInfo
                        { ...currentGame }
                        key = { currentGame.identifier }
                    />
                }
                { currentGame &&
                    <Box
                        sx = { {
                            alignItems: 'center',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            justifyContent: 'space-between',
                            // Tighter side margins on mobile so the filter and
                            // Add-developer button aren't cramped into the middle.
                            m: {
                                sm: '24px 40px 0',
                                xs: '16px 16px 0',
                            },
                        } }
                    >
                        <Box
                            sx = { {
                                alignItems: 'center',
                                display: 'flex',
                                flex: 1,
                                gap: 2,
                                minWidth: 0,
                            } }
                        >
                            <h2
                                style = { styles.developersTitle }
                            >
                                { 'Developers' }
                            </h2>
                            <TextField
                                label = { 'Filter developers' }
                                onChange = { this.handleFilterChange }
                                placeholder = { 'nick, name or group' }
                                size = { 'small' }
                                sx = { {
                                    // Grow to fill on mobile, capped on desktop.
                                    flexGrow: 1,
                                    maxWidth: 260,
                                    minWidth: 0,
                                } }
                                value = { this.state.filter }
                                variant = { 'outlined' }
                            />
                        </Box>
                        { addNode }
                    </Box>
                }
                <Box
                    sx = { styles.wrapper }
                >
                    { this.getDevelopers() }
                </Box>
                <Snackbar
                    autoHideDuration = { 4000 }
                    message = { this.state.snackbarText }
                    onClose = { this.handleSnackbarClose }
                    open = { this.state.snackbarOpen }
                />
            </div>
        );
    }
}

Games.displayName = 'Games';

Games.propTypes = {
    onNavigate: PropTypes.func.isRequired,
    onSelectGame: PropTypes.func,
    routeGameId: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
};

export default Games;
