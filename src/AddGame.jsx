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

// Turn a display name into a URL-safe identifier: lowercase, non-alphanumeric
// runs collapsed to single hyphens, no leading/trailing hyphens.
const slugify = function slugify ( name ) {
    return name
        .toLowerCase()
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /^-+|-+$/g, '' );
};

class AddGame extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleShowCreate = this.handleShowCreate.bind( this );
        this.handleInputChange = this.handleInputChange.bind( this );
        this.handleBoxartChange = this.handleBoxartChange.bind( this );
        this.handleSaveGame = this.handleSaveGame.bind( this );

        // Track which mirror fields the user has typed into directly, so the
        // name-driven autofill stops overwriting them once they're customised.
        this.touched = { identifier: false, shortName: false };

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
                this.touched = { identifier: false, shortName: false };
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
        const { name, value } = event.target;

        if ( name === 'name' ) {
            // Mirror the name into shortName/identifier until the user edits
            // those fields themselves.
            this.setState( ( state ) => ( {
                name: value,
                shortName: this.touched.shortName ? state.shortName : value,
                identifier: this.touched.identifier ? state.identifier : slugify( value ),
            } ) );

            return;
        }

        if ( name === 'shortName' || name === 'identifier' ) {
            this.touched[ name ] = true;
        }

        this.setState( {
            [ name ]: value,
        } );
    }

    handleBoxartChange ( boxart ) {
        this.setState( {
            boxart: boxart,
        } );
    }

    handleShowCreate () {
        // Reset the autofill tracking alongside the form fields when the
        // dialog is dismissed so the next open starts clean.
        if ( this.state.showCreate ) {
            this.touched = { identifier: false, shortName: false };
            this.setState( Object.assign( { showCreate: false }, EMPTY_GAME ) );

            return;
        }

        this.setState( {
            showCreate: true,
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
