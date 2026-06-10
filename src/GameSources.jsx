import React from 'react';
import PropTypes from 'prop-types';

import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
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
import LanguageIcon from '@mui/icons-material/Language';

// A type-aware editor for the per-game `sources` object:
//   { ServiceName: { allowedSections: [...], type, label, endpoint, disabled, ... } }
// Each source gets a tab; the selected source's fields are grouped into an
// identity header (name + routing type + enabled toggle), a Connection group
// (endpoint / label), a Sections group (allowed / disallowed sections as chip
// inputs), and an Advanced group (any custom keys + "Add field"). Every existing
// key is preserved and editable. The component is controlled: it never mutates
// props.sources, it emits a fresh object via onChange.
//
// `type` is the routing override read by BOTH pipelines: the legacy indexer
// (`indexer/modules/indexers/*`, matched by exact spelling minus spaces) and the
// new grunt/peon pipeline (queue-users lowercases/dashes it). The dropdown is
// constrained to this list — the union of both registries, using each registry's
// canonical spelling — so a custom-named source routes to a reader that exists.
const KNOWN_SOURCE_TYPES = [
    'BattleNet',
    'Bungie.net',
    'CommLink',
    'Discourse',
    'Instagram',
    'InvisionPowerBoard',
    'Reddit',
    'rsi',
    'RSS',
    'SimpleMachinesForum',
    'Steam',
    'Strapi',
    'Twitter',
    'XenForo',
];

const KNOWN_SOURCE_FIELDS = [
    { key: 'type', kind: 'type' },
    { key: 'label', kind: 'text' },
    { key: 'endpoint', kind: 'text' },
    { key: 'allowedSections', kind: 'list' },
    { key: 'disallowedSections', kind: 'list' },
    { key: 'disabled', kind: 'boolean' },
];

// Keys the editor models with a dedicated control somewhere in the layout
// (header / Connection / Sections). Anything NOT in this set is a custom key and
// falls through to the Advanced group's generic value-kind editor.
const STRUCTURED_KEYS = [ 'type', 'label', 'endpoint', 'allowedSections', 'disallowedSections', 'disabled' ];

// Keys with a dedicated control in the identity header, so they're never offered
// in the "Add field" menu. Everything else (endpoint, label, the section lists)
// is shown only when present and can be added on demand.
const ALWAYS_SHOWN_KEYS = [ 'type', 'disabled' ];

// The fields each source type actually needs to function, so adding a source
// seeds a usable starting point instead of either an empty shell or every
// possible field. Derived from the reader code in both pipelines (the legacy
// `indexer/modules/indexers/*` and the new `grunt/indexers/*`):
//   - endpoint: the readers that fetch from a URL bail out without it
//     (CommLink, Discourse, InvisionPowerBoard, RSS, SimpleMachinesForum,
//     Strapi, XenForo).
//   - allowedSections: Steam derives its app ID from allowedSections[0], so the
//     feed yields nothing until it's set.
//   - account-driven sources (Reddit, Twitter, Instagram, rsi, Bungie.net,
//     BattleNet) read no source config beyond `type` — the account identifier
//     drives them — so they seed nothing extra (e.g. Reddit gets no endpoint).
// Everything optional (label, section filters, Strapi field mappings, …) is
// left off and added on demand via "Add field".
const REQUIRED_FIELDS_BY_TYPE = {
    'BattleNet': [],
    'Bungie.net': [],
    'CommLink': [ 'endpoint' ],
    'Discourse': [ 'endpoint' ],
    'Instagram': [],
    'InvisionPowerBoard': [ 'endpoint' ],
    'Reddit': [],
    'RSS': [ 'endpoint' ],
    'rsi': [],
    'SimpleMachinesForum': [ 'endpoint' ],
    'Steam': [ 'allowedSections' ],
    'Strapi': [ 'endpoint' ],
    'Twitter': [],
    'XenForo': [ 'endpoint' ],
};

// Field rows hold a single value (an endpoint URL, a label, a section name), so
// cap them at a comfortable reading width instead of letting them stretch the
// full panel on wide desktop screens.
const FIELD_MAX_WIDTH = 480;

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

// What an endpoint means depends on the source type, so tailor the hint.
const endpointHelp = function endpointHelp ( type ) {
    if ( type === 'RSS' || type === 'CommLink' ) {
        return 'Feed URL';
    }

    if (
        type === 'Discourse'
        || type === 'XenForo'
        || type === 'InvisionPowerBoard'
        || type === 'SimpleMachinesForum'
    ) {
        return 'Forum base URL';
    }

    if ( type === 'Strapi' ) {
        return 'API base URL';
    }

    return 'Source URL';
};

const allowedSectionsHelp = function allowedSectionsHelp ( type ) {
    if ( type === 'Steam' ) {
        return 'Steam app ID(s).';
    }

    return 'Only index posts from these sections. Leave empty for all.';
};

// Canonical domains for the account-driven brands that have no `endpoint` to
// derive a favicon from. Forum/feed types (Discourse, XenForo, RSS, …) instead
// use their configured endpoint's host, so they're intentionally absent here.
const BRAND_DOMAINS = {
    'BattleNet': 'battle.net',
    'Bungie.net': 'bungie.net',
    'CommLink': 'robertsspaceindustries.com',
    'Instagram': 'instagram.com',
    'Reddit': 'reddit.com',
    'rsi': 'robertsspaceindustries.com',
    'Steam': 'steampowered.com',
    'Twitch': 'twitch.tv',
    'Twitter': 'x.com',
    'YouTube': 'youtube.com',
};

// The domain whose favicon best represents a source: its endpoint host when set
// (a forum/feed), else the brand domain for its type or name. False when nothing
// sensible maps (the avatar then falls back to the source's initial).
const faviconDomain = function faviconDomain ( service, serviceValue ) {
    if ( serviceValue.endpoint ) {
        try {
            const raw = String( serviceValue.endpoint );
            const url = new URL( raw.includes( '://' ) ? raw : `https://${ raw }` );

            if ( url.hostname ) {
                return url.hostname;
            }
        } catch {
            // Not a parseable URL yet (mid-typing) — fall back to the brand map.
        }
    }

    return BRAND_DOMAINS[ serviceValue.type ] || BRAND_DOMAINS[ service ] || false;
};

// Google's favicon service resolves a domain to its site icon; the Avatar shows
// the source's initial if the image 404s or the domain is unknown.
const faviconUrl = function faviconUrl ( domain ) {
    if ( !domain ) {
        return false;
    }

    return `https://www.google.com/s2/favicons?domain=${ encodeURIComponent( domain ) }&sz=64`;
};

// The non-structured keys on a source — what the Advanced group edits.
const customKeysOf = function customKeysOf ( serviceValue ) {
    return Object.keys( serviceValue || {} ).filter( ( key ) => {
        return !STRUCTURED_KEYS.includes( key );
    } );
};

class GameSources extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleAddService = this.handleAddService.bind( this );
        this.handleTabChange = this.handleTabChange.bind( this );

        this.state = {
            // currently selected source tab (by name)
            activeService: Object.keys( props.sources )[ 0 ] || false,
            // in-progress "add field" selection for the active source
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

    // Enabled is the inverse of the stored `disabled` flag. Turning a source back
    // on drops the key entirely rather than storing `disabled: false`, to keep
    // the saved config clean.
    toggleEnabled ( service, enabled ) {
        const next = Object.assign( {}, this.props.sources[ service ] );

        if ( enabled ) {
            delete next.disabled;
        } else {
            next.disabled = true;
        }

        this.updateService( service, next );
    }

    // Section chip inputs emit the whole list; trim/drop blanks, and remove the
    // key entirely when emptied so untouched sources don't accrue empty arrays.
    setSectionList ( service, key, list ) {
        const cleaned = list
            .map( ( item ) => {
                return String( item ).trim();
            } )
            .filter( Boolean );

        if ( cleaned.length === 0 ) {
            this.removeField( service, key );

            return;
        }

        this.updateField( service, key, cleaned );
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

        // Seed `type` (the routing field, set to the chosen source name) plus
        // only the fields this source type actually needs — see
        // REQUIRED_FIELDS_BY_TYPE. Optional fields are added on demand via
        // "Add field".
        const seeded = {
            type: name,
        };

        for ( const fieldKey of REQUIRED_FIELDS_BY_TYPE[ name ] || [] ) {
            const known = KNOWN_SOURCE_FIELDS.find( ( field ) => {
                return field.key === fieldKey;
            } );

            seeded[ fieldKey ] = defaultForKind( known ? known.kind : 'text' );
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

    // `first` drops the top margin so the first group in the settings column
    // lines up with the top of the meta column beside it.
    renderGroupHeader ( text, first ) {
        return (
            <Box
                sx = { {
                    mt: first
                        ? 0
                        : 2.5,
                } }
            >
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        display: 'block',
                        letterSpacing: 1,
                    } }
                    variant = { 'overline' }
                >
                    { text }
                </Typography>
                <Divider />
            </Box>
        );
    }

    // The left column: source identity (favicon, name, routing type) and the
    // source-level controls (enable / remove). Settings live in the right column.
    // Small favicon avatar shown on each source tab; falls back to the source's
    // initial when no icon resolves.
    renderSourceIcon ( service ) {
        const serviceValue = this.props.sources[ service ] || {};
        const icon = faviconUrl( faviconDomain( service, serviceValue ) );

        return (
            <Avatar
                src = { icon || undefined }
                sx = { {
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    color: 'text.secondary',
                    fontSize: 11,
                    height: 20,
                    width: 20,
                    '& .MuiAvatar-img': {
                        objectFit: 'contain',
                        padding: '2px',
                    },
                } }
                variant = { 'rounded' }
            >
                { String( service ).charAt( 0 ).toUpperCase() }
            </Avatar>
        );
    }

    // The left column: routing type, enable toggle and remove. The source's
    // favicon + name live on its tab, not here.
    renderIdentity ( service, serviceValue ) {
        const enabled = !serviceValue.disabled;

        // `type` is only a routing override; when it's absent both pipelines route
        // by the source name (the object key). So a source named after a known
        // type (e.g. "Steam") resolves to that same reader — surface the resolved
        // type, flagged "(by name)" when it's name-derived rather than explicit.
        const effectiveType = serviceValue.type
            || ( KNOWN_SOURCE_TYPES.includes( service )
                ? service
                : null );
        const typeText = effectiveType
            ? `Type: ${ effectiveType }${ serviceValue.type ? '' : ' (by name)' }`
            : 'Routes by source name';

        return (
            <Box
                sx = { {
                    alignItems: 'flex-start',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    gap: 1.5,
                    width: {
                        sm: 200,
                        xs: '100%',
                    },
                } }
            >
                <Typography
                    color = { 'text.secondary' }
                    noWrap
                    sx = { {
                        width: '100%',
                    } }
                    title = { typeText }
                    variant = { 'caption' }
                >
                    { typeText }
                </Typography>
                <FormControlLabel
                    control = {
                        <Switch
                            checked = { enabled }
                            onChange = { ( event, checked ) => {
                                this.toggleEnabled( service, checked );
                            } }
                        />
                    }
                    label = { 'Enabled' }
                />
                <Button
                    color = { 'error' }
                    onClick = { () => {
                        this.removeService( service );
                    } }
                    size = { 'small' }
                    startIcon = { <DeleteIcon /> }
                >
                    { 'Remove' }
                </Button>
            </Box>
        );
    }

    renderScalarField ( service, key, value, options ) {
        const settings = options || {};

        return (
            <Box
                key = { key }
                sx = { {
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: 0.5,
                    maxWidth: FIELD_MAX_WIDTH,
                    mt: 1.5,
                } }
            >
                <TextField
                    fullWidth
                    helperText = { settings.helperText }
                    label = { settings.label || key }
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
                    sx = { {
                        mt: 0.5,
                    } }
                >
                    <DeleteIcon
                        fontSize = { 'small' }
                    />
                </IconButton>
            </Box>
        );
    }

    // A chip input: type-and-Enter adds a value, the chip's × removes it. Used
    // for the section lists and any custom array-valued field.
    renderChipField ( service, key, values, options ) {
        const settings = options || {};

        return (
            <Box
                key = { key }
                sx = { {
                    maxWidth: FIELD_MAX_WIDTH,
                    mt: 1.5,
                } }
            >
                <Autocomplete
                    freeSolo
                    multiple
                    onChange = { ( event, newValue ) => {
                        this.setSectionList( service, key, newValue );
                    } }
                    options = { [] }
                    renderInput = { ( params ) => {
                        return (
                            <TextField
                                { ...params }
                                helperText = { settings.helperText }
                                label = { settings.label || key }
                                placeholder = { 'Type and press Enter' }
                                size = { 'small' }
                                variant = { 'outlined' }
                            />
                        );
                    } }
                    value = { Array.isArray( values ) ? values : [] }
                />
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

    // Generic editor for custom (non-structured) keys, dispatched by value type.
    renderField ( service, key, value ) {
        if ( Array.isArray( value ) ) {
            return this.renderChipField( service, key, value, {
                label: key,
            } );
        }

        if ( typeof value === 'boolean' ) {
            return this.renderBooleanField( service, key, value );
        }

        return this.renderScalarField( service, key, value );
    }

    // A titled group of field nodes. `first` aligns it to the top of the column.
    renderGroup ( title, nodes, first ) {
        return (
            <React.Fragment
                key = { title }
            >
                { this.renderGroupHeader( title, first ) }
                { nodes }
            </React.Fragment>
        );
    }

    connectionFields ( service, serviceValue ) {
        const fields = [];

        if ( serviceValue.endpoint !== undefined ) {
            fields.push( this.renderScalarField( service, 'endpoint', serviceValue.endpoint, {
                helperText: endpointHelp( serviceValue.type ),
                label: 'Endpoint',
            } ) );
        }

        if ( serviceValue.label !== undefined ) {
            fields.push( this.renderScalarField( service, 'label', serviceValue.label, {
                helperText: 'Display name shown on the site (optional)',
                label: 'Label',
            } ) );
        }

        return fields;
    }

    sectionFields ( service, serviceValue ) {
        const fields = [];

        if ( serviceValue.allowedSections !== undefined ) {
            fields.push( this.renderChipField( service, 'allowedSections', serviceValue.allowedSections, {
                helperText: allowedSectionsHelp( serviceValue.type ),
                label: 'Allowed sections',
            } ) );
        }

        if ( serviceValue.disallowedSections !== undefined ) {
            fields.push( this.renderChipField( service, 'disallowedSections', serviceValue.disallowedSections, {
                helperText: 'Skip posts from these sections.',
                label: 'Disallowed sections',
            } ) );
        }

        return fields;
    }

    // The known fields not yet present and not already shown elsewhere — the menu
    // of things you can add. freeSolo, so an unlisted custom key can be typed in.
    renderAddField ( service ) {
        const serviceValue = this.props.sources[ service ] || {};
        const available = KNOWN_SOURCE_FIELDS
            .filter( ( field ) => {
                return !ALWAYS_SHOWN_KEYS.includes( field.key )
                    && !Reflect.apply( {}.hasOwnProperty, serviceValue, [ field.key ] );
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

    // Any non-structured keys on the source, as field nodes (empty when none).
    customFieldNodes ( service, serviceValue ) {
        return customKeysOf( serviceValue ).map( ( key ) => {
            return this.renderField( service, key, serviceValue[ key ] );
        } );
    }

    renderPanel ( service ) {
        const serviceValue = this.props.sources[ service ] || {};

        // Only groups that actually have fields are shown; the first one drops its
        // top margin so it lines up with the meta column beside it.
        const groups = [
            [ 'Connection', this.connectionFields( service, serviceValue ) ],
            [ 'Sections', this.sectionFields( service, serviceValue ) ],
            [ 'Custom', this.customFieldNodes( service, serviceValue ) ],
        ].filter( ( group ) => {
            return group[ 1 ].length > 0;
        } );

        return (
            <Box
                sx = { {
                    display: 'flex',
                    flexDirection: {
                        sm: 'row',
                        xs: 'column',
                    },
                    gap: {
                        sm: 4,
                        xs: 2,
                    },
                    pt: 2,
                } }
            >
                { this.renderIdentity( service, serviceValue ) }
                <Box
                    sx = { {
                        flexGrow: 1,
                        maxWidth: FIELD_MAX_WIDTH,
                        minWidth: 0,
                    } }
                >
                    { groups.map( ( group, index ) => {
                        return this.renderGroup( group[ 0 ], group[ 1 ], index === 0 );
                    } ) }
                    { this.renderAddField( service ) }
                </Box>
            </Box>
        );
    }

    renderEmptyState () {
        return (
            <Box
                sx = { {
                    alignItems: 'center',
                    color: 'text.secondary',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    py: 4,
                } }
            >
                <LanguageIcon
                    sx = { {
                        fontSize: 40,
                        opacity: 0.4,
                    } }
                />
                <Typography
                    variant = { 'body2' }
                >
                    { 'No sources yet — add one to start indexing this game.' }
                </Typography>
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
                                        icon = { this.renderSourceIcon( service ) }
                                        iconPosition = { 'start' }
                                        key = { service }
                                        label = { service }
                                        sx = { {
                                            minHeight: 'auto',
                                            // Disabled sources read at a glance as dimmed tabs.
                                            opacity: this.props.sources[ service ].disabled
                                                ? 0.5
                                                : 1,
                                        } }
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
                    : this.renderEmptyState() }
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
