export const fontList = {
	'noto-sans': {
		name: 'Noto Sans JP',
		fontFamily: 'Noto Sans JP',
		importUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap',
	},
	'noto-serif': {
		name: '明朝',
		fontFamily: 'Noto Serif JP',
		importUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP&display=swap',
	},
	'kosugi': {
		name: '小杉',
		fontFamily: 'Kosugi',
		importUrl: 'https://fonts.googleapis.com/css2?family=Kosugi&display=swap',
	},
	'sawarabi Gothic': {
		name: 'さわらびゴシック',
		fontFamily: 'Sawarabi Gothic',
		importUrl: 'https://fonts.googleapis.com/css2?family=Sawarabi+Gothic&display=swap',
	},
	'sawarabi Mincho': {
		name: 'さわらび明朝',
		fontFamily: 'Sawarabi Mincho',
		importUrl: 'https://fonts.googleapis.com/css2?family=Sawarabi+Mincho&display=swap',
	},
	'Roboto': {
		name: 'Roboto',
		fontFamily: 'Roboto',
		importUrl: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap',
	},
	'm-plus': {
		name: 'M PLUS 1p',
		fontFamily: 'M PLUS 1p',
		importUrl: 'https://fonts.googleapis.com/css2?family=M+PLUS+1p&display=swap',
	},
	'm-plus-rounded': {
		name: 'M PLUS Rounded 1c',
		fontFamily: 'M PLUS Rounded 1c',
		importUrl: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c&display=swap',
	},
	'm-plus-2': {
		name: 'M PLUS 2',
		fontFamily: 'M PLUS 2',
		importUrl: 'https://fonts.googleapis.com/css2?family=M+PLUS+2&display=swap',
	},
	'kosugi-maru': {
		name: '小杉丸ゴシック',
		fontFamily: 'Kosugi Maru',
		importUrl: 'https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap',
	},
	'kiwi-maru': {
		name: 'キウイ丸',
		fontFamily: 'Kiwi Maru',
		importUrl: 'https://fonts.googleapis.com/css2?family=Kiwi+Maru&display=swap',
	},
	'biz-udpgothic': {
		name: 'BIZ UDゴシック',
		fontFamily: 'BIZ UDPGothic',
		importUrl: 'https://fonts.googleapis.com/css2?family=BIZ+UDPGothic&display=swap',
	},
	'biz-udmincho': {
		name: 'BIZ UD明朝',
		fontFamily: 'BIZ UDMincho',
		importUrl: 'https://fonts.googleapis.com/css2?family=BIZ+UDMincho&display=swap',
	},
	'new-tegomin': {
		name: 'テゴミン',
		fontFamily: 'New Tegomin',
		importUrl: 'https://fonts.googleapis.com/css2?family=New+Tegomin&display=swap',
	},
	'hachi-maru-pop': {
		name: 'はちまるポップ',
		fontFamily: 'Hachi Maru Pop',
		importUrl: 'https://fonts.googleapis.com/css2?family=Hachi+Maru+Pop&display=swap',
	},
	'mochiy-pop': {
		name: 'モッチーポップ',
		fontFamily: 'Mochiy Pop P One',
		importUrl: 'https://fonts.googleapis.com/css2?family=Mochiy+Pop+P+One&display=swap',
	},
	'Yomogi': {
		name: 'よもぎフォント',
		fontFamily: 'Yomogi',
		importUrl: 'https://fonts.googleapis.com/css2?family=Yomogi&display=swap',
	},
	'klee-one': {
		name: 'クレー One',
		fontFamily: 'Klee One',
		importUrl: 'https://fonts.googleapis.com/css2?family=Klee+One&display=swap',
	},
	'zen-kaku-gothic': {
		name: 'ZEN角ゴシック',
		fontFamily: 'Zen Kaku Gothic New',
		importUrl: 'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New&display=swap',
	},
	'zen-maru-gothic': {
		name: 'ZEN丸ゴシック',
		fontFamily: 'Zen Maru Gothic',
		importUrl: 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic&display=swap',
	},
	'sinecaption': {
		name: 'しねきゃぷしょん',
		fontFamily: 'しねきゃぷしょん',
		importUrl: 'https://mkkey.net/static-assets/sinecaption.css',
	},
	'kaisei-decol': {
		name: '解星デコール',
		fontFamily: 'Kaisei Decol',
		importUrl: 'https://fonts.googleapis.com/css2?family=Kaisei+Decol&display=swap',
	},
	'rocknroll-one': {
		name: 'ロックンロールワン',
		fontFamily: 'RocknRoll One',
		importUrl: 'https://fonts.googleapis.com/css2?family=RocknRoll+One&display=swap',
	},
	'stick': {
		name: 'ステッキ',
		fontFamily: 'Stick',
		importUrl: 'https://fonts.googleapis.com/css2?family=Stick&display=swap',
	},
	'yusei-magic': {
		name: 'ユセイマジック',
		fontFamily: 'Yusei Magic',
		importUrl: 'https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap',
	},
	'dot-gothic16': {
		name: 'ドットゴシック16',
		fontFamily: 'DotGothic16',
		importUrl: 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap',
	},
	'esenapaj': {
		name: 'エセナパJ',
		fontFamily: 'EsenapaJ',
		importUrl: 'https://mkkey.net/static-assets/esenapaj.css',
	},
};

export function applyFont(fontname: null | string) {
	let style = document.getElementById('custom-font');

	if (!fontname) {
		if (!style) return;
		return style.remove();
	}

	if (!style) {
		style = document.createElement('style');
		style.id = 'custom-font';
		document.head.appendChild(style);
	}

	let font = fontList[fontname];
	if (!font && fontname) font = {
		fontFamily: fontname,
		importUrl: `https://fonts.googleapis.com/css2?family=${fontname.replaceAll(/\s+/,"+")}&display=swap`,
	};

	style.innerHTML = `
		@import url('${font.importUrl}');
		body {
			font-family: '${font.fontFamily}', -apple-system, BlinkMacSystemFont, "BIZ UDGothic", Roboto, "Hiragino Sans", "Noto Sans CJK JP", HelveticaNeue, Arial, sans-serif, "Apple Color Emoji", "Noto Sans Emoji";
		}
	`;
}
