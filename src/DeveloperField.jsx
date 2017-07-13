import React from 'react';
import PropTypes from 'prop-types';

import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import Divider from 'material-ui/Divider';
import TextField from 'material-ui/TextField';
import IconButton from 'material-ui/IconButton';
import ActionDelete from 'material-ui/svg-icons/action/delete';
import ContentSave from 'material-ui/svg-icons/content/save';
import AutoComplete from 'material-ui/AutoComplete';

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
                <AutoComplete
                    dataSource = { this.props.availableOptions }
                    filter = { AutoComplete.noFilter }
                    floatingLabelFixed
                    floatingLabelText = { this.props.displayName || this.props.name }
                    key = { `${ this.props.name }-${ this.props.value }` }
                    onUpdateInput = { this.handleValueChange }
                    openOnFocus
                    popoverProps = { {
                        canAutoPosition: true,
                        style: {
                            bottom: 0,
                            overflowY: 'auto',
                        },
                    } }
                    searchText = { this.state.newValue || this.props.value }
                    underlineShow = { false }
                />
            );
        }

        return (
            <TextField
                defaultValue = { this.props.value }
                floatingLabelFixed
                floatingLabelText = { this.props.displayName || this.props.name }
                key = { `${ this.props.name }-${ this.props.value }` }
                name = { this.props.name }
                onKeyUp = { this.handleValueChange }
                underlineShow = { false }
            />
        );
    }

    render () {
        const actions = [
            <FlatButton
                key = 'cancel-delete'
                label = { 'No' }
                onTouchTap = { this.handleCancelClick }
                primary
            />,
            <FlatButton
                key = 'confirm-delete'
                label = { 'Yes' }
                onTouchTap = { this.handleDelete }
                primary
            />,
        ];

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
                                    onTouchTap = { this.handleSave }
                                    style = { styles.actionButton }
                                >
                                    <ContentSave />
                                </IconButton>
                            );
                        } else if ( this.props.delete ) {
                            return (
                                <IconButton
                                    onTouchTap = { this.handleDeleteClick }
                                    style = { styles.actionButton }
                                >
                                    <ActionDelete />
                                </IconButton>
                            );
                        }

                        return false;
                    } )()
                }
                <Dialog
                    actions = { actions }
                    modal = { false }
                    onRequestClose = { this.handleClose }
                    open = { this.state.confirmOpen }
                >
                    { `Are you sure you want to delete "${ this.props.name }-${ this.props.value }" ?` }
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
