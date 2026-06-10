import React from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import BoxartPicker from './BoxartPicker.jsx';
import GameSources from './GameSources.jsx';
import api from './api.js';

// config keys this panel models with dedicated controls; everything else lives
// in the Advanced raw-JSON editor and is preserved untouched on save.
const KNOWN_CONFIG_KEYS = [ 'boxart', 'live', 'defaultTheme', 'sources' ];

// Editable top-level game columns. `identifier` is the key (shown read-only)
// and `id`/`config`/`hostname` are handled separately (hostname is no longer
// edited here — every game uses developertracker.com).
const TEXT_FIELDS = [
    {
        key: 'name',
        label: 'Name',
    },
    {
        key: 'shortName',
        label: 'Short name',
    },
];

const styles = {
    boxartThumb: {
        borderRadius: 4,
        display: 'block',
        height: 56,
        width: 'auto',
    },
};

class GameInfo extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleLiveToggle = this.handleLiveToggle.bind( this );
        this.handleThemeChange = this.handleThemeChange.bind( this );
        this.handleAdvancedChange = this.handleAdvancedChange.bind( this );
        this.handleToggleAdvanced = this.handleToggleAdvanced.bind( this );
        this.handleBoxartError = this.handleBoxartError.bind( this );
        this.handleSourcesChange = this.handleSourcesChange.bind( this );
        this.handleReset = this.handleReset.bind( this );
        this.handleSave = this.handleSave.bind( this );

        this.state = this.buildState( props );
    }

    componentDidUpdate ( prevProps ) {
        // Rebuild on game switch, or when fresh data lands and we have no
        // unsaved edits (e.g. the refetch triggered by our own save).
        const gameChanged = prevProps.identifier !== this.props.identifier;
        const dataChanged = prevProps !== this.props;

        if ( gameChanged || ( dataChanged && !this.state.dirty ) ) {
            this.setState( this.buildState( this.props ) );
        }
    }

    buildState ( props ) {
        const config = props.config || {};
        const remainder = {};

        Object.keys( config ).forEach( ( key ) => {
            if ( !KNOWN_CONFIG_KEYS.includes( key ) ) {
                remainder[ key ] = config[ key ];
            }
        } );

        return {
            advancedError: false,
            advancedOpen: false,
            advancedText: JSON.stringify( remainder, null, 4 ),
            boxart: config.boxart || '',
            defaultTheme: config.defaultTheme || '',
            dirty: false,
            // Absence of `live` means the game is live; only an explicit 0/false
            // marks it offline (matches site/build.js and rest-api consumers).
            live: !( config.live === 0 || config.live === false ),
            name: props.name || '',
            shortName: props.shortName || '',
            // Deep-cloned so the editor never mutates the incoming config.
            sources: config.sources ? JSON.parse( JSON.stringify( config.sources ) ) : {},
        };
    }

    handleFieldChange ( key, value ) {
        this.setState( {
            [ key ]: value,
            dirty: true,
        } );
    }

    handleLiveToggle ( event, checked ) {
        this.setState( {
            dirty: true,
            live: checked,
        } );
    }

    handleThemeChange ( event ) {
        this.setState( {
            defaultTheme: event.target.value,
            dirty: true,
        } );
    }

    handleAdvancedChange ( event ) {
        const text = event.target.value;
        let advancedError = false;

        try {
            JSON.parse( text );
        } catch {
            advancedError = 'invalid json';
        }

        this.setState( {
            advancedError: advancedError,
            advancedText: text,
            dirty: true,
        } );
    }

    handleToggleAdvanced () {
        this.setState( {
            advancedOpen: !this.state.advancedOpen,
        } );
    }

    handleBoxartError ( event ) {
        event.target.style.visibility = 'hidden';
    }

    handleSourcesChange ( sources ) {
        this.setState( {
            dirty: true,
            sources: sources,
        } );
    }

    handleReset () {
        this.setState( this.buildState( this.props ) );
    }

    handleSave () {
        let remainder;

        try {
            remainder = JSON.parse( this.state.advancedText );
        } catch {
            this.setState( {
                advancedError: 'invalid json',
                advancedOpen: true,
            } );

            return;
        }

        // Start from the parsed remainder so `sources` and any unknown keys are
        // carried over verbatim, then overlay the modeled keys.
        const config = Object.assign( {}, remainder );

        config.boxart = this.state.boxart;

        // Live is the default, so keep config clean by only persisting the
        // explicit offline state.
        if ( this.state.live ) {
            delete config.live;
        } else {
            config.live = 0;
        }

        if ( this.state.defaultTheme ) {
            config.defaultTheme = this.state.defaultTheme;
        } else {
            delete config.defaultTheme;
        }

        if ( Object.keys( this.state.sources ).length > 0 ) {
            config.sources = this.state.sources;
        } else {
            delete config.sources;
        }

        api.patch( `/games/${ this.props.identifier }`, this.props.identifier, {
            config: config,
            name: this.state.name,
            shortName: this.state.shortName,
        } )
            .then( () => {
                this.setState( {
                    dirty: false,
                } );

                window.snackbarText = 'Game saved';
                window.dispatchEvent( new Event( 'open-snackbar' ) );
                window.dispatchEvent( new Event( 'games-update' ) );
            } )
            .catch( ( error ) => {
                window.snackbarText = error.message;
                window.dispatchEvent( new Event( 'open-snackbar' ) );
            } );
    }

    renderTextField ( field ) {
        return (
            <TextField
                key = { field.key }
                label = { field.label }
                onChange = { ( event ) => {
                    this.handleFieldChange( field.key, event.target.value );
                } }
                size = { 'small' }
                value = { this.state[ field.key ] }
                variant = { 'outlined' }
            />
        );
    }

    render () {
        const fieldGridSx = {
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
                md: 'repeat(4, 1fr)',
                sm: '1fr 1fr',
                xs: '1fr',
            },
        };

        return (
            <Paper
                elevation = { 2 }
                sx = { {
                    m: {
                        md: '15px 40px',
                        xs: '8px',
                    },
                    overflow: 'hidden',
                } }
            >
                <Box
                    sx = { {
                        alignItems: 'center',
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        gap: 2,
                        p: 2,
                    } }
                >
                    { this.state.boxart &&
                        <img
                            key = { this.state.boxart }
                            onError = { this.handleBoxartError }
                            src = { this.state.boxart }
                            style = { styles.boxartThumb }
                        />
                    }
                    <Box
                        sx = { {
                            flexGrow: 1,
                            minWidth: 0,
                        } }
                    >
                        <Typography
                            noWrap
                            variant = { 'h6' }
                        >
                            { this.state.name || this.props.identifier }
                        </Typography>
                        <Typography
                            color = { 'text.secondary' }
                            noWrap
                            variant = { 'body2' }
                        >
                            { this.props.identifier }
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control = {
                            <Switch
                                checked = { this.state.live }
                                color = { 'success' }
                                onChange = { this.handleLiveToggle }
                            />
                        }
                        label = { this.state.live ? 'Indexing' : 'Disabled' }
                        labelPlacement = { 'start' }
                    />
                </Box>
                <Box
                    sx = { {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        p: 2,
                    } }
                >
                    <Box
                        sx = { fieldGridSx }
                    >
                        { this.renderTextField( TEXT_FIELDS[ 0 ] ) }
                        { this.renderTextField( TEXT_FIELDS[ 1 ] ) }
                        <TextField
                            disabled
                            label = { 'Identifier' }
                            size = { 'small' }
                            value = { this.props.identifier }
                            variant = { 'outlined' }
                        />
                        <TextField
                            label = { 'Default theme' }
                            onChange = { this.handleThemeChange }
                            select
                            size = { 'small' }
                            value = { this.state.defaultTheme }
                            variant = { 'outlined' }
                        >
                            <MenuItem value = { '' }>
                                { 'None' }
                            </MenuItem>
                            <MenuItem value = { 'dark' }>
                                { 'Dark' }
                            </MenuItem>
                            <MenuItem value = { 'light' }>
                                { 'Light' }
                            </MenuItem>
                        </TextField>
                    </Box>
                    <BoxartPicker
                        key = { this.props.identifier }
                        onChange = { ( url ) => {
                            this.handleFieldChange( 'boxart', url );
                        } }
                        value = { this.state.boxart }
                    />
                    <GameSources
                        onChange = { this.handleSourcesChange }
                        sources = { this.state.sources }
                    />
                    <Box>
                        <Button
                            color = { 'inherit' }
                            onClick = { this.handleToggleAdvanced }
                            size = { 'small' }
                            startIcon = { this.state.advancedOpen
                                ? <ExpandLessIcon />
                                : <ExpandMoreIcon /> }
                        >
                            { 'Advanced (raw JSON)' }
                        </Button>
                        <Collapse
                            in = { this.state.advancedOpen }
                        >
                            <TextField
                                error = { Boolean( this.state.advancedError ) }
                                fullWidth
                                helperText = { this.state.advancedError || 'Any other config keys not shown above' }
                                multiline
                                onChange = { this.handleAdvancedChange }
                                rows = { 11 }
                                size = { 'small' }
                                sx = { {
                                    mt: 1,
                                } }
                                value = { this.state.advancedText }
                                variant = { 'outlined' }
                            />
                        </Collapse>
                    </Box>
                </Box>
                <Box
                    sx = { {
                        borderColor: 'divider',
                        borderTop: 1,
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                        p: 2,
                    } }
                >
                    <Button
                        disabled = { !this.state.dirty }
                        onClick = { this.handleReset }
                    >
                        { 'Reset' }
                    </Button>
                    <Button
                        disabled = { !this.state.dirty || Boolean( this.state.advancedError ) }
                        onClick = { this.handleSave }
                        variant = { 'contained' }
                    >
                        { 'Save changes' }
                    </Button>
                </Box>
            </Paper>
        );
    }
}

GameInfo.displayName = 'GameInfo';

GameInfo.propTypes = {
    config: PropTypes.object,
    identifier: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    shortName: PropTypes.string.isRequired,
};

export default GameInfo;
