import React from 'react';
import deepEqual from 'deep-equal';
import cookie from 'react-cookies';
import alphanumSort from 'alphanum-sort';

import Divider from 'material-ui/Divider';
import Drawer from 'material-ui/Drawer';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import MenuItem from 'material-ui/MenuItem';
import NavigationMenu from 'material-ui/svg-icons/navigation/menu';
import Paper from 'material-ui/Paper';
import Snackbar from 'material-ui/Snackbar';

import Developer from './Developer.jsx';
import GameInfo from './GameInfo.jsx';
import AddDeveloper from './AddDeveloper.jsx';
import AddGame from './AddGame.jsx';
import api from './api.js';

const INIT_LOAD_WAIT_TIMEOUT = 100;

const styles = {
    activeMenuItem: {
        color: 'red',
    },
    gameImage: {
        height: '100px',
    },
    gameImageWrapper: {
        left: 0,
        position: 'absolute',
        top: '50%',
        transform: 'translateY( -50% )',
    },
    gameTitle: {
        fontSize: '4vw',
        margin: '1em 40px',
        position: 'relative',
        textAlign: 'center',
    },
    toggleMenuButton: {
        bottom: 20,
        position: 'fixed',
        right: 20,
        zIndex: 1,
    },
    wrapper: {
        alignItems: 'center',
        boxSizing: 'border-box',
        display: 'flex',
        flexWrap: 'wrap',
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
        this.handleToggleMenu = this.handleToggleMenu.bind( this );
        this.getCurrentGame = this.getCurrentGame.bind( this );
        this.handleSelectGame = this.handleSelectGame.bind( this );
        this.handleSnackbarClose = this.handleSnackbarClose.bind( this );
        this.openSnackbar = this.openSnackbar.bind( this );

        this.state = {
            developers: {},
            gameId: false,
            games: [],
            showCreate: false,
            showMenu: false,
            snackbarOpen: false,
            snackbarText: '',
        };
    }

    componentWillMount () {
        this.getGamesData();
    }

    componentDidMount () {
        window.addEventListener( 'data-update', this.getGameData );
        window.addEventListener( 'games-update', this.getGamesData );
        window.addEventListener( 'open-snackbar', this.openSnackbar );
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

    handleToggleMenu ( event ) {
        event.preventDefault();

        this.setState( {
            showMenu: !this.state.showMenu,
        } );
    }

    handleSelectGame ( event ) {
        const newGame = this.getAttributeRecursive( 'data-value', event.target );

        if ( newGame ) {
            this.selectGame( newGame );
        }
    }

    openSnackbar () {
        this.setState( {
            snackbarOpen: true,
            snackbarText: window.snackbarText,
        } );
    }

    getAttributeRecursive ( attribute, element ) {
        const value = element.getAttribute( attribute );

        if ( value === null && element.parentElement ) {
            return this.getAttributeRecursive( attribute, element.parentElement );
        }

        return value;
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
                // eslint-disable-next-line no-console
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

                if ( cookie.load( 'gameId' ) ) {
                    for ( let i = 0; i < games.data.length; i = i + 1 ) {
                        if ( games.data[ i ].identifier === cookie.load( 'gameId' ) ) {
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
                // eslint-disable-next-line no-console
                console.error( error );
            } );

        return true;
    }

    getGames () {
        const gameNodes = this.state.games.map( ( game ) => {
            let itemStyles = {};

            if ( game.identifier === this.state.gameId ) {
                itemStyles = styles.activeMenuItem;
            }

            return (
                <MenuItem
                    data-value = { game.identifier }
                    key = { game.identifier }
                    onTouchTap = { this.handleSelectGame }
                    primaryText = { game.name }
                    style = { itemStyles }
                />
            );
        } );

        gameNodes.push( <Divider /> );
        gameNodes.push( <AddGame /> );

        return gameNodes;
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
            showMenu: false,
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
            addNode = (
                <AddDeveloper
                    gameId = { this.state.gameId }
                    gameNumber = { this.state.gameNumber }
                />
            );
        }

        return (
            <div>
                <Drawer
                    open = { this.state.showMenu }
                    style = { styles.list }
                    value = { this.state.gameId }
                    width = { 350 }
                >
                    { this.getGames() }
                </Drawer>
                <h1
                    style = { styles.gameTitle }
                >
                    { this.getCurrentGame().name }
                    { this.state.gameId && this.getCurrentGame().config && this.getCurrentGame().config.boxart &&
                        <Paper
                            rounded = { false }
                            style = { styles.gameImageWrapper }
                            zDepth = { 1 }
                        >
                            <img
                                src = { this.getCurrentGame().config.boxart }
                                style = { styles.gameImage }
                            />
                        </Paper>
                    }
                </h1>
                { this.state.gameId &&
                    <GameInfo
                        { ...this.getCurrentGame() }
                    />
                }
                <div
                    style = { styles.wrapper }
                >
                    { addNode }
                    { this.getDevelopers() }
                    <FloatingActionButton
                        onTouchTap = { this.handleToggleMenu }
                        style = { styles.toggleMenuButton }
                    >
                        <NavigationMenu />
                    </FloatingActionButton>
                </div>
                <Snackbar
                    autoHideDuration = { 4000 }
                    message = { this.state.snackbarText }
                    onRequestClose = { this.handleSnackbarClose }
                    open = { this.state.snackbarOpen }
                />
            </div>
        );
    }
}

Games.displayName = 'Games';

export default Games;
