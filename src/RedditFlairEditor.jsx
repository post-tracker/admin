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
            blocklist: Array.isArray( stored.blocklist ) ? stored.blocklist : [],
            type: stored.type || DEFAULT_TYPE,
        };
    }

    updateConfig ( subreddit, changes ) {
        const next = Object.assign( {}, this.props.flair );

        next[ subreddit ] = Object.assign( {}, this.configFor( subreddit ), changes );

        this.props.onChange( next );
    }

    // Blocklist values are matched case-insensitively by the finder, so store
    // them lowercased and de-duplicated.
    setBlocklist ( subreddit, list ) {
        const cleaned = [ ...new Set( list.map( normalise ).filter( Boolean ) ) ];

        this.updateConfig( subreddit, {
            blocklist: cleaned,
        } );
    }

    toggleBlocked ( subreddit, value ) {
        const current = this.configFor( subreddit ).blocklist;
        const key = normalise( value );

        if ( current.includes( key ) ) {
            this.setBlocklist( subreddit, current.filter( ( item ) => {
                return item !== key;
            } ) );

            return;
        }

        this.setBlocklist( subreddit, current.concat( key ) );
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
    // A chip in the blocklist is filled ("excluded"); otherwise it's outlined and
    // coloured by the dev/community suggestion. Clicking moves it in/out.
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

        const type = this.configFor( subreddit ).type;
        const blocklist = this.configFor( subreddit ).blocklist;
        const matching = scan.flairs.filter( ( flair ) => {
            return flair.type === type;
        } );
        const otherType = scan.flairs.length - matching.length;

        if ( matching.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        mt: 1.5,
                    } }
                    variant = { 'caption' }
                >
                    { otherType > 0
                        ? `No ${ type } flairs seen, but ${ otherType } of the other type were — try switching the flair type above.`
                        : 'No author flairs seen in the recent posts sampled.' }
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
                    { 'Click a flair to exclude it (mark as not-a-dev). Filled = excluded; green = looks like a dev.' }
                </Typography>
                <Box
                    sx = { {
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.75,
                    } }
                >
                    { matching.map( ( flair ) => {
                        const excluded = blocklist.includes( normalise( flair.value ) );

                        return (
                            <Chip
                                color = { excluded
                                    ? 'default'
                                    : ( flair.suggestion === 'dev' ? 'success' : 'warning' ) }
                                key = { flair.value }
                                label = { `${ flair.value } (${ flair.count })` }
                                onClick = { () => {
                                    this.toggleBlocked( subreddit, flair.value );
                                } }
                                size = { 'small' }
                                title = { `${ excluded ? 'Excluded (not a dev)' : 'Treated as a dev' } · suggestion: ${ flair.suggestion } · worn by ${ flair.count } user(s): ${ flair.sampleUsers.join( ', ' ) }` }
                                variant = { excluded ? 'filled' : 'outlined' }
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
                <Box
                    sx = { {
                        mt: 1.5,
                    } }
                >
                    <Autocomplete
                        freeSolo
                        multiple
                        onChange = { ( event, newValue ) => {
                            this.setBlocklist( subreddit, newValue );
                        } }
                        options = { [] }
                        renderInput = { ( params ) => {
                            return (
                                <TextField
                                    { ...params }
                                    helperText = { 'Flairs that are NOT developers. Anyone with another flair of the type above is treated as a dev.' }
                                    label = { 'Blocklist (non-dev flairs)' }
                                    placeholder = { 'Type and press Enter' }
                                    size = { 'small' }
                                    variant = { 'outlined' }
                                />
                            );
                        } }
                        value = { config.blocklist }
                    />
                </Box>
                { this.renderScanResults( subreddit ) }
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
