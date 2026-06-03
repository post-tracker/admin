import React from 'react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';

import api from './api.js';

class AddGame extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleShowCreate = this.handleShowCreate.bind( this );
        this.handleInputChange = this.handleInputChange.bind( this );
        this.handleSaveGame = this.handleSaveGame.bind( this );

        this.state = {
            identifier: false,
            name: false,
            shortName: false,
            showCreate: false,
        };
    }

    handleSaveGame () {
        const newGame = {
            // Every game is served from the shared domain; no longer edited per game.
            hostname: 'developertracker.com',
            identifier: this.state.identifier,
            name: this.state.name,
            shortName: this.state.shortName || this.state.name,
        };

        api.post( '/games', newGame )
            .then( () => {
                this.setState( {
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
        return (
            <React.Fragment>
                <Button
                    color = { 'inherit' }
                    key = { 'add-game' }
                    onClick = { this.handleShowCreate }
                    startIcon = { <AddIcon /> }
                >
                    { 'Add game' }
                </Button>
                <Dialog
                    onClose = { this.handleShowCreate }
                    open = { this.state.showCreate }
                >
                    <DialogTitle>
                        { 'Create game' }
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            fullWidth
                            label = { 'Name' }
                            name = { 'name' }
                            onKeyUp = { this.handleInputChange }
                            placeholder = { 'Name' }
                            variant = { 'standard' }
                        />
                        <Divider />
                        <TextField
                            fullWidth
                            label = { 'Short name' }
                            name = { 'shortName' }
                            onKeyUp = { this.handleInputChange }
                            placeholder = { 'Short name' }
                            variant = { 'standard' }
                        />
                        <Divider />
                        <TextField
                            fullWidth
                            label = { 'Identifier' }
                            name = { 'identifier' }
                            onKeyUp = { this.handleInputChange }
                            placeholder = { 'Identifier' }
                            variant = { 'standard' }
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color = { 'secondary' }
                            key = { 'cancel-button' }
                            onClick = { this.handleShowCreate }
                        >
                            { 'Cancel' }
                        </Button>
                        <Button
                            autoFocus
                            key = { 'confirm-button' }
                            onClick = { this.handleSaveGame }
                        >
                            { 'Submit' }
                        </Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        );
    }
}

AddGame.displayName = 'AddGame';

export default AddGame;
