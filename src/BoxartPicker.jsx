import React from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';

import { buildBoxartUrls, extractBoxartQuery } from './boxart.js';

const HTTP_SERVICE_UNAVAILABLE = 503;

const styles = {
    resultThumb: {
        borderRadius: 2,
        flexShrink: 0,
        height: 48,
        marginRight: 12,
        objectFit: 'cover',
        width: 36,
    },
};

// Box art picker for a game. Controlled by `value` (the boxart URL) plus
// `onChange`. The "Twitch game" field searches Twitch's catalogue by name
// (server-side, see twitch.js) and offers the matches' real box art to pick
// from; it also still accepts a raw name/id that's turned into a URL
// heuristically (boxart.js). The raw URL field stays editable for custom images.
// A live <img> load reports whether the generated URL actually resolves.
class BoxartPicker extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleQueryChange = this.handleQueryChange.bind( this );
        this.handleQueryKeyDown = this.handleQueryKeyDown.bind( this );
        this.handleUrlChange = this.handleUrlChange.bind( this );
        this.handleSearch = this.handleSearch.bind( this );
        this.handleSelectResult = this.handleSelectResult.bind( this );
        this.handleLoad = this.handleLoad.bind( this );
        this.handleError = this.handleError.bind( this );

        this.state = {
            // '' | 'found' | 'missing' — set by the preview <img> load result.
            status: '',
            // Mirrors the value's slug so editing an existing game prefills the
            // lookup field; user typing takes over from there.
            query: extractBoxartQuery( props.value ),
            // Once the user touches either field we stop auto-following queryHint.
            touched: false,
            // Ordered URLs to probe for the current query, and where we are in
            // them. A numeric query yields more than one ("_IGDB" form + bare id);
            // on each <img> error we advance to the next before giving up. The
            // incoming value is its own single candidate.
            candidates: props.value ? [ props.value ] : [],
            candidateIndex: 0,
            // Twitch lookup state: matches to choose from, an in-flight flag, and
            // a one-line message (errors, "not configured", "no matches").
            results: [],
            searching: false,
            searchMessage: '',
            // Reveals the raw Boxart URL field, hidden by default since the
            // lookup above usually sets it for you.
            urlOpen: false,
        };
    }

    componentDidUpdate ( prevProps ) {
        // Follow the game name into the lookup field until the user edits it
        // themselves — gives new games art for free without locking it in.
        if (
            !this.state.touched &&
            this.props.queryHint !== prevProps.queryHint &&
            this.props.queryHint
        ) {
            const candidates = buildBoxartUrls( this.props.queryHint );

            this.setState( {
                query: this.props.queryHint,
                candidates: candidates,
                candidateIndex: 0,
            } );

            this.props.onChange( candidates[ 0 ] || '' );
        }

        // Reset the load status whenever the URL changes so the preview can
        // re-report found/missing for the new image.
        if ( prevProps.value !== this.props.value ) {
            this.setState( {
                status: '',
            } );
        }
    }

    handleQueryChange ( event ) {
        const query = event.target.value;
        const candidates = buildBoxartUrls( query );

        this.setState( {
            query: query,
            touched: true,
            candidates: candidates,
            candidateIndex: 0,
            // Stale matches/messages no longer describe what's typed.
            results: [],
            searchMessage: '',
        } );

        this.props.onChange( candidates[ 0 ] || '' );
    }

    handleQueryKeyDown ( event ) {
        if ( event.key === 'Enter' ) {
            event.preventDefault();
            this.handleSearch();
        }
    }

    handleUrlChange ( event ) {
        const url = event.target.value;

        this.setState( {
            // Keep the lookup field in sync when the slug is recognisable;
            // leave it as-is for custom URLs.
            query: extractBoxartQuery( url ) || this.state.query,
            touched: true,
            // A hand-entered URL is the only thing to try — no id fallback.
            candidates: url ? [ url ] : [],
            candidateIndex: 0,
        } );

        this.props.onChange( url );
    }

    handleSearch () {
        const query = this.state.query.trim();

        if ( !query ) {
            return;
        }

        this.setState( {
            searching: true,
            searchMessage: '',
            results: [],
        } );

        fetch( `/api/twitch-games?q=${ encodeURIComponent( query ) }` )
            .then( ( response ) => {
                if ( response.status === HTTP_SERVICE_UNAVAILABLE ) {
                    return {
                        error: 'Twitch lookup isn’t configured.',
                    };
                }

                if ( !response.ok ) {
                    return {
                        error: 'Twitch lookup failed.',
                    };
                }

                return response.json();
            } )
            .then( ( body ) => {
                if ( body.error ) {
                    this.setState( {
                        searching: false,
                        searchMessage: body.error,
                    } );

                    return;
                }

                const results = body.results || [];

                this.setState( {
                    searching: false,
                    results: results,
                    searchMessage: results.length ? '' : 'No matches found.',
                } );
            } )
            .catch( () => {
                this.setState( {
                    searching: false,
                    searchMessage: 'Twitch lookup failed.',
                } );
            } );
    }

    handleSelectResult ( result ) {
        // Twitch hands back the authoritative box art URL; store it directly and
        // mirror its slug into the lookup field so it round-trips on re-edit.
        this.setState( {
            query: extractBoxartQuery( result.boxart ) || this.state.query,
            touched: true,
            candidates: result.boxart ? [ result.boxart ] : [],
            candidateIndex: 0,
            results: [],
            searchMessage: '',
        } );

        this.props.onChange( result.boxart || '' );
    }

    handleLoad () {
        this.setState( {
            status: 'found',
        } );
    }

    handleError () {
        // The current guess 404'd; try the next candidate (e.g. the bare id
        // after the "_IGDB" form missed) before reporting the lookup as missing.
        const nextIndex = this.state.candidateIndex + 1;

        if ( nextIndex < this.state.candidates.length ) {
            this.setState( {
                candidateIndex: nextIndex,
            } );

            this.props.onChange( this.state.candidates[ nextIndex ] );

            return;
        }

        this.setState( {
            status: 'missing',
        } );
    }

    // A hidden probe that loads the current URL purely to report found/missing
    // and to advance through candidate URLs on error. The visible thumbnail
    // lives in the game header, so the picker shows no image of its own.
    renderProbe () {
        if ( !this.props.value ) {
            return null;
        }

        return (
            <img
                alt = { '' }
                key = { this.props.value }
                onError = { this.handleError }
                onLoad = { this.handleLoad }
                src = { this.props.value }
                style = { { display: 'none' } }
            />
        );
    }

    renderResults () {
        if ( this.state.searchMessage ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    sx = { {
                        mt: 1,
                        px: 1,
                    } }
                    variant = { 'caption' }
                >
                    { this.state.searchMessage }
                </Typography>
            );
        }

        if ( this.state.results.length === 0 ) {
            return null;
        }

        return (
            <List
                dense
                disablePadding
                sx = { {
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    maxHeight: 232,
                    mt: 1,
                    overflowY: 'auto',
                } }
            >
                { this.state.results.map( ( result ) => {
                    return (
                        <ListItemButton
                            key = { result.id }
                            onClick = { () => {
                                this.handleSelectResult( result );
                            } }
                        >
                            <img
                                src = { result.boxart }
                                style = { styles.resultThumb }
                            />
                            <ListItemText
                                primary = { result.name }
                            />
                        </ListItemButton>
                    );
                } ) }
            </List>
        );
    }

    render () {
        return (
            <Box
                sx = { {
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    width: {
                        sm: 280,
                        xs: '100%',
                    },
                } }
            >
                { this.renderProbe() }
                <Box
                    sx = { {
                        alignItems: 'center',
                        display: 'flex',
                        gap: 0.5,
                    } }
                >
                    <TextField
                        fullWidth
                        slotProps = { {
                            input: {
                                endAdornment: (
                                    <InputAdornment position = { 'end' }>
                                        <IconButton
                                            disabled = { this.state.searching || !this.state.query.trim() }
                                            edge = { 'end' }
                                            onClick = { this.handleSearch }
                                            size = { 'small' }
                                            title = { 'Search Twitch games' }
                                        >
                                            { this.state.searching
                                                ? <CircularProgress size = { 18 } />
                                                : <SearchIcon fontSize = { 'small' } /> }
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            },
                        } }
                        label = { 'Game lookup (name or ID)' }
                        onChange = { this.handleQueryChange }
                        onKeyDown = { this.handleQueryKeyDown }
                        placeholder = { 'e.g. Hades, or 1872074204' }
                        size = { 'small' }
                        value = { this.state.query }
                        variant = { 'outlined' }
                    />
                    <IconButton
                        onClick = { () => {
                            this.setState( ( previousState ) => {
                                return {
                                    urlOpen: !previousState.urlOpen,
                                };
                            } );
                        } }
                        size = { 'small' }
                        title = { 'Edit boxart URL' }
                    >
                        { this.state.urlOpen
                            ? <ExpandLessIcon fontSize = { 'small' } />
                            : <ExpandMoreIcon fontSize = { 'small' } /> }
                    </IconButton>
                </Box>
                { this.renderResults() }
                <Collapse
                    in = { this.state.urlOpen }
                >
                    <TextField
                        fullWidth
                        label = { 'Boxart URL' }
                        onChange = { this.handleUrlChange }
                        size = { 'small' }
                        sx = { {
                            mt: 1,
                        } }
                        value = { this.props.value }
                        variant = { 'outlined' }
                    />
                </Collapse>
            </Box>
        );
    }
}

BoxartPicker.displayName = 'BoxartPicker';

BoxartPicker.propTypes = {
    onChange: PropTypes.func.isRequired,
    queryHint: PropTypes.string,
    value: PropTypes.string,
};

export default BoxartPicker;
