/**
 * webpack configuration
 */

import module_ from './module';
import plugins from './plugins';

import langs from './langs';
import version from '../src/version';

module.exports = langs.map(([lang, locale]) => {
	// Chunk name
	const name = lang;

	// Entries
	const entry = {
		desktop: './src/web/app/desktop/script.ts',
		mobile: './src/web/app/mobile/script.ts',
		ch: './src/web/app/ch/script.ts',
		stats: './src/web/app/stats/script.ts',
		status: './src/web/app/status/script.ts',
		dev: './src/web/app/dev/script.ts',
		auth: './src/web/app/auth/script.ts'
	};

	const output = {
		path: __dirname + '/../built/web/assets',
		filename: `[name].${version}.${lang}.js`
	};

	return {
		name,
		entry,
		module: module_(lang, locale),
		plugins: plugins(version, lang),
		output,
		resolve: {
			extensions: [
				'.js', '.ts'
			]
		}
	};
});
