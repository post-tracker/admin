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
            // Which inline field (name / shortName) is currently being edited.
            editingField: false,
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

    // Small uppercase caption that names a value (so it's clear what an inline
    // field or read-only value represents).
    renderFieldLabel ( text ) {
        return (
            <Typography
                color = { 'text.secondary' }
                component = { 'div' }
                sx = { {
                    fontSize: '0.7rem',
                    letterSpacing: 0.5,
                    lineHeight: 1.4,
                    textTransform: 'uppercase',
                } }
            >
                { text }
            </Typography>
        );
    }

    // Inline-editable text: renders a label, then the value as clickable text
    // that swaps to a field while editing. Enter / Escape / blur ends editing;
    // the value is kept live in state as it's typed (which marks the form dirty).
    renderEditableField ( field, options ) {
        const settings = options || {};
        const value = this.state[ field ];

        const inner = this.state.editingField === field
            ? (
                <TextField
                    autoFocus
                    onBlur = { () => {
                        this.setState( {
                            editingField: false,
                        } );
                    } }
                    onChange = { ( event ) => {
                        this.handleFieldChange( field, event.target.value );
                    } }
                    onKeyDown = { ( event ) => {
                        if ( event.key === 'Enter' || event.key === 'Escape' ) {
                            event.target.blur();
                        }
                    } }
                    placeholder = { settings.placeholder }
                    size = { 'small' }
                    value = { value }
                    variant = { 'standard' }
                />
            )
            : (
                <Typography
                    color = { settings.color }
                    noWrap
                    onClick = { () => {
                        this.setState( {
                            editingField: field,
                        } );
                    } }
                    sx = { {
                        borderRadius: 1,
                        cursor: 'text',
                        mx: -0.5,
                        px: 0.5,
                        '&:hover': {
                            bgcolor: 'action.hover',
                        },
                    } }
                    title = { 'Click to edit' }
                    variant = { settings.variant }
                >
                    { value || settings.placeholder }
                </Typography>
            );

        return (
            <Box>
                { settings.label && this.renderFieldLabel( settings.label ) }
                { inner }
            </Box>
        );
    }

    render () {
        return (
            <Box
                sx = { {
                    m: {
                        md: '15px 40px',
                        xs: '8px',
                    },
                } }
            >
                <Paper
                    elevation = { 2 }
                    sx = { {
                        overflow: 'hidden',
                    } }
                >
                    <Box
                        sx = { {
                            alignItems: 'center',
                            borderBottom: 1,
                            borderColor: 'divider',
                            display: 'flex',
                            flexWrap: 'wrap',
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
                            { this.renderEditableField( 'name', {
                                label: 'Name',
                                placeholder: this.props.identifier,
                                variant: 'h6',
                            } ) }
                            <Box
                                sx = { {
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 3,
                                    mt: 0.5,
                                } }
                            >
                                { this.renderEditableField( 'shortName', {
                                    color: 'text.secondary',
                                    label: 'Short name',
                                    placeholder: '—',
                                    variant: 'body2',
                                } ) }
                                <Box>
                                    { this.renderFieldLabel( 'Identifier' ) }
                                    <Typography
                                        color = { 'text.secondary' }
                                        noWrap
                                        variant = { 'body2' }
                                    >
                                        { this.props.identifier }
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                        <BoxartPicker
                            key = { this.props.identifier }
                            onChange = { ( url ) => {
                                this.handleFieldChange( 'boxart', url );
                            } }
                            value = { this.state.boxart }
                        />
                        <TextField
                            label = { 'Default theme' }
                            onChange = { this.handleThemeChange }
                            select
                            size = { 'small' }
                            sx = { {
                                flexShrink: 0,
                                width: 150,
                            } }
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
                            sx = { {
                                flexShrink: 0,
                                ml: 0,
                            } }
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
                </Paper>
                <Paper
                    elevation = { 2 }
                    sx = { {
                        mt: 2,
                        p: 2,
                    } }
                >
                    <GameSources
                        onChange = { this.handleSourcesChange }
                        sources = { this.state.sources }
                    />
                </Paper>
                <Box
                    sx = { {
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                        mt: 2,
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
            </Box>
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
