import React from 'react';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';

import BoxartPicker from './BoxartPicker.jsx';
import api from './api.js';

const EMPTY_GAME = {
    boxart: '',
    identifier: '',
    name: '',
    shortName: '',
};

class AddGame extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleShowCreate = this.handleShowCreate.bind( this );
        this.handleInputChange = this.handleInputChange.bind( this );
        this.handleBoxartChange = this.handleBoxartChange.bind( this );
        this.handleSaveGame = this.handleSaveGame.bind( this );

        this.state = Object.assign( { showCreate: false }, EMPTY_GAME );
    }

    handleSaveGame () {
        const newGame = {
            // Only persist a config when there's something in it, so games
            // created without art don't carry an empty boxart key.
            config: this.state.boxart ? { boxart: this.state.boxart } : undefined,
            // Every game is served from the shared domain; no longer edited per game.
            hostname: 'developertracker.com',
            identifier: this.state.identifier,
            name: this.state.name,
            shortName: this.state.shortName || this.state.name,
        };

        api.post( '/games', newGame )
            .then( () => {
                this.setState( Object.assign( { showCreate: false }, EMPTY_GAME ) );

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
        this.setState( {
            [ event.target.name ]: event.target.value,
        } );
    }

    handleBoxartChange ( boxart ) {
        this.setState( {
            boxart: boxart,
        } );
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
                    fullWidth
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
                            onChange = { this.handleInputChange }
                            placeholder = { 'Name' }
                            value = { this.state.name }
                            variant = { 'standard' }
                        />
                        <Divider />
                        <TextField
                            fullWidth
                            label = { 'Short name' }
                            name = { 'shortName' }
                            onChange = { this.handleInputChange }
                            placeholder = { 'Short name' }
                            value = { this.state.shortName }
                            variant = { 'standard' }
                        />
                        <Divider />
                        <TextField
                            fullWidth
                            label = { 'Identifier' }
                            name = { 'identifier' }
                            onChange = { this.handleInputChange }
                            placeholder = { 'Identifier' }
                            value = { this.state.identifier }
                            variant = { 'standard' }
                        />
                        <Box
                            sx = { {
                                mt: 3,
                            } }
                        >
                            <BoxartPicker
                                onChange = { this.handleBoxartChange }
                                queryHint = { this.state.name }
                                value = { this.state.boxart }
                            />
                        </Box>
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
