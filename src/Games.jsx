import React from 'react';
import deepEqual from 'deep-equal';
import cookie from 'react-cookies';
import alphanumSort from 'alphanum-sort';

import AppBar from '@mui/material/AppBar';
import Autocomplete from '@mui/material/Autocomplete';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import Developer from './Developer.jsx';
import GameInfo from './GameInfo.jsx';
import AddDeveloper from './AddDeveloper.jsx';
import AddGame from './AddGame.jsx';
import api from './api.js';

const INIT_LOAD_WAIT_TIMEOUT = 100;

const styles = {
    developersHeader: {
        alignItems: 'center',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'space-between',
        margin: '24px 40px 0',
    },
    developersTitle: {
        fontSize: '1.25rem',
        fontWeight: 500,
        margin: 0,
    },
    wrapper: {
        alignItems: 'flex-start',
        boxSizing: 'border-box',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 20,
        justifyContent: 'center',
        padding: 20,
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
        this.handleSnackbarClose = this.handleSnackbarClose.bind( this );
        this.openSnackbar = this.openSnackbar.bind( this );

        this.handleAddDevSaved = this.handleAddDevSaved.bind( this );

        this.state = {
            developers: {},
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
        if ( game && game.identifier ) {
            this.selectGame( game.identifier );
        }
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
                const preferredGameId = ( this.state.prefill && this.state.prefill.game ) || cookie.load( 'gameId' );

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

    getDevelopers () {
        const developerNodes = [];

        for ( const developerId in this.state.developers ) {
            if ( !Reflect.apply( {}.hasOwnProperty, this.state.developers, [ developerId ] ) ) {
                continue;
            }

            developerNodes.push(
                <Developer
                    { ...this.state.developers[ developerId ] }
                    availableGroups = { this.state.groups }
                    availableServices = { this.state.services }
                    gameId = { this.state.gameId }
                    key = { developerId }
                />
            );
        }

        return developerNodes;
    }

    selectGame ( identifier ) {
        const newState = {
            developers: {},
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
                    gameId = { this.state.gameId }
                    gameNumber = { this.state.gameNumber }
                    onSaved = { prefillActive ? this.handleAddDevSaved : false }
                    openOnMount = { prefillActive }
                    prefillIdentifier = { prefillActive ? this.state.prefill.identifier : false }
                    prefillName = { prefillActive ? this.state.prefill.name : false }
                    prefillService = { prefillActive ? this.state.prefill.service : false }
                />
            );
        }

        const currentGame = this.getCurrentGame() || null;

        return (
            <div>
                <AppBar
                    color = { 'default' }
                    position = { 'static' }
                >
                    <Toolbar>
                        <Typography
                            component = { 'div' }
                            noWrap
                            sx = { {
                                flexShrink: 0,
                                mr: 2,
                            } }
                            variant = { 'h6' }
                        >
                            { currentGame ? currentGame.name : 'Admin' }
                        </Typography>
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
                                flexGrow: 1,
                                maxWidth: 400,
                                minWidth: 0,
                                mr: 2,
                            } }
                            value = { currentGame }
                        />
                        <AddGame />
                    </Toolbar>
                </AppBar>
                { currentGame &&
                    <GameInfo
                        { ...currentGame }
                        key = { currentGame.identifier }
                    />
                }
                { currentGame &&
                    <div
                        style = { styles.developersHeader }
                    >
                        <h2
                            style = { styles.developersTitle }
                        >
                            { 'Developers' }
                        </h2>
                        { addNode }
                    </div>
                }
                <div
                    style = { styles.wrapper }
                >
                    { this.getDevelopers() }
                </div>
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

export default Games;
