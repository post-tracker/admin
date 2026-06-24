import React from 'react';
import PropTypes from 'prop-types';

import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Fab from '@mui/material/Fab';
import Button from '@mui/material/Button';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';

import api from './api.js';

const styles = {
    addAccountButtonsWrapper: {
        marginTop: 14,
    },
    addAccountWrapper: {
        marginTop: 20,
        textAlign: 'center',
    },
    // Fields must opt out of the wrapper's centered text so their labels and
    // values align left like every other field in the card.
    formField: {
        textAlign: 'left',
    },
    saveAccountButton: {
        marginRight: 12,
    },
};

class AddService extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleToggle = this.handleToggle.bind( this );
        this.handleKeyUp = this.handleKeyUp.bind( this );
        this.handleSave = this.handleSave.bind( this );
        this.handleServiceChange = this.handleServiceChange.bind( this );

        this.state = {
            isOpen: false,
        };
    }

    handleToggle () {
        this.setState( {
            isOpen: !this.state.isOpen,
        } );
    }

    handleSave () {
        api.post( `/${ this.props.gameId }/accounts`, {
            developerId: this.props.developerId,
            identifier: this.state.identifier,
            service: this.state.service,
        } )
            .then( () => {
                this.setState( {
                    isOpen: false,
                } );

                window.snackbarText = 'Account added';
                window.dispatchEvent( new Event( 'open-snackbar' ) );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( postError ) => {
                window.snackbarText = postError.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
            } );
    }

    handleServiceChange ( serviceValue ) {
        this.setState( {
            service: serviceValue,
        } );
    }

    handleKeyUp ( event ) {
        const newState = {};

        newState[ event.target.name ] = event.target.value;

        this.setState( newState );
    }

    getContent () {
        const returnNodes = [];

        if ( this.state.isOpen ) {
            returnNodes.push(
                // Constrained (no freeSolo): an account can only be attached to a
                // service the game has a configured source for, so it can't be
                // created with a service nothing will index. The value comes from
                // onChange (a picked option), not onInputChange (free text).
                <Autocomplete
                    fullWidth
                    key = { 'add-account-service' }
                    onChange = { ( event, value ) => {
                        this.handleServiceChange( value );
                    } }
                    openOnFocus
                    options = { this.props.availableServices }
                    renderInput = { ( params ) => {
                        return (
                            <TextField
                                { ...params }
                                label = { 'Service' }
                                style = { styles.formField }
                                variant = { 'standard' }
                            />
                        );
                    } }
                    value = { this.state.service || null }
                />
            );
            returnNodes.push(
                <Divider
                    key = { 'add-account-divider' }
                />
            );
            returnNodes.push(
                <TextField
                    fullWidth
                    key = { 'add-account-identifier' }
                    label = { 'Identifier' }
                    name = { 'identifier' }
                    onKeyUp = { this.handleKeyUp }
                    style = { styles.formField }
                    variant = { 'standard' }
                />
            );
            returnNodes.push(
                <Divider
                    key = { 'add-account-second-divider' }
                />
            );
            returnNodes.push(
                <div
                    key = { 'add-account-buttons-wrapper' }
                    style = { styles.addAccountButtonsWrapper }
                >
                    <Button
                        color = { 'primary' }
                        disabled = { !this.state.service || !this.state.identifier }
                        key = { 'add-account-save-button' }
                        onClick = { this.handleSave }
                        style = { styles.saveAccountButton }
                        variant = { 'contained' }
                    >
                        { 'Save' }
                    </Button>
                    <Button
                        color = { 'secondary' }
                        key = { 'add-account-cancel-button' }
                        onClick = { this.handleToggle }
                        variant = { 'contained' }
                    >
                        { 'Cancel' }
                    </Button>
                </div>
            );
        } else {
            returnNodes.push(
                <Fab
                    key = { 'add-account-toggle-button' }
                    onClick = { this.handleToggle }
                    size = { 'small' }
                >
                    <AddIcon />
                </Fab>
            );
        }

        return returnNodes;
    }

    render () {
        return (
            <div
                style = { styles.addAccountWrapper }
            >
                { this.getContent() }
            </div>
        );
    }
}

AddService.displayName = 'AddService';

AddService.defaultProps = {
    availableServices: [],
};

AddService.propTypes = {
    availableServices: PropTypes.arrayOf( PropTypes.string ),
    developerId: PropTypes.number.isRequired,
    gameId: PropTypes.string.isRequired,
};

export default AddService;
