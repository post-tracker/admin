import React from 'react';
import PropTypes from 'prop-types';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

// A type-aware editor for the per-game `sources` object:
//   { ServiceName: { allowedSections: [...], type, label, endpoint, disabled, ... } }
// Each service gets a tab; the selected service's fields render by value type —
// arrays as a tag input (chips + type-to-add), booleans as switches, scalars as
// text inputs. Every existing key is preserved and editable. The component is
// controlled: it never mutates props.sources, it emits a fresh object via
// onChange.
//
// The option fields available to add to any source (the same set across all
// custom sources on all games). `kind` drives both the seeded default and the
// input rendered for it. A custom (generic-reader) source is identified by
// `type`; e.g. a Strapi news source sets `type: "Strapi"` plus `endpoint` /
// `articleUrl` and, optionally, which attribute holds the title/date/body.
// The recognised source types — `type` is a dropdown constrained to these so a
// custom-named source routes to a reader that actually exists. `type` is the
// routing override read by BOTH pipelines: the legacy indexer
// (`modules/indexers/index.js`, matched by exact spelling minus spaces) and the
// new grunt/peon pipeline (queue-users lowercases/dashes it). The list is the
// union of both registries; values use each registry's canonical spelling.
const KNOWN_SOURCE_TYPES = [
    'BattleNet',
    'Bungie.net',
    'CommLink',
    'Discourse',
    'Instagram',
    'InvisionPowerBoard',
    'rsi',
    'RSS',
    'SimpleMachinesForum',
    'Steam',
    'Strapi',
    'Twitter',
];

const KNOWN_SOURCE_FIELDS = [
    { key: 'type', kind: 'type' },
    { key: 'label', kind: 'text' },
    { key: 'endpoint', kind: 'text' },
    { key: 'allowedSections', kind: 'list' },
    { key: 'disallowedSections', kind: 'list' },
    { key: 'disabled', kind: 'boolean' },
];

const defaultForKind = function defaultForKind ( kind ) {
    if ( kind === 'list' ) {
        return [];
    }

    if ( kind === 'boolean' ) {
        return false;
    }

    if ( kind === 'type' ) {
        return KNOWN_SOURCE_TYPES[ 0 ];
    }

    return '';
};

class GameSources extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleAddService = this.handleAddService.bind( this );
        this.handleTabChange = this.handleTabChange.bind( this );

        this.state = {
            // currently selected service tab (by name)
            activeService: Object.keys( props.sources )[ 0 ] || false,
            // in-progress "add field" selection for the active service
            newField: '',
            newService: '',
        };
    }

    getCurrentService () {
        const services = Object.keys( this.props.sources );

        if ( services.includes( this.state.activeService ) ) {
            return this.state.activeService;
        }

        return services[ 0 ] || false;
    }

    updateService ( service, serviceValue ) {
        this.props.onChange( Object.assign( {}, this.props.sources, {
            [ service ]: serviceValue,
        } ) );
    }

    updateField ( service, key, value ) {
        this.updateService( service, Object.assign( {}, this.props.sources[ service ], {
            [ key ]: value,
        } ) );
    }

    updateArrayItem ( service, key, index, value ) {
        const next = ( this.props.sources[ service ][ key ] || [] ).slice();

        next[ index ] = value;

        this.updateField( service, key, next );
    }

    addArrayItem ( service, key ) {
        const current = this.props.sources[ service ][ key ] || [];

        this.updateField( service, key, [ ...current, '' ] );
    }

    removeArrayItem ( service, key, index ) {
        const current = this.props.sources[ service ][ key ] || [];

        this.updateField( service, key, current.filter( ( item, itemIndex ) => {
            return itemIndex !== index;
        } ) );
    }

    removeField ( service, key ) {
        const next = Object.assign( {}, this.props.sources[ service ] );

        delete next[ key ];

        this.updateService( service, next );
    }

    removeService ( service ) {
        const next = Object.assign( {}, this.props.sources );

        delete next[ service ];

        this.props.onChange( next );

        this.setState( {
            activeService: Object.keys( next )[ 0 ] || false,
        } );
    }

    handleTabChange ( event, value ) {
        this.setState( {
            activeService: value,
            newField: '',
        } );
    }

    handleAddService () {
        const name = this.state.newService.trim();

        if ( !name || this.props.sources[ name ] ) {
            return;
        }

        // Seed every known field with its type-appropriate default so a new
        // source shows the full form up front. The source is keyed by its
        // type, so seed `type` to the chosen value. Unwanted fields can be
        // removed, custom ones still added via "Add field".
        const seeded = {};

        for ( const field of KNOWN_SOURCE_FIELDS ) {
            seeded[ field.key ] = field.key === 'type' ? name : defaultForKind( field.kind );
        }

        this.updateService( name, seeded );

        this.setState( {
            activeService: name,
            newService: '',
        } );
    }

    handleAddField ( service ) {
        const key = this.state.newField.trim();

        if ( !key || Reflect.apply( {}.hasOwnProperty, this.props.sources[ service ], [ key ] ) ) {
            return;
        }

        // Known options seed the matching input type; an unlisted key falls back
        // to a plain text field.
        const known = KNOWN_SOURCE_FIELDS.find( ( field ) => {
            return field.key === key;
        } );

        this.updateField( service, key, defaultForKind( known ? known.kind : 'text' ) );

        this.setState( {
            newField: '',
        } );
    }

    renderArrayField ( service, key, values ) {
        return (
            <Box
                key = { key }
                sx = { {
                    mt: 1.5,
                } }
            >
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'caption' }
                >
                    { key }
                </Typography>
                <Box
                    sx = { {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        mt: 0.5,
                    } }
                >
                    { values.map( ( value, index ) => {
                        return (
                            <Box
                                key = { index }
                                sx = { {
                                    alignItems: 'center',
                                    display: 'flex',
                                    gap: 0.5,
                                } }
                            >
                                <TextField
                                    fullWidth
                                    onChange = { ( event ) => {
                                        this.updateArrayItem( service, key, index, event.target.value );
                                    } }
                                    size = { 'small' }
                                    value = { value === null || value === undefined ? '' : String( value ) }
                                    variant = { 'outlined' }
                                />
                                <IconButton
                                    onClick = { () => {
                                        this.removeArrayItem( service, key, index );
                                    } }
                                    size = { 'small' }
                                >
                                    <DeleteIcon
                                        fontSize = { 'small' }
                                    />
                                </IconButton>
                            </Box>
                        );
                    } ) }
                    <Box>
                        <Button
                            onClick = { () => {
                                this.addArrayItem( service, key );
                            } }
                            size = { 'small' }
                            startIcon = { <AddIcon /> }
                        >
                            { 'Add' }
                        </Button>
                    </Box>
                </Box>
            </Box>
        );
    }

    renderBooleanField ( service, key, value ) {
        return (
            <Box
                key = { key }
                sx = { {
                    alignItems: 'center',
                    display: 'flex',
                    mt: 1,
                } }
            >
                <FormControlLabel
                    control = {
                        <Switch
                            checked = { Boolean( value ) }
                            onChange = { ( event, checked ) => {
                                this.updateField( service, key, checked );
                            } }
                            size = { 'small' }
                        />
                    }
                    label = { key }
                />
                <IconButton
                    onClick = { () => {
                        this.removeField( service, key );
                    } }
                    size = { 'small' }
                >
                    <DeleteIcon
                        fontSize = { 'small' }
                    />
                </IconButton>
            </Box>
        );
    }

    renderTypeField ( service, key, value ) {
        return (
            <Box
                key = { key }
                sx = { {
                    alignItems: 'center',
                    display: 'flex',
                    gap: 0.5,
                    mt: 1.5,
                } }
            >
                <TextField
                    fullWidth
                    label = { key }
                    onChange = { ( event ) => {
                        this.updateField( service, key, event.target.value );
                    } }
                    select
                    size = { 'small' }
                    value = { value === null || value === undefined ? '' : String( value ) }
                    variant = { 'outlined' }
                >
                    { KNOWN_SOURCE_TYPES.map( ( typeName ) => {
                        return (
                            <MenuItem
                                key = { typeName }
                                value = { typeName }
                            >
                                { typeName }
                            </MenuItem>
                        );
                    } ) }
                </TextField>
                <IconButton
                    onClick = { () => {
                        this.removeField( service, key );
                    } }
                    size = { 'small' }
                >
                    <DeleteIcon
                        fontSize = { 'small' }
                    />
                </IconButton>
            </Box>
        );
    }

    renderScalarField ( service, key, value ) {
        return (
            <Box
                key = { key }
                sx = { {
                    alignItems: 'center',
                    display: 'flex',
                    gap: 0.5,
                    mt: 1.5,
                } }
            >
                <TextField
                    fullWidth
                    label = { key }
                    onChange = { ( event ) => {
                        this.updateField( service, key, event.target.value );
                    } }
                    size = { 'small' }
                    value = { value === null || value === undefined ? '' : String( value ) }
                    variant = { 'outlined' }
                />
                <IconButton
                    onClick = { () => {
                        this.removeField( service, key );
                    } }
                    size = { 'small' }
                >
                    <DeleteIcon
                        fontSize = { 'small' }
                    />
                </IconButton>
            </Box>
        );
    }

    renderField ( service, key, value ) {
        if ( key === 'type' ) {
            return this.renderTypeField( service, key, value );
        }

        if ( Array.isArray( value ) ) {
            return this.renderArrayField( service, key, value );
        }

        if ( typeof value === 'boolean' ) {
            return this.renderBooleanField( service, key, value );
        }

        return this.renderScalarField( service, key, value );
    }

    // The option fields not yet present on this source — the menu of things you
    // can add. freeSolo, so an unlisted key can still be typed in.
    renderAddField ( service ) {
        const serviceValue = this.props.sources[ service ] || {};
        const available = KNOWN_SOURCE_FIELDS
            .filter( ( field ) => {
                return !Reflect.apply( {}.hasOwnProperty, serviceValue, [ field.key ] );
            } )
            .map( ( field ) => {
                return field.key;
            } );

        return (
            <Box
                sx = { {
                    alignItems: 'center',
                    display: 'flex',
                    gap: 1,
                    mt: 2,
                } }
            >
                <Autocomplete
                    filterOptions = { ( options ) => {
                        return options;
                    } }
                    freeSolo
                    inputValue = { this.state.newField }
                    onInputChange = { ( event, value ) => {
                        this.setState( {
                            newField: value || '',
                        } );
                    } }
                    openOnFocus
                    options = { available }
                    renderInput = { ( params ) => {
                        return (
                            <TextField
                                { ...params }
                                label = { 'Add field' }
                                size = { 'small' }
                                variant = { 'outlined' }
                            />
                        );
                    } }
                    sx = { {
                        width: 220,
                    } }
                />
                <Button
                    onClick = { () => {
                        this.handleAddField( service );
                    } }
                    size = { 'small' }
                    startIcon = { <AddIcon /> }
                >
                    { 'Add field' }
                </Button>
            </Box>
        );
    }

    renderPanel ( service ) {
        const serviceValue = this.props.sources[ service ] || {};

        return (
            <Box
                sx = { {
                    pt: 2,
                } }
            >
                <Box
                    sx = { {
                        display: 'flex',
                        justifyContent: 'flex-end',
                    } }
                >
                    <Button
                        color = { 'error' }
                        onClick = { () => {
                            this.removeService( service );
                        } }
                        size = { 'small' }
                        startIcon = { <DeleteIcon /> }
                    >
                        { 'Remove source' }
                    </Button>
                </Box>
                { Object.keys( serviceValue ).map( ( key ) => {
                    return this.renderField( service, key, serviceValue[ key ] );
                } ) }
                { this.renderAddField( service ) }
            </Box>
        );
    }

    render () {
        const services = Object.keys( this.props.sources );
        const currentService = this.getCurrentService();

        // Types not yet used as a source key on this game — the menu of sources
        // you can still add (each source is keyed by its type, so a type can
        // only be added once).
        const availableTypes = KNOWN_SOURCE_TYPES.filter( ( typeName ) => {
            return !Reflect.apply( {}.hasOwnProperty, this.props.sources, [ typeName ] );
        } );

        return (
            <Box>
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        display: 'block',
                        letterSpacing: 1,
                        mb: 1,
                    } }
                    variant = { 'overline' }
                >
                    { 'Sources' }
                </Typography>
                <Box
                    sx = { {
                        alignItems: 'center',
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                    } }
                >
                    { services.length > 0
                        ? <Tabs
                            onChange = { this.handleTabChange }
                            scrollButtons = { 'auto' }
                            sx = { {
                                flexGrow: 1,
                                minHeight: 'auto',
                                minWidth: 0,
                                '& .MuiTab-root': {
                                    textTransform: 'none',
                                },
                            } }
                            value = { currentService }
                            variant = { 'scrollable' }
                        >
                            { services.map( ( service ) => {
                                return (
                                    <Tab
                                        key = { service }
                                        label = { service }
                                        value = { service }
                                    />
                                );
                            } ) }
                        </Tabs>
                        : <Box
                            sx = { {
                                flexGrow: 1,
                            } }
                        />
                    }
                    <Box
                        sx = { {
                            alignItems: 'center',
                            display: 'flex',
                            flexShrink: 0,
                            gap: 1,
                            py: 0.5,
                        } }
                    >
                        <TextField
                            disabled = { availableTypes.length === 0 }
                            label = { 'New source' }
                            onChange = { ( event ) => {
                                this.setState( {
                                    newService: event.target.value,
                                } );
                            } }
                            select
                            size = { 'small' }
                            sx = { {
                                width: 160,
                            } }
                            value = { this.state.newService }
                            variant = { 'outlined' }
                        >
                            { availableTypes.map( ( typeName ) => {
                                return (
                                    <MenuItem
                                        key = { typeName }
                                        value = { typeName }
                                    >
                                        { typeName }
                                    </MenuItem>
                                );
                            } ) }
                        </TextField>
                        <Button
                            disabled = { !this.state.newService }
                            onClick = { this.handleAddService }
                            startIcon = { <AddIcon /> }
                        >
                            { 'Add' }
                        </Button>
                    </Box>
                </Box>
                { services.length > 0
                    ? this.renderPanel( currentService )
                    : <Typography
                        color = { 'text.secondary' }
                        sx = { {
                            mt: 2,
                        } }
                        variant = { 'body2' }
                    >
                        { 'No sources yet.' }
                    </Typography>
                }
            </Box>
        );
    }
}

GameSources.displayName = 'GameSources';

GameSources.defaultProps = {
    sources: {},
};

GameSources.propTypes = {
    onChange: PropTypes.func.isRequired,
    sources: PropTypes.object,
};

export default GameSources;
