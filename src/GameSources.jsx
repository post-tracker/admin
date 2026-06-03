import React from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
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

class GameSources extends React.Component {
    constructor ( props ) {
        super( props );

        this.handleAddService = this.handleAddService.bind( this );
        this.handleTabChange = this.handleTabChange.bind( this );

        this.state = {
            // currently selected service tab (by name)
            activeService: Object.keys( props.sources )[ 0 ] || false,
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
        } );
    }

    handleAddService () {
        const name = this.state.newService.trim();

        if ( !name || this.props.sources[ name ] ) {
            return;
        }

        this.updateService( name, {
            allowedSections: [],
        } );

        this.setState( {
            activeService: name,
            newService: '',
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
                key = { key }
                label = { key }
                sx = { {
                    display: 'flex',
                    mt: 1,
                } }
            />
        );
    }

    renderScalarField ( service, key, value ) {
        return (
            <TextField
                fullWidth
                key = { key }
                label = { key }
                onChange = { ( event ) => {
                    this.updateField( service, key, event.target.value );
                } }
                size = { 'small' }
                sx = { {
                    mt: 1.5,
                } }
                value = { value === null || value === undefined ? '' : String( value ) }
                variant = { 'outlined' }
            />
        );
    }

    renderField ( service, key, value ) {
        if ( Array.isArray( value ) ) {
            return this.renderArrayField( service, key, value );
        }

        if ( typeof value === 'boolean' ) {
            return this.renderBooleanField( service, key, value );
        }

        return this.renderScalarField( service, key, value );
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
            </Box>
        );
    }

    render () {
        const services = Object.keys( this.props.sources );
        const currentService = this.getCurrentService();

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
                            label = { 'New source' }
                            onChange = { ( event ) => {
                                this.setState( {
                                    newService: event.target.value,
                                } );
                            } }
                            onKeyDown = { ( event ) => {
                                if ( event.key === 'Enter' ) {
                                    event.preventDefault();
                                    this.handleAddService();
                                }
                            } }
                            size = { 'small' }
                            sx = { {
                                width: 160,
                            } }
                            value = { this.state.newService }
                            variant = { 'outlined' }
                        />
                        <Button
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
