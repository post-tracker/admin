import React from 'react';
import PropTypes from 'prop-types';

import ContentAdd from 'material-ui/svg-icons/content/add';
import Dialog from 'material-ui/Dialog';
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import TextField from 'material-ui/TextField';

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

        this.state = this.buildInitialState( props );
    }

    componentWillReceiveProps ( nextProps ) {
        if (
            nextProps.prefillName !== this.props.prefillName
            || nextProps.prefillService !== this.props.prefillService
            || nextProps.prefillIdentifier !== this.props.prefillIdentifier
            || nextProps.openOnMount !== this.props.openOnMount
        ) {
            this.setState( this.buildInitialState( nextProps ) );
        }
    }

    buildInitialState ( props ) {
        return {
            group: false,
            identifier: props.prefillIdentifier || false,
            name: props.prefillName || false,
            nick: props.prefillName || false,
            role: false,
            service: props.prefillService || false,
            showCreate: Boolean( props.openOnMount ),
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

        const wantsAccount = this.state.service && this.state.identifier;

        api.post( `/${ this.props.gameId }/developers`, newPost )
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
            } )
            .then( () => {
                this.setState( {
                    group: false,
                    identifier: false,
                    name: false,
                    nick: false,
                    role: false,
                    service: false,
                    showCreate: false,
                } );

                window.snackbarText = 'Developer added';
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
                <Dialog
                    actions = { actions }
                    autoScrollBodyContent
                    modal = { false }
                    onRequestClose = { this.handleClose }
                    open = { this.state.showCreate }
                    title = { `Create developer - ${ this.props.gameId }` }
                >
                    <TextField
                        defaultValue = { this.state.name || '' }
                        floatingLabelText = { 'Name' }
                        fullWidth
                        hintText = { 'Name' }
                        name = { 'name' }
                        onKeyUp = { this.handleInputChange }
                        underlineShow = { false }
                    />
                    <Divider />
                    <TextField
                        defaultValue = { this.state.nick || '' }
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
                    { this.state.service && this.state.identifier &&
                        <div>
                            <Divider />
                            <TextField
                                defaultValue = { this.state.service }
                                disabled
                                floatingLabelText = { 'Account service' }
                                fullWidth
                                name = { 'service' }
                                underlineShow = { false }
                            />
                            <Divider />
                            <TextField
                                defaultValue = { this.state.identifier }
                                disabled
                                floatingLabelText = { 'Account identifier' }
                                fullWidth
                                name = { 'identifier' }
                                underlineShow = { false }
                            />
                        </div>
                    }
                </Dialog>
            </div>
        );
    }
}

AddDeveloper.displayName = 'AddDeveloper';

AddDeveloper.defaultProps = {
    onSaved: false,
    openOnMount: false,
    prefillIdentifier: false,
    prefillName: false,
    prefillService: false,
};

AddDeveloper.propTypes = {
    gameId: PropTypes.string.isRequired,
    gameNumber: PropTypes.number.isRequired,
    onSaved: PropTypes.oneOfType( [ PropTypes.func, PropTypes.bool ] ),
    openOnMount: PropTypes.bool,
    prefillIdentifier: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
    prefillName: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
    prefillService: PropTypes.oneOfType( [ PropTypes.string, PropTypes.bool ] ),
};

export default AddDeveloper;
