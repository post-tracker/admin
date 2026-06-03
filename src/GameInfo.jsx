import React from 'react';
import PropTypes from 'prop-types';

import Paper from '@mui/material/Paper';

import GameField from './GameField.jsx';

const styles = {
    basicFieldsWrapper: {
        flexGrow: 1,
        marginRight: '30px',
    },
    configWrapper: {
        flexGrow: 10,
    },
    wrapper: {
        display: 'flex',
        justifyContent: 'space-between',
        margin: '15px 40px',
        padding: '15px 30px',
        position: 'relative',
    },
};

class GameInfo extends React.PureComponent {
    getGameFields () {
        const gameFields = [];

        Object.keys( this.props ).forEach( ( key ) => {
            const extraProps = {};

            if ( key === 'id' || key === 'config' ) {
                return true;
            }

            if ( key === 'identifier' ) {
                extraProps.disabled = true;
            }

            gameFields.push(
                <GameField
                    { ...extraProps }
                    displayName = { key }
                    identifier = { this.props.identifier }
                    key = { `developer-field-${ key }-${ this.props[ key ] }` }
                    name = { key }
                    value = { this.props[ key ] }
                />
            );

            return true;
        } );

        return gameFields;
    }

    render () {
        return (
            <Paper
                elevation = { 1 }
                square
                style = { styles.wrapper }
            >
                <div
                    style = { styles.basicFieldsWrapper }
                >
                    { this.getGameFields() }
                </div>
                <GameField
                    displayName = { 'Config' }
                    identifier = { this.props.identifier }
                    json
                    key = { `developer-field-config-${ this.props.identifier }` }
                    name = { 'config' }
                    style = { styles.configWrapper }
                    value = { this.props.config }
                />
            </Paper>
        );
    }
}

GameInfo.displayName = 'GameInfo';

GameInfo.propTypes = {
    config: PropTypes.object,
    hostname: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    identifier: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    shortName: PropTypes.string.isRequired,
};

export default GameInfo;
