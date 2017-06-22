var path = require('path');

module.exports = {
    entry: './src/App.jsx',
    output: {
        filename: 'app.js',
        path: path.resolve( __dirname, 'web/scripts' )
    },
    resolve: {
        extensions: [ '.js', '.jsx' ]
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            'env',
                            'react'
                        ],
                        plugins: [
                            'transform-object-rest-spread'
                        ]
                    }
                }
            }
        ]
    }
};
