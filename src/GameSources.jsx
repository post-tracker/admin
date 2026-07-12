import React from 'react';
import PropTypes from 'prop-types';

import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import SearchIcon from '@mui/icons-material/Search';

import RedditFlairEditor from './RedditFlairEditor.jsx';

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
    'Bluesky',
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
// `flair` is the per-subreddit Reddit flair config; it has its own editor
// (RedditFlairEditor) rather than the generic value editors, so it's treated as
// structured to keep it out of the Custom group and the "Add field" menu.
// `appId` is Steam's numeric forum-scrape id, edited by the dedicated Steam
// fields, so it's structured for the same reason.
const STRUCTURED_KEYS = [ 'type', 'label', 'endpoint', 'allowedSections', 'disallowedSections', 'disabled', 'flair', 'appId' ];

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
//     feed yields nothing until it's set. Reddit also filters on it (the
//     subreddit whitelist, via validate-post), so it's seeded there too as a
//     starting point — empty means "all", matching Steam's section semantics.
//   - the remaining account-driven sources (Twitter, Instagram, rsi, Bungie.net,
//     BattleNet) read no source config beyond `type` — the account identifier
//     drives them — so they seed nothing extra (e.g. they get no endpoint).
// Everything optional (label, extra section filters, Strapi field mappings, …)
// is left off and added on demand via "Add field".
const REQUIRED_FIELDS_BY_TYPE = {
    'BattleNet': [],
    'Bluesky': [],
    'Bungie.net': [],
    'CommLink': [ 'endpoint' ],
    'Discourse': [ 'endpoint' ],
    'Instagram': [],
    'InvisionPowerBoard': [ 'endpoint' ],
    'Reddit': [ 'allowedSections' ],
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
        // The announcements feed (/games/<id>/rss/) is keyed on the community hub
        // id: the numeric app ID for most games, but the custom community URL name
        // for games that set one (e.g. elite, arma-3, squad) — their numeric feed
        // is empty. The forum scrape uses the separate Forum app ID below.
        return 'Community hub id for announcements: the numeric app ID, or the custom community URL name if the game has one (e.g. EliteDangerous).';
    }

    if ( type === 'Reddit' ) {
        return 'Only index posts from these subreddits. Leave empty for all.';
    }

    return 'Only index posts from these sections. Leave empty for all.';
};

// Canonical domains for the account-driven brands that have no `endpoint` to
// derive a favicon from. Forum/feed types (Discourse, XenForo, RSS, …) instead
// use their configured endpoint's host, so they're intentionally absent here.
const BRAND_DOMAINS = {
    'BattleNet': 'battle.net',
    'Bluesky': 'bsky.app',
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
        this.lookupSteamAppId = this.lookupSteamAppId.bind( this );
        this.searchSteam = this.searchSteam.bind( this );
        this.selectSteamGame = this.selectSteamGame.bind( this );

        this.state = {
            // currently selected source tab (by name)
            activeService: Object.keys( props.sources )[ 0 ] || false,
            // in-progress "add field" selection for the active source
            newField: '',
            newService: '',
            // Steam app-id lookup feedback for the active source (reset on tab change).
            steamLookupBusy: false,
            steamLookupStatus: '',
            // Steam name-search picker state for the active source (reset on tab change).
            steamSearchQuery: '',
            steamSearchResults: [],
            steamSearchBusy: false,
            // Pending (uncommitted) chip-field text, keyed by `${service}:${key}`.
            // Mobile keyboards send "Next"/Tab (a blur) instead of Enter, so the
            // Autocomplete never commits the typed value and focus tabs away with
            // the input lost. We track the in-progress text and commit it on blur.
            chipInputs: {},
        };
    }

    chipInputKey ( service, key ) {
        return `${ service }:${ key }`;
    }

    // Append whatever the user has typed but not yet committed (no Enter press,
    // e.g. mobile "Next" button) to the chip list. Splits on commas so a
    // comma-separated paste becomes multiple chips.
    commitPendingChip ( service, key, values ) {
        const inputKey = this.chipInputKey( service, key );
        const pending = ( this.state.chipInputs[ inputKey ] || '' ).trim();

        if ( pending.length === 0 ) {
            return;
        }

        const additions = pending
            .split( ',' )
            .map( ( item ) => {
                return item.trim();
            } )
            .filter( Boolean );

        const current = Array.isArray( values ) ? values : [];

        this.setState( ( state ) => {
            return {
                chipInputs: Object.assign( {}, state.chipInputs, {
                    [ inputKey ]: '',
                } ),
            };
        } );

        if ( additions.length > 0 ) {
            this.setSectionList( service, key, current.concat( additions ) );
        }
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
            // The lookup/search feedback is for the source being left; clear it.
            steamLookupBusy: false,
            steamLookupStatus: '',
            steamSearchQuery: '',
            steamSearchResults: [],
            steamSearchBusy: false,
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
                    inputValue = { this.state.chipInputs[ this.chipInputKey( service, key ) ] || '' }
                    onInputChange = { ( event, newInputValue ) => {
                        const inputKey = this.chipInputKey( service, key );

                        this.setState( ( state ) => {
                            return {
                                chipInputs: Object.assign( {}, state.chipInputs, {
                                    [ inputKey ]: newInputValue,
                                } ),
                            };
                        } );
                    } }
                    onChange = { ( event, newValue ) => {
                        // A chip was committed (Enter) or removed — clear pending text.
                        const inputKey = this.chipInputKey( service, key );

                        this.setState( ( state ) => {
                            return {
                                chipInputs: Object.assign( {}, state.chipInputs, {
                                    [ inputKey ]: '',
                                } ),
                            };
                        } );
                        this.setSectionList( service, key, newValue );
                    } }
                    options = { [] }
                    renderInput = { ( params ) => {
                        return (
                            <TextField
                                { ...params }
                                helperText = { settings.helperText }
                                label = { settings.label || key }
                                onBlur = { () => {
                                    // Mobile "Next"/Tab blurs without an Enter — commit
                                    // whatever's typed so the value isn't silently lost.
                                    this.commitPendingChip( service, key, values );
                                } }
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

    // Whether this source routes to the Steam reader (explicit `type` or, when
    // absent, the source name — matching how the rest of this file resolves type).
    isSteamSource ( service, serviceValue ) {
        return ( serviceValue.type || service ) === 'Steam';
    }

    // Resolve the numeric Forum app ID from the Announcements feed ID via the
    // /api/steam-resolve endpoint (server.js / vite dev mirror -> steam.js). The
    // feed id (a vanity slug for custom-URL games) can't be reused for the forum
    // scrape, but the community page it points at links the numeric app id, so we
    // read it from there and fill the field. The announcement count is surfaced so
    // a zero (an empty feed under that id) flags a wrong feed id at a glance.
    lookupSteamAppId ( service ) {
        const serviceValue = this.props.sources[ service ] || {};
        const feedId = Array.isArray( serviceValue.allowedSections )
            ? serviceValue.allowedSections[ 0 ] || ''
            : '';

        if ( !feedId ) {
            this.setState( {
                steamLookupStatus: 'Enter an announcements feed ID first.',
            } );

            return;
        }

        this.setState( {
            steamLookupBusy: true,
            steamLookupStatus: 'Looking up…',
        } );

        fetch( `/api/steam-resolve?id=${ encodeURIComponent( feedId ) }` )
            .then( ( response ) => {
                if ( !response.ok ) {
                    return {
                        error: 'Steam lookup failed.',
                    };
                }

                return response.json();
            } )
            .then( ( body ) => {
                if ( body.error || !body.appId ) {
                    this.setState( {
                        steamLookupBusy: false,
                        steamLookupStatus: body.error || 'Could not resolve an app ID — check the feed ID.',
                    } );

                    return;
                }

                this.updateField( service, 'appId', body.appId );

                const count = typeof body.announcements === 'number'
                    ? body.announcements
                    : null;
                const countText = count === null
                    ? ''
                    : ` • ${ count } announcement${ count === 1 ? '' : 's' } on this feed`;
                const emptyWarning = count === 0
                    ? ' — feed is empty, use the game’s custom community URL as the feed ID'
                    : '';

                this.setState( {
                    steamLookupBusy: false,
                    steamLookupStatus: `✓ app ${ body.appId }${ countText }${ emptyWarning }`,
                } );
            } )
            .catch( () => {
                this.setState( {
                    steamLookupBusy: false,
                    steamLookupStatus: 'Lookup failed.',
                } );
            } );
    }

    // Search Steam's catalogue by game name via /api/steam-search (server.js /
    // vite dev mirror -> steam.js) so the admin picks a game instead of pasting a
    // numeric id. Results populate the picker list; selecting one fills both id
    // fields (see selectSteamGame).
    searchSteam () {
        const query = this.state.steamSearchQuery.trim();

        if ( !query ) {
            return;
        }

        this.setState( {
            steamSearchBusy: true,
            steamSearchResults: [],
            steamLookupStatus: '',
        } );

        fetch( `/api/steam-search?q=${ encodeURIComponent( query ) }` )
            .then( ( response ) => {
                if ( !response.ok ) {
                    return {
                        error: 'Steam search failed.',
                    };
                }

                return response.json();
            } )
            .then( ( body ) => {
                if ( body.error ) {
                    this.setState( {
                        steamSearchBusy: false,
                        steamLookupStatus: body.error,
                    } );

                    return;
                }

                const results = body.results || [];

                this.setState( {
                    steamSearchBusy: false,
                    steamSearchResults: results,
                    steamLookupStatus: results.length ? '' : 'No matches found.',
                } );
            } )
            .catch( () => {
                this.setState( {
                    steamSearchBusy: false,
                    steamLookupStatus: 'Steam search failed.',
                } );
            } );
    }

    // Apply a picked search result: the appid is both the forum app id and the
    // default announcements feed id, so fill both. Then confirm the feed via
    // /api/steam-resolve — for the rare custom-URL game the numeric feed is empty,
    // and the status line tells the admin to swap the feed ID for the vanity slug
    // (which isn't resolvable from the app id, so it must be typed by hand).
    selectSteamGame ( service, result ) {
        this.updateField( service, 'appId', result.appId );
        this.updateField( service, 'allowedSections', [ result.appId ] );

        this.setState( {
            steamSearchResults: [],
            steamSearchQuery: '',
            steamLookupBusy: true,
            steamLookupStatus: `Checking ${ result.name }…`,
        } );

        fetch( `/api/steam-resolve?id=${ encodeURIComponent( result.appId ) }` )
            .then( ( response ) => {
                if ( !response.ok ) {
                    return {};
                }

                return response.json();
            } )
            .then( ( body ) => {
                const count = typeof body.announcements === 'number'
                    ? body.announcements
                    : null;
                const countText = count === null
                    ? ''
                    : ` • ${ count } announcement${ count === 1 ? '' : 's' }`;
                const emptyWarning = count === 0
                    ? ' — numeric feed is empty; enter this game’s custom community URL slug as the Announcements feed ID'
                    : '';

                this.setState( {
                    steamLookupBusy: false,
                    steamLookupStatus: `✓ ${ result.name } — app ${ result.appId }${ countText }${ emptyWarning }`,
                } );
            } )
            .catch( () => {
                this.setState( {
                    steamLookupBusy: false,
                    steamLookupStatus: `✓ ${ result.name } — app ${ result.appId }`,
                } );
            } );
    }

    // The Steam name-search picker: a search box + result list (mirroring
    // BoxartPicker) rendered above the id fields. Picking a result fills both ids
    // so the admin never pastes a number. Returns an array of elements to splice
    // into renderSteamFields.
    renderSteamSearch ( service ) {
        const elements = [
            <Box
                key = { 'steamSearch' }
                sx = { {
                    maxWidth: FIELD_MAX_WIDTH,
                    mt: 1.5,
                } }
            >
                <TextField
                    fullWidth
                    helperText = { 'Type a game name and pick a result to fill the IDs below automatically.' }
                    label = { 'Search Steam for a game' }
                    onChange = { ( event ) => {
                        this.setState( {
                            steamSearchQuery: event.target.value,
                        } );
                    } }
                    onKeyDown = { ( event ) => {
                        if ( event.key === 'Enter' ) {
                            event.preventDefault();
                            this.searchSteam();
                        }
                    } }
                    placeholder = { 'e.g. Elite Dangerous' }
                    size = { 'small' }
                    slotProps = { {
                        input: {
                            endAdornment: (
                                <InputAdornment position = { 'end' }>
                                    <IconButton
                                        disabled = { this.state.steamSearchBusy || !this.state.steamSearchQuery.trim() }
                                        edge = { 'end' }
                                        onClick = { () => {
                                            this.searchSteam();
                                        } }
                                        size = { 'small' }
                                        title = { 'Search Steam games' }
                                    >
                                        { this.state.steamSearchBusy
                                            ? <CircularProgress size = { 18 } />
                                            : <SearchIcon fontSize = { 'small' } /> }
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    } }
                    value = { this.state.steamSearchQuery }
                    variant = { 'outlined' }
                />
            </Box>,
        ];

        if ( this.state.steamSearchResults.length ) {
            elements.push(
                <List
                    dense
                    disablePadding
                    key = { 'steamSearchResults' }
                    sx = { {
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        maxHeight: 232,
                        maxWidth: FIELD_MAX_WIDTH,
                        mt: 1,
                        overflowY: 'auto',
                    } }
                >
                    { this.state.steamSearchResults.map( ( result ) => {
                        return (
                            <ListItemButton
                                key = { result.appId }
                                onClick = { () => {
                                    this.selectSteamGame( service, result );
                                } }
                            >
                                { result.icon
                                    ? <Avatar
                                        src = { result.icon }
                                        sx = { {
                                            height: 24,
                                            mr: 1.5,
                                            width: 24,
                                        } }
                                        variant = { 'rounded' }
                                    />
                                    : null }
                                <ListItemText
                                    primary = { result.name }
                                    secondary = { `App ${ result.appId }` }
                                />
                            </ListItemButton>
                        );
                    } ) }
                </List>,
            );
        }

        return elements;
    }

    // Steam needs two ids: the community hub id for the announcements feed
    // (allowedSections[0], a vanity slug for custom-URL games) and the numeric
    // app id for the forum scrape (appId, optional — defaults to the feed id).
    // Rendered as two single-value text fields (the reader only reads [0]) plus a
    // lookup that derives the app id from the feed id. Both are always shown so
    // clearing one doesn't make the field vanish mid-edit.
    renderSteamFields ( service, serviceValue ) {
        const feedId = Array.isArray( serviceValue.allowedSections )
            ? serviceValue.allowedSections[ 0 ] || ''
            : '';
        const appId = serviceValue.appId === undefined || serviceValue.appId === null
            ? ''
            : String( serviceValue.appId );

        return [
            ...this.renderSteamSearch( service ),
            <Box
                key = { 'allowedSections' }
                sx = { {
                    maxWidth: FIELD_MAX_WIDTH,
                    mt: 1.5,
                } }
            >
                <TextField
                    fullWidth
                    helperText = { allowedSectionsHelp( 'Steam' ) }
                    label = { 'Announcements feed ID' }
                    onChange = { ( event ) => {
                        const value = event.target.value.trim();

                        if ( !value ) {
                            this.removeField( service, 'allowedSections' );

                            return;
                        }

                        this.updateField( service, 'allowedSections', [ value ] );
                    } }
                    size = { 'small' }
                    value = { feedId }
                    variant = { 'outlined' }
                />
            </Box>,
            <Box
                key = { 'appId' }
                sx = { {
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: 1,
                    maxWidth: FIELD_MAX_WIDTH,
                    mt: 1.5,
                } }
            >
                <TextField
                    fullWidth
                    helperText = { 'Numeric app ID for the forum/discussions scrape. Leave blank to reuse the feed ID.' }
                    label = { 'Forum app ID' }
                    onChange = { ( event ) => {
                        const value = event.target.value.trim();

                        if ( !value ) {
                            this.removeField( service, 'appId' );

                            return;
                        }

                        this.updateField( service, 'appId', value );
                    } }
                    size = { 'small' }
                    value = { appId }
                    variant = { 'outlined' }
                />
                <Button
                    disabled = { this.state.steamLookupBusy || !feedId }
                    onClick = { () => {
                        this.lookupSteamAppId( service );
                    } }
                    size = { 'small' }
                    startIcon = { <SearchIcon /> }
                    sx = { {
                        flexShrink: 0,
                        mt: 0.5,
                    } }
                >
                    { 'Look up' }
                </Button>
            </Box>,
            this.state.steamLookupStatus
                ? <Typography
                    color = { 'text.secondary' }
                    key = { 'steamLookupStatus' }
                    sx = { {
                        display: 'block',
                        mt: 0.5,
                    } }
                    variant = { 'caption' }
                >
                    { this.state.steamLookupStatus }
                </Typography>
                : null,
        ].filter( Boolean );
    }

    sectionFields ( service, serviceValue ) {
        // Steam ignores disallowedSections and needs a numeric appId alongside the
        // feed id, so it gets its own two-field editor (+ lookup) rather than the
        // allowed/disallowed chip lists.
        if ( this.isSteamSource( service, serviceValue ) ) {
            return this.renderSteamFields( service, serviceValue );
        }

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
        // Steam's section fields are handled by the dedicated single app-ID input
        // (allowedSections is always shown; disallowedSections is ignored by the
        // reader), so neither should be offered as an addable chip list here.
        const isSteam = this.isSteamSource( service, serviceValue );
        const available = KNOWN_SOURCE_FIELDS
            .filter( ( field ) => {
                if ( isSteam && ( field.key === 'allowedSections' || field.key === 'disallowedSections' ) ) {
                    return false;
                }

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

    // Reddit is the only source whose `type`/name routes to a finder that uses
    // flair, so the flair editor is shown only for it. Matches how the rest of
    // this file keys Reddit behaviour off the (possibly name-derived) type.
    isRedditSource ( service, serviceValue ) {
        return ( serviceValue.type || service ) === 'Reddit';
    }

    // Per-subreddit flair editor, keyed off the source's allowedSections. Writing
    // back drops the `flair` key entirely when emptied, to keep the config clean.
    renderFlairGroup ( service, serviceValue ) {
        return (
            <React.Fragment>
                { this.renderGroupHeader( 'Developer flair', false ) }
                <RedditFlairEditor
                    flair = { serviceValue.flair || {} }
                    onChange = { ( nextFlair ) => {
                        if ( Object.keys( nextFlair ).length === 0 ) {
                            this.removeField( service, 'flair' );

                            return;
                        }

                        this.updateField( service, 'flair', nextFlair );
                    } }
                    subreddits = { Array.isArray( serviceValue.allowedSections ) ? serviceValue.allowedSections : [] }
                />
            </React.Fragment>
        );
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
                        // Reddit sources host the flair editor, whose blocklist/scan
                        // chips need the full panel width to flow horizontally instead
                        // of stacking into a very tall column. Other source types keep
                        // the comfortable reading cap; their scalar fields self-cap too.
                        maxWidth: this.isRedditSource( service, serviceValue )
                            ? 'none'
                            : FIELD_MAX_WIDTH,
                        minWidth: 0,
                    } }
                >
                    { groups.map( ( group, index ) => {
                        return this.renderGroup( group[ 0 ], group[ 1 ], index === 0 );
                    } ) }
                    { this.isRedditSource( service, serviceValue ) && this.renderFlairGroup( service, serviceValue ) }
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
                                // Show the source's `label` (its human name, e.g.
                                // an 'RSS'-keyed source labelled 'Thursdoid') on the
                                // tab, falling back to the object key when unlabelled
                                // — matching what the "Add account" picker offers and
                                // what queue-users resolves accounts against.
                                const tabLabel = this.props.sources[ service ].label || service;

                                return (
                                    <Tab
                                        icon = { this.renderSourceIcon( service ) }
                                        iconPosition = { 'start' }
                                        key = { service }
                                        label = { tabLabel }
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
