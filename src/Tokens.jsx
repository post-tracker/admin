import React from 'react';
import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import Header from './Header.jsx';
import api from './api.js';

const TOKEN_WAIT_TIMEOUT = 100;
const REQUEST_TIMEOUT = 10000;

// Scopes a token can be granted. `admin` implies all others (enforced by the API).
const AVAILABLE_SCOPES = [
    'posts:read',
    'posts:write',
    'posts:delete',
    'accounts:read',
    'accounts:write',
    'accounts:delete',
    'developers:read',
    'developers:write',
    'games:read',
    'games:write',
    'hashes:read',
    'stats:read',
    'tokens:manage',
    'admin',
];

class Tokens extends React.Component {
    constructor ( props ) {
        super( props );

        this.loadTokens = this.loadTokens.bind( this );
        this.handleOpenCreate = this.handleOpenCreate.bind( this );
        this.handleCloseCreate = this.handleCloseCreate.bind( this );
        this.handleCreate = this.handleCreate.bind( this );
        this.handleCopy = this.handleCopy.bind( this );

        this.state = {
            createError: false,
            createOpen: false,
            createdToken: false,
            creating: false,
            error: false,
            loading: true,
            newName: '',
            newScopes: [],
            tokens: [],
        };
    }

    componentDidMount () {
        this.loadTokens();
    }

    loadTokens () {
        if ( !window.apiToken ) {
            setTimeout( this.loadTokens, TOKEN_WAIT_TIMEOUT );

            return;
        }

        Promise.race( [
            api.get( '/tokens' ),
            new Promise( ( resolve, reject ) => {
                setTimeout( () => {
                    reject( new Error( 'request timed out' ) );
                }, REQUEST_TIMEOUT );
            } ),
        ] )
            .then( ( result ) => {
                this.setState( {
                    error: false,
                    loading: false,
                    tokens: ( result && result.data ) || [],
                } );
            } )
            .catch( ( loadError ) => {
                this.setState( {
                    error: loadError.message || 'Failed to load tokens',
                    loading: false,
                } );
            } );
    }

    handleOpenCreate () {
        this.setState( {
            createError: false,
            createOpen: true,
            createdToken: false,
            newName: '',
            newScopes: [],
        } );
    }

    handleCloseCreate () {
        this.setState( {
            createOpen: false,
        } );
    }

    toggleScope ( scope ) {
        const has = this.state.newScopes.includes( scope );

        this.setState( {
            newScopes: has
                ? this.state.newScopes.filter( ( entry ) => {
                    return entry !== scope;
                } )
                : [ ...this.state.newScopes, scope ],
        } );
    }

    handleCreate () {
        if ( !this.state.newName.trim() || this.state.newScopes.length === 0 ) {
            this.setState( {
                createError: 'A name and at least one scope are required',
            } );

            return;
        }

        this.setState( {
            createError: false,
            creating: true,
        } );

        api.post( '/tokens', {
            name: this.state.newName.trim(),
            scopes: this.state.newScopes,
        } )
            .then( ( result ) => {
                this.setState( {
                    createdToken: ( result && result.data ) || false,
                    creating: false,
                } );

                this.loadTokens();
            } )
            .catch( ( createError ) => {
                this.setState( {
                    createError: createError.message || 'Failed to create token',
                    creating: false,
                } );
            } );
    }

    handleCopy () {
        if ( this.state.createdToken && navigator.clipboard ) {
            navigator.clipboard.writeText( this.state.createdToken.token );
        }
    }

    handleRevoke ( tokenId ) {
        api.deleteResource( `/tokens/${ tokenId }` )
            .then( () => {
                this.loadTokens();
            } )
            .catch( ( revokeError ) => {
                this.setState( {
                    error: revokeError.message || 'Failed to revoke token',
                } );
            } );
    }

    renderCreateDialog () {
        return (
            <Dialog
                fullWidth
                onClose = { this.handleCloseCreate }
                open = { this.state.createOpen }
            >
                <DialogTitle>
                    { 'New token' }
                </DialogTitle>
                <DialogContent>
                    { this.state.createdToken
                        ? <Box>
                            <Alert
                                severity = { 'success' }
                                sx = { {
                                    mb: 2,
                                } }
                            >
                                { 'Copy this token now — it won\'t be shown again.' }
                            </Alert>
                            <Box
                                sx = { {
                                    alignItems: 'center',
                                    display: 'flex',
                                    gap: 1,
                                } }
                            >
                                <TextField
                                    fullWidth
                                    slotProps = { {
                                        input: {
                                            readOnly: true,
                                        },
                                    } }
                                    value = { this.state.createdToken.token }
                                    variant = { 'outlined' }
                                />
                                <Button
                                    onClick = { this.handleCopy }
                                    variant = { 'contained' }
                                >
                                    { 'Copy' }
                                </Button>
                            </Box>
                        </Box>
                        : <Box>
                            { this.state.createError &&
                                <Alert
                                    severity = { 'error' }
                                    sx = { {
                                        mb: 2,
                                    } }
                                >
                                    { this.state.createError }
                                </Alert>
                            }
                            <TextField
                                fullWidth
                                label = { 'Name' }
                                onChange = { ( event ) => {
                                    this.setState( {
                                        newName: event.target.value,
                                    } );
                                } }
                                sx = { {
                                    mb: 2,
                                } }
                                value = { this.state.newName }
                                variant = { 'outlined' }
                            />
                            <Typography
                                color = { 'text.secondary' }
                                variant = { 'overline' }
                            >
                                { 'Scopes' }
                            </Typography>
                            <Box
                                sx = { {
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        sm: '1fr 1fr',
                                        xs: '1fr',
                                    },
                                } }
                            >
                                { AVAILABLE_SCOPES.map( ( scope ) => {
                                    return (
                                        <FormControlLabel
                                            control = {
                                                <Checkbox
                                                    checked = { this.state.newScopes.includes( scope ) }
                                                    onChange = { () => {
                                                        this.toggleScope( scope );
                                                    } }
                                                    size = { 'small' }
                                                />
                                            }
                                            key = { scope }
                                            label = { scope }
                                        />
                                    );
                                } ) }
                            </Box>
                        </Box>
                    }
                </DialogContent>
                <DialogActions>
                    { this.state.createdToken
                        ? <Button
                            onClick = { this.handleCloseCreate }
                        >
                            { 'Done' }
                        </Button>
                        : <React.Fragment>
                            <Button
                                color = { 'secondary' }
                                onClick = { this.handleCloseCreate }
                            >
                                { 'Cancel' }
                            </Button>
                            <Button
                                disabled = { this.state.creating }
                                onClick = { this.handleCreate }
                                variant = { 'contained' }
                            >
                                { 'Create' }
                            </Button>
                        </React.Fragment>
                    }
                </DialogActions>
            </Dialog>
        );
    }

    renderTable () {
        if ( this.state.loading ) {
            return (
                <Box
                    sx = { {
                        display: 'flex',
                        justifyContent: 'center',
                        p: 6,
                    } }
                >
                    <CircularProgress />
                </Box>
            );
        }

        if ( this.state.tokens.length === 0 ) {
            return (
                <Typography
                    color = { 'text.secondary' }
                    variant = { 'body2' }
                >
                    { 'No tokens yet.' }
                </Typography>
            );
        }

        return (
            <Paper
                elevation = { 2 }
            >
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{ 'Name' }</TableCell>
                            <TableCell>{ 'Scopes' }</TableCell>
                            <TableCell align = { 'right' }>{ '' }</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        { this.state.tokens.map( ( token ) => {
                            return (
                                <TableRow
                                    key = { token.id }
                                >
                                    <TableCell>{ token.name }</TableCell>
                                    <TableCell>
                                        <Box
                                            sx = { {
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 0.5,
                                            } }
                                        >
                                            { ( token.scopes || [] ).map( ( scope ) => {
                                                return (
                                                    <Chip
                                                        key = { scope }
                                                        label = { scope }
                                                        size = { 'small' }
                                                    />
                                                );
                                            } ) }
                                        </Box>
                                    </TableCell>
                                    <TableCell align = { 'right' }>
                                        <IconButton
                                            onClick = { () => {
                                                this.handleRevoke( token.id );
                                            } }
                                            size = { 'small' }
                                        >
                                            <DeleteIcon
                                                fontSize = { 'small' }
                                            />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        } ) }
                    </TableBody>
                </Table>
            </Paper>
        );
    }

    render () {
        return (
            <div>
                <Header
                    actions = {
                        <Button
                            color = { 'inherit' }
                            onClick = { this.handleOpenCreate }
                            startIcon = { <AddIcon /> }
                        >
                            { 'New token' }
                        </Button>
                    }
                    onNavigate = { this.props.onNavigate }
                    view = { 'tokens' }
                />
                <Box
                    sx = { {
                        m: '0 auto',
                        maxWidth: 1100,
                        p: {
                            sm: 3,
                            xs: 2,
                        },
                    } }
                >
                    { this.state.error &&
                        <Alert
                            severity = { 'error' }
                            sx = { {
                                mb: 3,
                            } }
                        >
                            { `Couldn't load tokens: ${ this.state.error }` }
                        </Alert>
                    }
                    { this.renderTable() }
                </Box>
                { this.renderCreateDialog() }
            </div>
        );
    }
}

Tokens.displayName = 'Tokens';

Tokens.propTypes = {
    onNavigate: PropTypes.func.isRequired,
};

export default Tokens;
