import React from 'react';
import PropTypes from 'prop-types';

import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

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

    render () {
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
                        { `${ this.props.nick || this.props.name } - ${ this.props.id }` }
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
            </Paper>
        );
    }
}

Developer.displayName = 'Developer';

Developer.defaultProps = {
    active: 1,
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
