import React from 'react';
import PropTypes from 'prop-types';

import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

import AddService from './AddService.jsx';
import DeveloperField from './DeveloperField.jsx';
import api from './api.js';

const styles = {
    header: {
        alignItems: 'center',
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    title: {
        margin: 0,
    },
};

const wrapperSx = {
    boxSizing: 'border-box',
    m: 0,
    maxWidth: '100%',
    p: {
        sm: '20px 30px',
        xs: '16px 18px',
    },
    position: 'relative',
    width: {
        sm: 340,
        xs: '100%',
    },
};

class Developer extends React.PureComponent {
    constructor ( props ) {
        super( props );

        this.getAccounts = this.getAccounts.bind( this );
        this.handleActiveToggle = this.handleActiveToggle.bind( this );
        this.handleToggleMerge = this.handleToggleMerge.bind( this );
        this.handleMergeTargetChange = this.handleMergeTargetChange.bind( this );
        this.handleConfirmMerge = this.handleConfirmMerge.bind( this );

        this.state = {
            mergeOpen: false,
            mergeTarget: false,
        };
    }

    getAccounts () {
        return this.props.accounts.map( ( account ) => {
            return (
                <DeveloperField
                    delete
                    displayName = { account.service }
                    gameId = { this.props.gameId }
                    id = { account.id }
                    key = { `developer-field-${ account.service }-${ account.identifier }` }
                    name = { 'identifier' }
                    type = { 'accounts' }
                    value = { account.identifier }
                />
            );
        } );
    }

    handleActiveToggle ( event, isInputChecked ) {
        api.patch( `/${ this.props.gameId }/developers/${ this.props.id }`, this.props.id, {
            active: isInputChecked,
        } )
            .then( () => {
                console.log( 'updated' );
            } )
            .catch( ( error ) => {
                console.error( error );
            } );
    }

    handleToggleMerge () {
        this.setState( ( previousState ) => {
            return {
                mergeOpen: !previousState.mergeOpen,
                mergeTarget: false,
            };
        } );
    }

    handleMergeTargetChange ( event, value ) {
        this.setState( {
            mergeTarget: value || false,
        } );
    }

    handleConfirmMerge () {
        if ( !this.state.mergeTarget ) {
            return;
        }

        // The source (this developer) is absorbed into the chosen target: its
        // accounts move to the target and this developer row is deleted. The
        // server does the reassign + delete in one transaction.
        api.post( `/${ this.props.gameId }/developers/${ this.props.id }/merge`, {
            targetId: this.state.mergeTarget.id,
        } )
            .then( () => {
                this.setState( {
                    mergeOpen: false,
                    mergeTarget: false,
                } );

                window.snackbarText = 'Developer merged';
                window.dispatchEvent( new Event( 'open-snackbar' ) );
                window.dispatchEvent( new Event( 'data-update' ) );
            } )
            .catch( ( mergeError ) => {
                window.snackbarText = mergeError.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
            } );
    }

    render () {
        // Other developers of this game are the possible merge targets; a
        // developer can't be merged into itself.
        const mergeTargets = this.props.availableDevelopers.filter( ( developer ) => {
            return developer.id !== this.props.id;
        } );

        const thisLabel = this.props.nick || this.props.name;

        return (
            <Paper
                elevation = { 1 }
                square
                sx = { wrapperSx }
            >
                <div
                    style = { styles.header }
                >
                    <h3
                        style = { styles.title }
                    >
                        { `${ thisLabel } - ${ this.props.id }` }
                    </h3>
                    <FormControlLabel
                        control = {
                            <Switch
                                defaultChecked = { Boolean( this.props.active ) }
                                onChange = { this.handleActiveToggle }
                            />
                        }
                        label = { 'Active' }
                    />
                </div>
                <DeveloperField
                    displayName = { 'Nick' }
                    gameId = { this.props.gameId }
                    id = { this.props.id }
                    name = { 'nick' }
                    type = { 'developers' }
                    value = { this.props.nick }
                />
                <DeveloperField
                    displayName = { 'Name' }
                    gameId = { this.props.gameId }
                    id = { this.props.id }
                    name = { 'name' }
                    type = { 'developers' }
                    value = { this.props.name }
                />
                <DeveloperField
                    availableOptions = { this.props.availableGroups }
                    displayName = { 'Group' }
                    gameId = { this.props.gameId }
                    id = { this.props.id }
                    name = { 'group' }
                    type = { 'developers' }
                    value = { this.props.group }
                />
                <DeveloperField
                    displayName = { 'Role' }
                    gameId = { this.props.gameId }
                    id = { this.props.id }
                    name = { 'role' }
                    type = { 'developers' }
                    value = { this.props.role }
                />
                { this.getAccounts() }
                <AddService
                    availableGroups = { this.props.availableGroups }
                    availableServices = { this.props.availableServices }
                    developerId = { this.props.id }
                    gameId = { this.props.gameId }
                />
                { mergeTargets.length > 0 &&
                    <Button
                        color = { 'secondary' }
                        onClick = { this.handleToggleMerge }
                        size = { 'small' }
                        sx = { { mt: 1 } }
                    >
                        { 'Merge into…' }
                    </Button>
                }
                <Dialog
                    fullWidth
                    onClose = { this.handleToggleMerge }
                    open = { this.state.mergeOpen }
                >
                    <DialogTitle>
                        { `Merge ${ thisLabel }` }
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx = { { mb: 2 } }>
                            { `Move ${ thisLabel }'s accounts into the selected developer, then delete ${ thisLabel }. The target keeps its own name, group and role.` }
                        </DialogContentText>
                        <Autocomplete
                            getOptionLabel = { ( option ) => {
                                return `${ option.nick || option.name } - ${ option.id }`;
                            } }
                            onChange = { this.handleMergeTargetChange }
                            openOnFocus
                            options = { mergeTargets }
                            renderInput = { ( params ) => {
                                return (
                                    <TextField
                                        { ...params }
                                        label = { 'Merge into' }
                                        variant = { 'standard' }
                                    />
                                );
                            } }
                            value = { this.state.mergeTarget || null }
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color = { 'secondary' }
                            onClick = { this.handleToggleMerge }
                        >
                            { 'Cancel' }
                        </Button>
                        <Button
                            disabled = { !this.state.mergeTarget }
                            onClick = { this.handleConfirmMerge }
                        >
                            { 'Merge' }
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        );
    }
}

Developer.displayName = 'Developer';

Developer.defaultProps = {
    active: 1,
    availableDevelopers: [],
    availableGroups: [],
    availableServices: [],
    group: '',
    name: '',
    nick: '',
    role: '',
};

Developer.propTypes = {
    accounts: PropTypes.oneOfType(
        [
            PropTypes.bool,
            PropTypes.arrayOf(
                PropTypes.shape( {
                    identifier: PropTypes.string.isRequired,
                    service: PropTypes.string.isRequired,
                } )
            ),
        ]
    ).isRequired,
    active: PropTypes.oneOfType( [ PropTypes.bool, PropTypes.number ] ),
    availableDevelopers: PropTypes.arrayOf(
        PropTypes.shape( {
            id: PropTypes.number.isRequired,
        } )
    ),
    availableGroups: PropTypes.arrayOf( PropTypes.string ),
    availableServices: PropTypes.arrayOf( PropTypes.string ),
    gameId: PropTypes.string.isRequired,
    group: PropTypes.string,
    id: PropTypes.number.isRequired,
    name: PropTypes.string,
    nick: PropTypes.string,
    role: PropTypes.string,
};

export default Developer;
