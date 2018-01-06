import React from 'react';

import ContentAdd from 'material-ui/svg-icons/content/add';
import Dialog from 'material-ui/Dialog';
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import MenuItem from 'material-ui/MenuItem';
import TextField from 'material-ui/TextField';

import api from './api.js';

class AddGame extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleShowCreate = this.handleShowCreate.bind( this );
        this.handleInputChange = this.handleInputChange.bind( this );
        this.handleSaveGame = this.handleSaveGame.bind( this );

        this.state = {
            hostname: false,
            identifier: false,
            name: false,
            shortName: false,
            showCreate: false,
        };
    }

    handleSaveGame () {
        const newGame = {
            hostname: this.state.hostname,
            identifier: this.state.identifier,
            name: this.state.name,
            shortName: this.state.shortName || this.state.name,
        };

        api.post( '/games', newGame )
            .then( () => {
                this.setState( {
                    hostname: false,
                    identifier: false,
                    name: false,
                    shortName: false,
                    showCreate: false,
                } );

                window.snackbarText = 'Game added';
                window.dispatchEvent( new Event( 'open-snackbar' ) );
                window.dispatchEvent( new Event( 'games-update' ) );
            } )
            .catch( ( saveError ) => {
                window.snackbarText = saveError.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
            } );
    }

    handleInputChange ( event ) {
        const newState = {};

        newState[ event.target.name ] = event.target.value;

        this.setState( newState );
    }

    handleShowCreate () {
        this.setState( {
            showCreate: !this.state.showCreate,
        } );
    }

    render () {
        const actions = [
            <FlatButton
                key = { 'cancel-button' }
                label = { 'Cancel' }
                onTouchTap = { this.handleShowCreate }
                secondary
            />,
            <FlatButton
                default
                key = { 'confirm-button' }
                keyboardFocused
                label = { 'Submit' }
                onTouchTap = { this.handleSaveGame }
            />,
        ];

        return (
            <MenuItem
                key = { 'add-game' }
                onTouchTap = { this.handleShowCreate }
                primaryText = { 'Add game' }
                rightIcon = { <ContentAdd /> }
            >
                <Dialog
                    actions = { actions }
                    autoScrollBodyContent
                    modal = { false }
                    onRequestClose = { this.handleClose }
                    open = { this.state.showCreate }
                    title = { 'Create game' }
                >
                    <TextField
                        floatingLabelText = { 'Name' }
                        fullWidth
                        hintText = { 'Name' }
                        name = { 'name' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        floatingLabelText = { 'Short name' }
                        fullWidth
                        hintText = { 'Short name' }
                        name = { 'shortName' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        floatingLabelText = { 'Identifier' }
                        fullWidth
                        hintText = { 'Identifier' }
                        name = { 'identifier' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        floatingLabelText = { 'Hostname' }
                        fullWidth
                        hintText = { 'Hostname' }
                        name = { 'hostname' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                </Dialog>
            </MenuItem>
        );
    }
}

AddGame.displayName = 'AddGame';

export default AddGame;
