import React from 'react';
import PropTypes from 'prop-types';

import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
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

class GameField extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleValueChange = this.handleValueChange.bind( this );
        this.handleSave = this.handleSave.bind( this );
        this.getInputField = this.getInputField.bind( this );

        this.state = {
            confirmOpen: false,
            errorText: false,
            newValue: false,
        };
    }

    handleValueChange ( valueOrEvent ) {
        let newValue = false;
        let errorText = false;

        if ( valueOrEvent.target ) {
            console.log( valueOrEvent.target.value );
            if ( this.props.json ) {
                try {
                    newValue = JSON.parse( valueOrEvent.target.value );
                } catch {
                    errorText = 'invalid json';
                }
            } else {
                newValue = valueOrEvent.target.value;
            }
        }

        if ( newValue === this.props.value ) {
            newValue = false;
        }

        this.setState( {
            errorText: errorText,
            newValue: newValue,
        } );
    }

    handleSave () {
        const patchProperties = {};

        patchProperties[ this.props.name ] = this.state.newValue;

        if ( Object.keys( patchProperties ).length < 1 ) {
            return true;
        }

        api.patch( `/games/${ this.props.identifier }`, this.props.identifier, patchProperties )
            .then( () => {
                this.setState( {
                    errorText: false,
                    newValue: false,
                } );

                window.snackbarText = 'Property updated';
                window.dispatchEvent( new Event( 'open-snackbar' ) );
                window.dispatchEvent( new Event( 'games-update' ) );
            } )
            .catch( ( error ) => {
                window.snackbarText = error.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
            } );

        return true;
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

        let fieldValue = this.props.value;
        const extraProps = {};

        if ( this.props.json ) {
            fieldValue = JSON.stringify( fieldValue, null, 4 );
            extraProps.multiline = true;
            extraProps.rows = 11;
        }

        return (
            <TextField
                { ...extraProps }
                defaultValue = { fieldValue }
                disabled = { this.props.disabled }
                error = { Boolean( this.state.errorText ) }
                fullWidth
                helperText = { this.state.errorText || '' }
                key = { `${ this.props.name }-${ this.props.value }` }
                label = { this.props.displayName || this.props.name }
                name = { this.props.name }
                onKeyUp = { this.handleValueChange }
                slotProps = { {
                    htmlInput: {
                        style: this.props.style,
                    },
                } }
                variant = { 'standard' }
            />
        );
    }

    render () {
        const wrapperStyles = Object.assign( {}, styles.wrapper, this.props.style );

        return (
            <div
                style = { wrapperStyles }
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
                        }

                        return false;
                    } )()
                }
                { !this.props.json &&
                    <Divider
                        key = { `${ this.props.name }-${ this.props.value }-divider` }
                    />
                }
            </div>
        );
    }
}

GameField.displayName = 'GameField';

GameField.defaultProps = {
    availableOptions: [],
    disabled: false,
    displayName: '',
    json: false,
    style: {},
    value: '',
};

GameField.propTypes = {
    availableOptions: PropTypes.arrayOf( PropTypes.string ),
    disabled: PropTypes.bool,
    displayName: PropTypes.string,
    identifier: PropTypes.string.isRequired,
    json: PropTypes.bool,
    name: PropTypes.string.isRequired,
    style: PropTypes.object,
    value: PropTypes.oneOfType(
        [
            PropTypes.object,
            PropTypes.string,
        ]
    ),
};

export default GameField;
