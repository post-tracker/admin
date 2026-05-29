import React from 'react';
import PropTypes from 'prop-types';

import AutoComplete from 'material-ui/AutoComplete';
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
        this.handlePickExistingDeveloper = this.handlePickExistingDeveloper.bind( this );
        this.handleExistingDeveloperInput = this.handleExistingDeveloperInput.bind( this );

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

            return;
        }

        const developersChanged = nextProps.availableDevelopers !== this.props.availableDevelopers;
        const haveNoMatchYet = !this.state.existingDeveloperId && this.state.existingDeveloperNick === '';

        if ( developersChanged && haveNoMatchYet && nextProps.prefillName ) {
            const autoMatch = this.findExistingDeveloperMatch( nextProps.prefillName, nextProps.availableDevelopers );

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
            existingDeveloperNick: chosen,
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

        const developerNicks = this.props.availableDevelopers.map( ( developer ) => {
            return developer.nick;
        } );

        const attachingToExisting = Boolean( this.state.existingDeveloperId );

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
                    { developerNicks.length > 0 &&
                        <div>
                            <AutoComplete
                                dataSource = { developerNicks }
                                filter = { AutoComplete.caseInsensitiveFilter }
                                floatingLabelText = { 'Attach to existing developer (leave blank to create new)' }
                                fullWidth
                                onNewRequest = { this.handlePickExistingDeveloper }
                                onUpdateInput = { this.handleExistingDeveloperInput }
                                openOnFocus
                                searchText = { this.state.existingDeveloperNick }
                                underlineShow = { false }
                            />
                            <Divider />
                        </div>
                    }
                    { !attachingToExisting &&
                        <div>
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
                        </div>
                    }
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
