const path = require( 'path' );

module.exports = {
    entry: './src/App.jsx',
    module: {
        rules: [
            {
                exclude: /(node_modules|bower_components)/,
                test: /\.jsx?$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        plugins: [
                            'transform-object-rest-spread',
                        ],
                        presets: [
                            'env',
                            'react',
                        ],
                    },
                },
            },
        ],
    },
    output: {
        filename: 'app.js',
        path: path.resolve( __dirname, 'web/scripts' ),
    },
    resolve: {
        extensions: [
            '.js',
            '.jsx',
        ],
    },
};
