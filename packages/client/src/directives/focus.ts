export default {
	// preventScroll: フォーカス時のスクロールを抑止する
	// (ページ表示時に RouterView がページ自体へフォーカスするため、
	// 既定のフォーカススクロールだとコンテンツ先頭が sticky ヘッダーの裏に隠れる)
	mounted: (el) => el.focus({ preventScroll: true }),
};
