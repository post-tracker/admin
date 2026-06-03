import React from 'react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
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
        return (
            <React.Fragment>
                <MenuItem
                    key = { 'add-game' }
                    onClick = { this.handleShowCreate }
                >
                    <ListItemText>
                        { 'Add game' }
                    </ListItemText>
                    <AddIcon />
                </MenuItem>
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
                        <Divider />
                        <TextField
                            fullWidth
                            label = { 'Hostname' }
                            name = { 'hostname' }
                            onKeyUp = { this.handleInputChange }
                            placeholder = { 'Hostname' }
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
