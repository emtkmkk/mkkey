/**
 * Languages Loader
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';

const loadLang = lang => yaml.safeLoad(
	fs.readFileSync(`./locales/${lang}.yml`, 'utf-8'));

const native = loadLang('ja');

const langs = {
	'de': loadLang('de'),
	'en': loadLang('en'),
	'fr': loadLang('fr'),
	'ja': native,
	'pl': loadLang('pl')
};

Object.entries(langs).map(([, locale]) => {
	// Extend native language (Japanese)
	locale = Object.assign({}, native, locale);
});

export default langs;
