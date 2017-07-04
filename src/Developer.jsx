import React from 'react';
import PropTypes from 'prop-types';

import Paper from 'material-ui/Paper';
import Toggle from 'material-ui/Toggle';

import AddService from './AddService.jsx';
import DeveloperField from './DeveloperField.jsx';
import api from './api.js';

const styles = {
    activeWrapper: {
        float: 'right',
    },
    wrapper: {
        margin: 15,
        padding: '15px 30px',
        position: 'relative',
        // width: 350,
    },
};

class Developer extends React.Component {
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
                    gameId = { this.props.gameId }
                    id = { account.id }
                    key = { `developer-field-${ account.service }-${ account.identifier }` }
                    name = { account.service }
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
                rounded = { false }
                style = { styles.wrapper }
                zDepth = { 1 }
            >
                <h3>
                    { `${ this.props.nick } - ${ this.props.id }` }
                    <div
                        style = { styles.activeWrapper }
                    >
                        <Toggle
                            defaultToggled = { this.props.active }
                            label = { 'Active' }
                            onToggle = { this.handleActiveToggle }
                        />
                    </div>
                </h3>
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
    active: PropTypes.bool,
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
