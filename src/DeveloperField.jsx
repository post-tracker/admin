import React from 'react';
import PropTypes from 'prop-types';

import Divider from 'material-ui/Divider';
import TextField from 'material-ui/TextField';
import IconButton from 'material-ui/IconButton';
import ActionDelete from 'material-ui/svg-icons/action/delete';
import ContentSave from 'material-ui/svg-icons/content/save';
import Snackbar from 'material-ui/Snackbar';
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
        this.handleSnackbarClose = this.handleSnackbarClose.bind( this );
        this.getInputField = this.getInputField.bind( this );

        this.state = {
            newValue: false,
            snackbarOpen: false,
            snackbarText: '',
        };
    }

    handleValueChange ( valueOrEvent ) {
        let newValue = valueOrEvent;

        console.log( valueOrEvent );

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
                    snackbarOpen: true,
                    snackbarText: 'Property deleted',
                } );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( error ) => {
                this.setState( {
                    snackbarOpen: true,
                    snackbarText: error.message,
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
                    snackbarOpen: true,
                    snackbarText: 'Property updated',
                } );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( error ) => {
                this.setState( {
                    snackbarOpen: true,
                    snackbarText: error.message,
                } );
            } );
    }

    handleSnackbarClose () {
        this.setState( {
            snackbarOpen: false,
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
                        }
                    } }
                    searchText = { this.state.newValue || this.props.value }
                    underlineShow = { false }
                />
            )
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
                                    onTouchTap = { this.handleDelete }
                                    style = { styles.actionButton }
                                >
                                    <ActionDelete />
                                </IconButton>
                            );
                        }

                        return false;
                    } )()
                }
                <Divider
                    key = { `${ this.props.name }-${ this.props.value }-divider` }
                />
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
