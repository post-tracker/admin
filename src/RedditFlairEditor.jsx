import React from 'react';
import PropTypes from 'prop-types';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';

// Per-subreddit flair editor for a Reddit source. Flair decides who the finder
// treats as a developer: the stored list is a BLOCKLIST — a user whose flair is
// in it is NOT a dev, anyone else with a flair of the chosen `type` IS. So an
// empty blocklist means "every flaired user is treated as a dev"; the community
// flairs (regulars, weapon classes, veteran badges) go in the list to exclude
// them. See finder/modules/flair/base.js.
//
// Controlled: never mutates props.flair, emits a fresh object via onChange. The
// shape is { [subreddit]: { type, blocklist } }, keyed by the subreddits in the
// source's allowedSections. The "Scan subreddit" button samples live flairs from
// /api/reddit-flairs so the blocklist can be curated by clicking, not guessing.

const FLAIR_TYPES = [
    { label: 'CSS class (author_flair_css_class)', value: 'author_flair_css_class' },
    { label: 'Text (author_flair_text)', value: 'author_flair_text' },
];

const FLAIR_MODES = [
    { label: 'Blocklist (everyone flaired is a dev, except listed)', value: 'block' },
    { label: 'Allowlist (only listed flairs are devs)', value: 'allow' },
];

const DEFAULT_TYPE = 'author_flair_css_class';

const normalise = function normalise ( value ) {
    return String( value ).trim().toLowerCase();
};

class RedditFlairEditor extends React.Component {
    constructor ( props ) {
        super( props );

        // Per-subreddit scan state: { [sub]: { loading, error, flairs } }.
        this.state = {
            scans: {},
        };
    }

    // The stored config for a subreddit, with defaults so the controls always
    // have something to render before the user touches anything.
    configFor ( subreddit ) {
        const stored = this.props.flair[ subreddit ] || {};

        return {
            allowlist: Array.isArray( stored.allowlist ) ? stored.allowlist : [],
            blocklist: Array.isArray( stored.blocklist ) ? stored.blocklist : [],
            mode: stored.mode === 'allow' ? 'allow' : 'block',
            type: stored.type || DEFAULT_TYPE,
        };
    }

    updateConfig ( subreddit, changes ) {
        const next = Object.assign( {}, this.props.flair );

        next[ subreddit ] = Object.assign( {}, this.configFor( subreddit ), changes );

        this.props.onChange( next );
    }

    // The active list key for a subreddit given its mode.
    listKeyFor ( subreddit ) {
        return this.configFor( subreddit ).mode === 'allow' ? 'allowlist' : 'blocklist';
    }

    // List values are matched case-insensitively by the finder, so store them
    // lowercased and de-duplicated. Writes whichever list the mode selects.
    setList ( subreddit, list ) {
        const cleaned = [ ...new Set( list.map( normalise ).filter( Boolean ) ) ];

        this.updateConfig( subreddit, {
            [ this.listKeyFor( subreddit ) ]: cleaned,
        } );
    }

    // Toggle a flair value in the active list. In block mode clicking a scanned
    // flair excludes it (adds to blocklist); in allow mode clicking includes it
    // (adds to allowlist).
    toggleListed ( subreddit, value ) {
        const key = normalise( value );
        const current = this.configFor( subreddit )[ this.listKeyFor( subreddit ) ];

        if ( current.includes( key ) ) {
            this.setList( subreddit, current.filter( ( item ) => {
                return item !== key;
            } ) );

            return;
        }

        this.setList( subreddit, current.concat( key ) );
    }

    async scan ( subreddit ) {
        this.setState( ( state ) => {
            return {
                scans: Object.assign( {}, state.scans, {
                    [ subreddit ]: {
                        flairs: [],
                        loading: true,
                    },
                } ),
            };
        } );

        const finish = ( result ) => {
            this.setState( ( state ) => {
                return {
                    scans: Object.assign( {}, state.scans, {
                        [ subreddit ]: result,
                    } ),
                };
            } );
        };

        try {
            const response = await fetch( `/api/reddit-flairs?subreddit=${ encodeURIComponent( subreddit ) }` );

            if ( !response.ok ) {
                finish( {
                    error: 'Scan failed — Reddit may be rate-limiting. Try again shortly.',
                    flairs: [],
                    loading: false,
                } );

                return;
            }

            const body = await response.json();

            finish( {
                error: body.error || '',
                flairs: body.flairs || [],
                loading: false,
            } );
        } catch {
            finish( {
                error: 'Scan failed — could not reach the server.',
                flairs: [],
                loading: false,
            } );
        }
    }

    // The scanned flairs of the subreddit's chosen type, as click-to-toggle chips.
    // Only flairs not already in the blocklist are shown — each is treated as a dev
    // until excluded. Clicking moves it into the blocklist.
    renderScanResults ( subreddit ) {
        const scan = this.state.scans[ subreddit ];

        if ( !scan ) {
            return false;
        }

        if ( scan.loading ) {
            return (
                <Box
                    sx = { {
                        alignItems: 'center',
                        display: 'flex',
                        gap: 1,
                        mt: 1.5,
                    } }
                >
                    <CircularProgress
                        size = { 16 }
                    />
                    <Typography
                        color = { 'text.secondary' }
                        variant = { 'caption' }
                    >
                        { `Scanning r/${ subreddit }…` }
                    </Typography>
                </Box>
            );
        }

        if ( scan.error ) {
            return (
                <Typography
                    color = { 'error' }
                    sx = { {
                        mt: 1.5,
                    } }
                    variant = { 'caption' }
                >
                    { scan.error }
                </Typography>
            );
        }

        const config = this.configFor( subreddit );
        const type = config.type;
        const mode = config.mode;
        const activeList = mode === 'allow' ? config.allowlist : config.blocklist;
        const ofType = scan.flairs.filter( ( flair ) => {
            return flair.type === type;
        } );
        // In block mode only surface flairs NOT yet blocked (to-exclude shortlist).
        // In allow mode only surface flairs NOT yet allowed (to-include shortlist).
        const matching = ofType.filter( ( flair ) => {
            return !activeList.includes( normalise( flair.value ) );
        } );
        const otherType = scan.flairs.length - ofType.length;

        if ( matching.length === 0 ) {
            let emptyMessage = 'No flairs seen in the recent posts and comments sampled.';

            if ( otherType > 0 ) {
                emptyMessage = `No ${ type } flairs seen, but ${ otherType } of the other type were — try switching the flair type above.`;
            } else if ( ofType.length > 0 ) {
                emptyMessage = mode === 'allow'
                    ? 'Every flair seen is already in the allowlist.'
                    : 'Every flair seen is already in the blocklist.';
            }

            return (
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        mt: 1.5,
                    } }
                    variant = { 'caption' }
                >
                    { emptyMessage }
                </Typography>
            );
        }

        return (
            <Box
                sx = { {
                    mt: 1.5,
                } }
            >
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        display: 'block',
                        mb: 0.5,
                    } }
                    variant = { 'caption' }
                >
                    { mode === 'allow'
                        ? 'Click a flair to add it to the allowlist (its wearers become devs). The count is how many distinct users wore it in the sample.'
                        : 'Each flair below is treated as a dev. Click one to exclude it (move it to the blocklist). The count is how many distinct users wore it in the sample.' }
                </Typography>
                <Box
                    sx = { {
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.75,
                    } }
                >
                    { matching.map( ( flair ) => {
                        return (
                            <Chip
                                key = { flair.value }
                                label = { `${ flair.value } (${ flair.count })` }
                                onClick = { () => {
                                    this.toggleListed( subreddit, flair.value );
                                } }
                                size = { 'small' }
                                title = { mode === 'allow'
                                    ? `Click to allow · worn by ${ flair.count } user(s): ${ flair.sampleUsers.join( ', ' ) }`
                                    : `Treated as a dev · worn by ${ flair.count } user(s): ${ flair.sampleUsers.join( ', ' ) }` }
                                variant = { 'outlined' }
                            />
                        );
                    } ) }
                </Box>
            </Box>
        );
    }

    renderSubreddit ( subreddit ) {
        const config = this.configFor( subreddit );
        const scanning = Boolean( this.state.scans[ subreddit ] && this.state.scans[ subreddit ].loading );

        return (
            <Box
                key = { subreddit }
                sx = { {
                    '&:not(:last-of-type)': {
                        borderBottom: 1,
                        borderColor: 'divider',
                    },
                    pb: 2,
                    pt: 1.5,
                } }
            >
                <Typography
                    variant = { 'subtitle2' }
                >
                    { `r/${ subreddit }` }
                </Typography>
                <Box
                    sx = { {
                        alignItems: 'center',
                        display: 'flex',
                        gap: 1,
                        mt: 1.5,
                    } }
                >
                    <TextField
                        label = { 'Flair type' }
                        onChange = { ( event ) => {
                            this.updateConfig( subreddit, {
                                type: event.target.value,
                            } );
                        } }
                        select
                        size = { 'small' }
                        sx = { {
                            width: 320,
                        } }
                        value = { config.type }
                        variant = { 'outlined' }
                    >
                        { FLAIR_TYPES.map( ( option ) => {
                            return (
                                <MenuItem
                                    key = { option.value }
                                    value = { option.value }
                                >
                                    { option.label }
                                </MenuItem>
                            );
                        } ) }
                    </TextField>
                    <TextField
                        label = { 'Mode' }
                        onChange = { ( event ) => {
                            this.updateConfig( subreddit, {
                                mode: event.target.value,
                            } );
                        } }
                        select
                        size = { 'small' }
                        sx = { {
                            width: 380,
                        } }
                        value = { config.mode }
                        variant = { 'outlined' }
                    >
                        { FLAIR_MODES.map( ( option ) => {
                            return (
                                <MenuItem
                                    key = { option.value }
                                    value = { option.value }
                                >
                                    { option.label }
                                </MenuItem>
                            );
                        } ) }
                    </TextField>
                    <Button
                        disabled = { scanning }
                        onClick = { () => {
                            this.scan( subreddit );
                        } }
                        size = { 'small' }
                        startIcon = { <SearchIcon /> }
                    >
                        { 'Scan subreddit' }
                    </Button>
                </Box>
                { this.renderScanResults( subreddit ) }
                <Box
                    sx = { {
                        mt: 1.5,
                    } }
                >
                    <Autocomplete
                        freeSolo
                        multiple
                        // Some communities (Destiny ~250, Rocket League ~170) have
                        // huge blocklists; collapse to a handful of chips + "+N" at
                        // rest so the field doesn't become a wall of chips.
                        limitTags = { 10 }
                        onChange = { ( event, newValue ) => {
                            this.setList( subreddit, newValue );
                        } }
                        options = { [] }
                        renderInput = { ( params ) => {
                            const isAllow = config.mode === 'allow';
                            const activeList = isAllow ? config.allowlist : config.blocklist;
                            const listLabel = isAllow ? 'Allowlist' : 'Blocklist';
                            const noun = isAllow ? 'dev flair' : 'non-dev flair';

                            return (
                                <TextField
                                    { ...params }
                                    helperText = { isAllow
                                        ? 'ONLY flairs containing one of these are treated as devs (substring match — e.g. "verified-bungie-employee" catches "SS6 5-7 Verified-Bungie-Employee"). Anyone else is ignored.'
                                        : 'Flairs that are NOT developers. Anyone with another flair of the type above is treated as a dev.' }
                                    label = { `${ listLabel } — ${ activeList.length } ${ noun }${ activeList.length === 1 ? '' : 's' }` }
                                    placeholder = { 'Type and press Enter' }
                                    size = { 'small' }
                                    variant = { 'outlined' }
                                />
                            );
                        } }
                        // Bound the chip area when expanded (focused) too, so editing
                        // a large list scrolls within a few rows rather than
                        // pushing the rest of the form far down the page.
                        sx = { {
                            '& .MuiAutocomplete-inputRoot': {
                                maxHeight: 180,
                                overflowY: 'auto',
                            },
                        } }
                        value = { config.mode === 'allow' ? config.allowlist : config.blocklist }
                    />
                </Box>
            </Box>
        );
    }

    render () {
        if ( this.props.subreddits.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        mt: 1.5,
                    } }
                    variant = { 'body2' }
                >
                    { 'Add a subreddit under Allowed sections to configure its flair.' }
                </Typography>
            );
        }

        return (
            <Box>
                { this.props.subreddits.map( ( subreddit ) => {
                    return this.renderSubreddit( subreddit );
                } ) }
            </Box>
        );
    }
}

RedditFlairEditor.displayName = 'RedditFlairEditor';

RedditFlairEditor.defaultProps = {
    flair: {},
    subreddits: [],
};

RedditFlairEditor.propTypes = {
    flair: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    subreddits: PropTypes.arrayOf( PropTypes.string ),
};

export default RedditFlairEditor;
