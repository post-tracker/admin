import React from 'react';
import PropTypes from 'prop-types';

import Autocomplete from '@mui/material/Autocomplete';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import AddIcon from '@mui/icons-material/Add';

import api from './api.js';

class AddDeveloper extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleShowCreate = this.handleShowCreate.bind( this );
        this.handleInputChange = this.handleInputChange.bind( this );
        this.handleSaveDeveloper = this.handleSaveDeveloper.bind( this );
        this.handlePickExistingDeveloper = this.handlePickExistingDeveloper.bind( this );
        this.handleExistingDeveloperInput = this.handleExistingDeveloperInput.bind( this );

        this.state = this.buildInitialState( props );
    }

    componentDidUpdate ( prevProps ) {
        if (
            this.props.prefillName !== prevProps.prefillName
            || this.props.prefillService !== prevProps.prefillService
            || this.props.prefillIdentifier !== prevProps.prefillIdentifier
            || this.props.openOnMount !== prevProps.openOnMount
        ) {
            this.setState( this.buildInitialState( this.props ) );

            return;
        }

        const developersChanged = this.props.availableDevelopers !== prevProps.availableDevelopers;
        const haveNoMatchYet = !this.state.existingDeveloperId && this.state.existingDeveloperNick === '';

        if ( developersChanged && haveNoMatchYet && this.props.prefillName ) {
            const autoMatch = this.findExistingDeveloperMatch( this.props.prefillName, this.props.availableDevelopers );

            if ( autoMatch ) {
                this.setState( {
                    existingDeveloperId: autoMatch.id,
                    existingDeveloperNick: autoMatch.nick,
                } );
            }
        }
    }

    buildInitialState ( props ) {
        const autoMatch = this.findExistingDeveloperMatch( props.prefillName, props.availableDevelopers );

        return {
            existingDeveloperId: autoMatch
                ? autoMatch.id
                : false,
            existingDeveloperNick: autoMatch
                ? autoMatch.nick
                : '',
            group: false,
            identifier: props.prefillIdentifier || false,
            name: props.prefillName || false,
            nick: props.prefillName || false,
            role: false,
            service: props.prefillService || false,
            showCreate: Boolean( props.openOnMount ),
        };
    }

    findExistingDeveloperMatch ( prefillName, availableDevelopers ) {
        if ( !prefillName || !availableDevelopers || availableDevelopers.length === 0 ) {
            return false;
        }

        const normalised = String( prefillName ).trim().toLowerCase();

        if ( !normalised ) {
            return false;
        }

        return availableDevelopers.find( ( developer ) => {
            const candidates = [ developer.nick, developer.name ];

            return candidates.some( ( candidate ) => {
                if ( !candidate ) {
                    return false;
                }

                return String( candidate ).trim().toLowerCase() === normalised;
            } );
        } ) || false;
    }

    handlePickExistingDeveloper ( chosen ) {
        const match = this.props.availableDevelopers.find( ( developer ) => {
            return developer.nick === chosen;
        } );

        this.setState( {
            existingDeveloperId: match
                ? match.id
                : false,
            existingDeveloperNick: chosen || '',
        } );
    }

    handleExistingDeveloperInput ( typed ) {
        const match = this.props.availableDevelopers.find( ( developer ) => {
            return developer.nick === typed;
        } );

        this.setState( {
            existingDeveloperId: match
                ? match.id
                : false,
            existingDeveloperNick: typed,
        } );
    }

    handleSaveDeveloper () {
        const wantsAccount = this.state.service && this.state.identifier;

        let saveChain;

        if ( this.state.existingDeveloperId ) {
            if ( !wantsAccount ) {
                window.snackbarText = 'Pick a service and identifier to attach to existing developer';
                window.dispatchEvent( new Event( 'open-snackbar' ) );

                return;
            }

            saveChain = api.post( `/${ this.props.gameId }/accounts`, {
                developerId: this.state.existingDeveloperId,
                identifier: this.state.identifier,
                service: this.state.service,
            } );
        } else {
            const newPost = {
                gameId: this.props.gameNumber,
            };

            if ( this.state.group ) {
                newPost.group = this.state.group;
            }

            if ( this.state.name ) {
                newPost.name = this.state.name;
            }

            if ( this.state.nick ) {
                newPost.nick = this.state.nick;
            }

            if ( this.state.role ) {
                newPost.role = this.state.role;
            }

            saveChain = api.post( `/${ this.props.gameId }/developers`, newPost )
                .then( () => {
                    if ( !wantsAccount ) {
                        return false;
                    }

                    return api.get( `/${ this.props.gameId }/developers` )
                        .then( ( developers ) => {
                            const match = developers.data.find( ( developer ) => {
                                return developer.nick === newPost.nick;
                            } );

                            if ( !match ) {
                                throw new Error( 'Developer not found after create' );
                            }

                            return api.post( `/${ this.props.gameId }/accounts`, {
                                developerId: match.id,
                                identifier: this.state.identifier,
                                service: this.state.service,
                            } );
                        } );
                } );
        }

        const wasAttachingToExisting = Boolean( this.state.existingDeveloperId );

        saveChain
            .then( () => {
                this.setState( {
                    existingDeveloperId: false,
                    existingDeveloperNick: '',
                    group: false,
                    identifier: false,
                    name: false,
                    nick: false,
                    role: false,
                    service: false,
                    showCreate: false,
                } );

                window.snackbarText = wasAttachingToExisting
                    ? 'Account added'
                    : 'Developer added';
                window.dispatchEvent( new Event( 'open-snackbar' ) );

                window.dispatchEvent( new Event( 'data-update' ) );

                if ( this.props.onSaved ) {
                    this.props.onSaved();
                }
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
        const developerNicks = this.props.availableDevelopers.map( ( developer ) => {
            return developer.nick;
        } );

        const attachingToExisting = Boolean( this.state.existingDeveloperId );

        return (
            <React.Fragment>
                <Button
                    onClick = { this.handleShowCreate }
                    startIcon = { <AddIcon /> }
                    variant = { 'contained' }
                >
                    { 'Add developer' }
                </Button>
                <Dialog
                    fullWidth
                    onClose = { this.handleShowCreate }
                    open = { this.state.showCreate }
                >
                    <DialogTitle>
                        { `Create developer - ${ this.props.gameId }` }
                    </DialogTitle>
                    <DialogContent>
                        { developerNicks.length > 0 &&
                            <div>
                                <Autocomplete
                                    freeSolo
                                    inputValue = { String( this.state.existingDeveloperNick || '' ) }
                                    onChange = { ( event, value ) => {
                                        this.handlePickExistingDeveloper( value );
                                    } }
                                    onInputChange = { ( event, value ) => {
                                        this.handleExistingDeveloperInput( value );
                                    } }
                                    openOnFocus
                                    options = { developerNicks }
                                    renderInput = { ( params ) => {
                                        return (
                                            <TextField
                                                { ...params }
                                                label = { 'Attach to existing developer (leave blank to create new)' }
                                                variant = { 'standard' }
                                            />
                                        );
                                    } }
                                />
                                <Divider />
                            </div>
                        }
                        { !attachingToExisting &&
                            <div>
                                <TextField
                                    defaultValue = { this.state.name || '' }
                                    fullWidth
                                    label = { 'Name' }
                                    name = { 'name' }
                                    onKeyUp = { this.handleInputChange }
                                    placeholder = { 'Name' }
                                    variant = { 'standard' }
                                />
                                <Divider />
                                <TextField
                                    defaultValue = { this.state.nick || '' }
                                    fullWidth
                                    label = { 'Nick' }
                                    name = { 'nick' }
                                    onKeyUp = { this.handleInputChange }
                                    placeholder = { 'Nick' }
                                    variant = { 'standard' }
                                />
                                <Divider />
                                <TextField
                                    fullWidth
                                    label = { 'Group' }
                                    name = { 'group' }
                                    onKeyUp = { this.handleInputChange }
                                    placeholder = { 'Group' }
                                    variant = { 'standard' }
                                />
                                <Divider />
                                <TextField
                                    fullWidth
                                    label = { 'Role' }
                                    name = { 'role' }
                                    onKeyUp = { this.handleInputChange }
                                    placeholder = { 'Role' }
                                    variant = { 'standard' }
                                />
                            </div>
                        }
                        { this.state.service && this.state.identifier &&
                            <div>
                                <Divider />
                                <TextField
                                    defaultValue = { this.state.service }
                                    disabled
                                    fullWidth
                                    label = { 'Account service' }
                                    name = { 'service' }
                                    variant = { 'standard' }
                                />
                                <Divider />
                                <TextField
                                    defaultValue = { this.state.identifier }
                                    disabled
                                    fullWidth
                                    label = { 'Account identifier' }
                                    name = { 'identifier' }
                                    variant = { 'standard' }
                                />
                            </div>
                        }
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
                            onClick = { this.handleSaveDeveloper }
                        >
                            { 'Submit' }
                        </Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        );
    }
}

AddDeveloper.displayName = 'AddDeveloper';

AddDeveloper.defaultProps = {
    availableDevelopers: [],
    onSaved: false,
    openOnMount: false,
    prefillIdentifier: false,
    prefillName: false,
    prefillService: false,
};

AddDeveloper.propTypes = {
    availableDevelopers: PropTypes.arrayOf( PropTypes.shape( {
        id: PropTypes.number.isRequired,
        nick: PropTypes.string,
    } ) ),
    gameId: PropTypes.string.isRequired,
    gameNumber: PropTypes.number.isRequired,
    onSaved: PropTypes.oneOfType( [ PropTypes.func, PropTypes.bool ] ),
    openOnMount: PropTypes.bool,
    prefillIdentifier: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
    prefillName: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
    prefillService: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
};

export default AddDeveloper;
