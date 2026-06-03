import React from 'react';
import PropTypes from 'prop-types';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';

import api from './api.js';

const styles = {
    actionButton: {
        bottom: 0,
        position: 'absolute',
        right: -16,
    },
    wrapper: {
        position: 'relative',
    },
};

class DeveloperField extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleValueChange = this.handleValueChange.bind( this );
        this.handleDelete = this.handleDelete.bind( this );
        this.handleSave = this.handleSave.bind( this );
        this.getInputField = this.getInputField.bind( this );
        this.handleDeleteClick = this.handleDeleteClick.bind( this );
        this.handleCancelClick = this.handleCancelClick.bind( this );

        this.state = {
            confirmOpen: false,
            newValue: false,
        };
    }

    handleValueChange ( valueOrEvent ) {
        let newValue = valueOrEvent;

        if ( valueOrEvent.target ) {
            newValue = valueOrEvent.target.value;
        }

        if ( newValue === this.props.value ) {
            newValue = false;
        }

        this.setState( {
            newValue: newValue,
        } );
    }

    handleDelete () {
        api.deleteResource( `/${ this.props.gameId }/${ this.props.type }/${ this.props.id }` )
            .then( () => {
                this.setState( {
                    confirmOpen: false,
                } );

                window.snackbarText = 'Property deleted';
                window.dispatchEvent( new Event( 'open-snackbar' ) );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( error ) => {
                window.snackbarText = error.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
                this.setState( {
                    confirmOpen: false,
                } );
            } );
    }

    handleSave () {
        const patchProperties = {};

        patchProperties[ this.props.name ] = this.state.newValue;

        api.patch( `/${ this.props.gameId }/${ this.props.type }/${ this.props.id }`, this.props.id, patchProperties )
            .then( () => {
                this.setState( {
                    newValue: false,
                } );

                window.snackbarText = 'Property updated';
                window.dispatchEvent( new Event( 'open-snackbar' ) );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( error ) => {
                window.snackbarText = error.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
            } );
    }

    handleDeleteClick () {
        this.setState( {
            confirmOpen: true,
        } );
    }

    handleCancelClick () {
        this.setState( {
            confirmOpen: false,
        } );
    }

    getInputField () {
        if ( this.props.availableOptions.length > 0 ) {
            return (
                <Autocomplete
                    filterOptions = { ( options ) => {
                        return options;
                    } }
                    freeSolo
                    inputValue = { String( this.state.newValue || this.props.value || '' ) }
                    key = { `${ this.props.name }-${ this.props.value }` }
                    onInputChange = { ( event, value ) => {
                        this.handleValueChange( value );
                    } }
                    openOnFocus
                    options = { this.props.availableOptions }
                    renderInput = { ( params ) => {
                        return (
                            <TextField
                                { ...params }
                                label = { this.props.displayName || this.props.name }
                                variant = { 'standard' }
                            />
                        );
                    } }
                />
            );
        }

        return (
            <TextField
                defaultValue = { this.props.value }
                key = { `${ this.props.name }-${ this.props.value }` }
                label = { this.props.displayName || this.props.name }
                name = { this.props.name }
                onKeyUp = { this.handleValueChange }
                variant = { 'standard' }
            />
        );
    }

    render () {
        return (
            <div
                style = { styles.wrapper }
            >
                { this.getInputField() }
                {
                    ( () => {
                        if ( this.state.newValue !== false ) {
                            return (
                                <IconButton
                                    onClick = { this.handleSave }
                                    style = { styles.actionButton }
                                >
                                    <SaveIcon />
                                </IconButton>
                            );
                        } else if ( this.props.delete ) {
                            return (
                                <IconButton
                                    onClick = { this.handleDeleteClick }
                                    style = { styles.actionButton }
                                >
                                    <DeleteIcon />
                                </IconButton>
                            );
                        }

                        return false;
                    } )()
                }
                <Dialog
                    onClose = { this.handleCancelClick }
                    open = { this.state.confirmOpen }
                >
                    <DialogContent>
                        { `Are you sure you want to delete "${ this.props.name }-${ this.props.value }" ?` }
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color = { 'primary' }
                            key = 'cancel-delete'
                            onClick = { this.handleCancelClick }
                        >
                            { 'No' }
                        </Button>
                        <Button
                            color = { 'primary' }
                            key = 'confirm-delete'
                            onClick = { this.handleDelete }
                        >
                            { 'Yes' }
                        </Button>
                    </DialogActions>
                </Dialog>
                <Divider
                    key = { `${ this.props.name }-${ this.props.value }-divider` }
                />
            </div>
        );
    }
}

DeveloperField.displayName = 'DeveloperField';

DeveloperField.defaultProps = {
    availableOptions: [],
    delete: false,
    displayName: '',
    value: '',
};

DeveloperField.propTypes = {
    availableOptions: PropTypes.arrayOf( PropTypes.string ),
    delete: PropTypes.bool,
    displayName: PropTypes.string,
    gameId: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    value: PropTypes.string,
};

export default DeveloperField;
