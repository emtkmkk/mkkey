import * as webpack from 'webpack';
const ProgressBarPlugin = require('progress-bar-webpack-plugin');

import consts from './consts';
import hoist from './hoist';
import minify from './minify';

const env = process.env.NODE_ENV;
const isProduction = env === 'production';

export default (version, lang) => {
	const plugins = [
		new ProgressBarPlugin(),
		consts(lang),
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: JSON.stringify(process.env.NODE_ENV)
			}
		})
	];

	if (isProduction) {
		plugins.push(hoist());
		plugins.push(minify());
	}

	return plugins;
};
