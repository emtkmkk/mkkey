/**
 * @file merge-en-US.js
 * @description
 * ja-JP のキーを en-US にマージする。ja-JP にのみ存在するキーを
 * translations-en.json の英語訳で補い、ja-JP のキー順で en-US.yml を出力する。
 * 使用: node locales/merge-en-US.js
 * 入力: locales/ja-JP.yml, locales/en-US.yml, locales/translations-en.json
 * 出力: locales/en-US.yml
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const dir = __dirname;
const ja = yaml.load(fs.readFileSync(path.join(dir, 'ja-JP.yml'), 'utf8'));
const en = yaml.load(fs.readFileSync(path.join(dir, 'en-US.yml'), 'utf8'));
const translations = JSON.parse(fs.readFileSync(path.join(dir, 'translations-en.json'), 'utf8'));

const jaKeys = Object.keys(ja);
const enKeysSet = new Set(Object.keys(en));
const result = {};

// Build in ja-JP key order: use en value if present, else use translation
for (const k of jaKeys) {
  if (en[k] !== undefined) {
    result[k] = en[k];
  } else if (translations[k] !== undefined) {
    result[k] = translations[k];
  } else {
    console.error('Missing translation for key:', k);
    result[k] = ja[k]; // fallback to Japanese
  }
}

// Append keys that exist only in en-US
for (const k of Object.keys(en)) {
  if (!(k in result)) result[k] = en[k];
}

// Write YAML (no leading --- to match current en-US)
const out = yaml.dump(result, {
  lineWidth: -1,
  noRefs: true,
  quotingType: '"',
  forceQuotes: true,
});
fs.writeFileSync(path.join(dir, 'en-US.yml'), out.trimEnd() + '\n', 'utf8');
console.log('Written en-US.yml with', Object.keys(result).length, 'keys');
