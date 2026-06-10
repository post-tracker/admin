import React from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

import { buildBoxartUrl, extractBoxartQuery } from './boxart.js';

const styles = {
    placeholder: {
        alignItems: 'center',
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        color: 'text.disabled',
        display: 'flex',
        flexShrink: 0,
        fontSize: 12,
        height: 96,
        justifyContent: 'center',
        textAlign: 'center',
        width: 72,
    },
    thumb: {
        borderRadius: 4,
        display: 'block',
        flexShrink: 0,
        height: 96,
        objectFit: 'cover',
        width: 72,
    },
};

// Box art picker for a game. Controlled by `value` (the boxart URL) plus
// `onChange`. The "Twitch game" field generates a URL from a name or id (see
// boxart.js), while the raw URL field stays editable for custom images. A live
// <img> load reports whether the generated URL actually resolves.
class BoxartPicker extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleQueryChange = this.handleQueryChange.bind( this );
        this.handleUrlChange = this.handleUrlChange.bind( this );
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
            this.setState( {
                query: this.props.queryHint,
            } );

            this.props.onChange( buildBoxartUrl( this.props.queryHint ) );
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

        this.setState( {
            query: query,
            touched: true,
        } );

        this.props.onChange( buildBoxartUrl( query ) );
    }

    handleUrlChange ( event ) {
        const url = event.target.value;

        this.setState( {
            // Keep the lookup field in sync when the slug is recognisable;
            // leave it as-is for custom URLs.
            query: extractBoxartQuery( url ) || this.state.query,
            touched: true,
        } );

        this.props.onChange( url );
    }

    handleLoad () {
        this.setState( {
            status: 'found',
        } );
    }

    handleError () {
        this.setState( {
            status: 'missing',
        } );
    }

    renderPreview () {
        if ( !this.props.value ) {
            return (
                <Box sx = { styles.placeholder }>
                    { 'No image' }
                </Box>
            );
        }

        return (
            <img
                key = { this.props.value }
                onError = { this.handleError }
                onLoad = { this.handleLoad }
                src = { this.props.value }
                style = { styles.thumb }
            />
        );
    }

    renderStatus () {
        if ( !this.props.value || this.state.status === 'found' ) {
            return 'Type the Twitch game name, or its numeric Twitch id.';
        }

        if ( this.state.status === 'missing' ) {
            return 'No Twitch image at this name — try the exact Twitch title, the numeric id, or paste a URL.';
        }

        return ' ';
    }

    render () {
        return (
            <Box
                sx = { {
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: 2,
                } }
            >
                { this.renderPreview() }
                <Box
                    sx = { {
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        gap: 2,
                        minWidth: 0,
                    } }
                >
                    <TextField
                        fullWidth
                        helperText = { this.renderStatus() }
                        label = { 'Twitch game (name or ID)' }
                        onChange = { this.handleQueryChange }
                        placeholder = { 'e.g. Tabletop Simulator or 32399' }
                        size = { 'small' }
                        value = { this.state.query }
                        variant = { 'outlined' }
                    />
                    <TextField
                        fullWidth
                        label = { 'Boxart URL' }
                        onChange = { this.handleUrlChange }
                        size = { 'small' }
                        value = { this.props.value }
                        variant = { 'outlined' }
                    />
                </Box>
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
