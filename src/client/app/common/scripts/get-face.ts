const faces = [
	'(=^・・^=)',
	'v(\'ω\')v',
	'🐡( \'-\' 🐡 )ﾌｸﾞﾊﾟﾝﾁ!!!!',
	'✌️(´･_･`)✌️',
	'(｡>﹏<｡)',
	'(Δ・x・Δ)',
	'(ｺ｀・ﾍ・´ｹ)'
];

export default () => faces[Math.floor(Math.random() * faces.length)];
