/**
 * webpack configuration
 */

import * as fs from 'fs';
import * as webpack from 'webpack';
import chalk from 'chalk';
const { VueLoaderPlugin } = require('vue-loader');
const jsonImporter = require('node-sass-json-importer');
const minifyHtml = require('html-minifier').minify;
const WebpackOnBuildPlugin = require('on-build-webpack');
//const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');

import I18nReplacer from './src/misc/i18n';
import { pattern as i18nPattern, replacement as i18nReplacement } from './webpack/i18n';
import { pattern as faPattern, replacement as faReplacement } from './src/misc/fa';
const constants = require('./src/const.json');
import config from './src/config';
import { licenseHtml } from './src/misc/license';

const locales = require('./locales');
const meta = require('./package.json');
const version = meta.clientVersion;
const codename = meta.codename;

declare var global: {
	faReplacement: typeof faReplacement;
	collapseSpacesReplacement: any;
	base64replacement: any;
	i18nReplacement: typeof i18nReplacement;
};

//#region Replacer definitions
global['faReplacement'] = faReplacement;

global['collapseSpacesReplacement'] = (html: string) => {
	return minifyHtml(html, {
		collapseWhitespace: true,
		collapseInlineTagWhitespace: true,
		keepClosingSlash: true
	}).replace(/\t/g, '');
};

global['base64replacement'] = (_: any, key: string) => {
	return fs.readFileSync(__dirname + '/src/client/' + key, 'base64');
};

global['i18nReplacement'] = i18nReplacement;

//#endregion

const langs = Object.keys(locales);

const isProduction = process.env.NODE_ENV == 'production';

// Entries
const entry = {
	desktop: './src/client/app/desktop/script.ts',
	mobile: './src/client/app/mobile/script.ts',
	//stats: './src/client/app/stats/script.ts',
	//status: './src/client/app/status/script.ts',
	dev: './src/client/app/dev/script.ts',
	auth: './src/client/app/auth/script.ts',
	sw: './src/client/app/sw.js'
};

const output = {
	path: __dirname + '/built/client/assets',
	filename: `[name].${version}.-.js`
};

//#region Define consts
const consts = {
	_RECAPTCHA_SITEKEY_: config.recaptcha.site_key,
	_SW_PUBLICKEY_: config.sw ? config.sw.public_key : null,
	_THEME_COLOR_: constants.themeColor,
	_COPYRIGHT_: constants.copyright,
	_VERSION_: version,
	_CODENAME_: codename,
	_STATUS_URL_: config.status_url,
	_STATS_URL_: config.stats_url,
	_DOCS_URL_: config.docs_url,
	_API_URL_: config.api_url,
	_WS_URL_: config.ws_url,
	_DEV_URL_: config.dev_url,
	_REPOSITORY_URL_: config.maintainer.repository_url,
	_FEEDBACK_URL_: config.maintainer.feedback_url,
	_LANG_: '%lang%',
	_LANGS_: Object.keys(locales).map(l => [l, locales[l].meta.lang]),
	_NAME_: config.name,
	_DESCRIPTION_: config.description,
	_HOST_: config.host,
	_HOSTNAME_: config.hostname,
	_URL_: config.url,
	_LICENSE_: licenseHtml,
	_GOOGLE_MAPS_API_KEY_: config.google_maps_api_key,
	_WELCOME_BG_URL_: config.welcome_bg_url
};

const _consts: { [ key: string ]: any } = {};

Object.keys(consts).forEach(key => {
	_consts[key] = JSON.stringify((consts as any)[key]);
});
//#endregion

const plugins = [
	//new HardSourceWebpackPlugin(),
	new ProgressBarPlugin({
		format: chalk`  {cyan.bold yes we can} {bold [}:bar{bold ]} {green.bold :percent} {gray (:current/:total)} :elapseds`,
		clear: false
	}),
	new webpack.DefinePlugin(_consts),
	new webpack.DefinePlugin({
		'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
	}),
	new WebpackOnBuildPlugin((stats: any) => {
		fs.writeFileSync('./built/client/meta.json', JSON.stringify({
			version
		}), 'utf-8');

		//#region i18n
		langs.forEach(lang => {
			Object.keys(entry).forEach(file => {
				let src = fs.readFileSync(`${__dirname}/built/client/assets/${file}.${version}.-.js`, 'utf-8');

				const i18nReplacer = new I18nReplacer(lang);

				src = src.replace(i18nReplacer.pattern, i18nReplacer.replacement);
				src = src.replace('%lang%', lang);

				fs.writeFileSync(`${__dirname}/built/client/assets/${file}.${version}.${lang}.js`, src, 'utf-8');
			});
		});
		//#endregion
	}),
	new VueLoaderPlugin()
];

if (isProduction) {
	plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
}

module.exports = {
	entry,
	module: {
		rules: [{
			test: /\.vue$/,
			exclude: /node_modules/,
			use: [{
				loader: 'vue-loader',
				options: {
					cssSourceMap: false,
					compilerOptions: {
						preserveWhitespace: false
					}
				}
			}, {
				loader: 'replace',
				query: {
					qs: [{
						search: /%base64:(.+?)%/g.toString(),
						replace: 'base64replacement'
					}, {
						search: i18nPattern.toString(),
						replace: 'i18nReplacement',
						i18n: true
					}, {
						search: faPattern.toString(),
						replace: 'faReplacement'
					}, {
						search: /^<template>([\s\S]+?)\r?\n<\/template>/.toString(),
						replace: 'collapseSpacesReplacement'
					}]
				}
			}]
		}, {
			test: /\.styl(us)?$/,
			exclude: /node_modules/,
			oneOf: [{
				resourceQuery: /module/,
				use: [{
					loader: 'vue-style-loader'
				}, {
					loader: 'css-loader',
					options: {
						modules: true,
						minimize: true
					}
				}, {
					loader: 'stylus-loader'
				}]
			}, {
				use: [{
					loader: 'vue-style-loader'
				}, {
					loader: 'css-loader',
					options: {
						minimize: true
					}
				}, {
					loader: 'stylus-loader'
				}]
			}]
		}, {
			test: /\.scss$/,
			exclude: /node_modules/,
			use: [{
				loader: 'style-loader'
			}, {
				loader: 'css-loader',
				options: {
					minimize: true
				}
			}, {
				loader: 'sass-loader',
				options: {
					importer: jsonImporter,
				}
			}]
		}, {
			test: /\.css$/,
			use: [{
				loader: 'vue-style-loader'
			}, {
				loader: 'css-loader',
				options: {
					minimize: true
				}
			}]
		}, {
			test: /\.(eot|woff|woff2|svg|ttf)([\?]?.*)$/,
			loader: 'url-loader'
		}, {
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader',
				options: {
					happyPackMode: true,
					configFile: __dirname + '/src/client/app/tsconfig.json',
					appendTsSuffixTo: [/\.vue$/]
				}
			}, {
				loader: 'replace',
				query: {
					qs: [{
						search: i18nPattern.toString(),
						replace: 'i18nReplacement',
						i18n: true
					}, {
						search: faPattern.toString(),
						replace: 'faReplacement'
					}]
				}
			}]
		}]
	},
	plugins,
	output,
	resolve: {
		extensions: [
			'.js', '.ts', '.json'
		],
		alias: {
			'const.styl': __dirname + '/src/client/const.styl'
		}
	},
	resolveLoader: {
		modules: ['node_modules', './webpack/loaders']
	},
	cache: true,
	devtool: false, //'source-map',
	mode: isProduction ? 'production' : 'development'
};
