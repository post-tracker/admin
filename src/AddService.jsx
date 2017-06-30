import React from 'react';
import PropTypes from 'prop-types';

import Divider from 'material-ui/Divider';
import TextField from 'material-ui/TextField';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import ContentAdd from 'material-ui/svg-icons/content/add';
import RaisedButton from 'material-ui/RaisedButton';
import Snackbar from 'material-ui/Snackbar';
import AutoComplete from 'material-ui/AutoComplete';

import api from './api.js';

const styles = {
    addAccountButtonsWrapper: {
        marginTop: 14,
    },
    addAccountWrapper: {
        marginTop: 20,
        textAlign: 'center',
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
        this.handleSnackbarClose = this.handleSnackbarClose.bind( this );
        this.handleServiceChange = this.handleServiceChange.bind( this );

        this.state = {
            isOpen: false,
            snackbarOpen: false,
            snackbarText: '',
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
                    snackbarOpen: true,
                    snackbarText: 'Account added',
                } );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( postError ) => {
                console.error( postError );

                this.setState( {
                    snackbarOpen: true,
                    snackbarText: 'Failed to add account',
                } );
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

    handleSnackbarClose () {
        this.setState( {
            snackbarOpen: false,
        } );
    }

    getContent () {
        const returnNodes = [];

        if ( this.state.isOpen ) {
            returnNodes.push(
                <AutoComplete
                    dataSource = { this.props.availableServices }
                    filter = { AutoComplete.noFilter }
                    floatingLabelFixed
                    floatingLabelText = { 'Service' }
                    key = { 'add-account-service' }
                    onUpdateInput = { this.handleServiceChange }
                    openOnFocus
                    underlineShow = { false }
                />
            );
            returnNodes.push(
                <Divider
                    key = { 'add-account-divider' }
                />
            );
            returnNodes.push(
                <TextField
                    floatingLabelFixed
                    floatingLabelText = { 'Identifier' }
                    // hintText = { name }
                    key = { 'add-account-identifier' }
                    name = { 'identifier' }
                    onKeyUp = { this.handleKeyUp }
                    underlineShow = { false }
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
                    <RaisedButton
                        key = { 'add-account-save-button' }
                        label = { 'Save' }
                        onTouchTap = { this.handleSave }
                        primary
                        style = { styles.saveAccountButton }
                    />
                    <RaisedButton
                        key = { 'add-account-cancel-button' }
                        label = { 'Cancel' }
                        onTouchTap = { this.handleToggle }
                        secondary
                    />
                </div>
            );
        } else {
            returnNodes.push(
                <FloatingActionButton
                    key = { 'add-account-toggle-button' }
                    mini
                    onTouchTap = { this.handleToggle }
                >
                    <ContentAdd />
                </FloatingActionButton>
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
