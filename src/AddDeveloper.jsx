import React from 'react';
import PropTypes from 'prop-types';

import ContentAdd from 'material-ui/svg-icons/content/add';
import Dialog from 'material-ui/Dialog';
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import TextField from 'material-ui/TextField';
import Snackbar from 'material-ui/Snackbar';

import api from './api.js';

const styles = {
    addDeveloperButton: {
        position: 'absolute',
        right: '20px',
        top: '20px',
    },
};

class AddDeveloper extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleShowCreate = this.handleShowCreate.bind( this );
        this.handleInputChange = this.handleInputChange.bind( this );
        this.handleSaveDeveloper = this.handleSaveDeveloper.bind( this );
        this.handleSnackbarClose = this.handleSnackbarClose.bind( this );

        this.state = {
            group: false,
            name: false,
            nick: false,
            role: false,
            showCreate: false,
            snackbarOpen: false,
            snackbarText: '',
        };
    }

    handleSaveDeveloper () {
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

        console.log( newPost );

        api.post( `/${ this.props.gameId }/developers`, newPost )
            .then( () => {
                this.setState( {
                    showCreate: false,
                    snackbarOpen: true,
                    snackbarText: 'Developer added',
                } );

                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( saveError ) => {
                this.setState( {
                    snackbarOpen: true,
                    snackbarText: saveError.message,
                } );
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

    handleSnackbarClose () {
        this.setState( {
            snackbarOpen: false,
        } );
    }

    render () {
        const actions = [
            <FlatButton
                key = { 'cancel-button' }
                label = { 'Cancel' }
                onTouchTap = { this.handleShowCreate }
                secondary
            />,
            <FlatButton
                default
                key = { 'confirm-button' }
                keyboardFocused
                label = { 'Submit' }
                onTouchTap = { this.handleSaveDeveloper }
            />,
        ];

        return (
            <div>
                <FloatingActionButton
                    onTouchTap = { this.handleShowCreate }
                    style = { styles.addDeveloperButton }
                >
                    <ContentAdd />
                </FloatingActionButton>
                <Snackbar
                    autoHideDuration = { 4000 }
                    message = { this.state.snackbarText }
                    onRequestClose = { this.handleSnackbarClose }
                    open = { this.state.snackbarOpen }
                />
                <Dialog
                    actions = { actions }
                    modal = { false }
                    onRequestClose = { this.handleClose }
                    open = { this.state.showCreate }
                    title = { `Create developer - ${ this.props.gameId }` }
                >
                    <TextField
                        floatingLabelText = { 'Name' }
                        fullWidth
                        hintText = { 'Name' }
                        name = { 'name' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        floatingLabelText = { 'Nick' }
                        fullWidth
                        hintText = { 'Nick' }
                        name = { 'nick' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        floatingLabelText = { 'Group' }
                        fullWidth
                        hintText = { 'Group' }
                        name = { 'group' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        floatingLabelText = { 'Role' }
                        fullWidth
                        hintText = { 'Role' }
                        name = { 'role' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                </Dialog>
            </div>
        );
    }
}

AddDeveloper.displayName = 'AddDeveloper';

AddDeveloper.propTypes = {
    gameId: PropTypes.string.isRequired,
    gameNumber: PropTypes.number.isRequired,
};

export default AddDeveloper;
