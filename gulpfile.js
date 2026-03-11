/**
 * Gulp tasks
 *
 * @remarks
 * NOTE: バージョン文字列は `yyyy.m.d+<hash>` 形式で生成されます（ゼロ埋め無し）。
 * NOTE: git が利用できない環境ではビルド日時から同形式のバージョンを生成します。
 */

const fs = require('fs');
const { execSync } = require('child_process');
const gulp = require('gulp');
const replace = require('gulp-replace');
const terser = require('gulp-terser');
const cssnano = require('gulp-cssnano');

const locales = require('./locales');

/**
 * 最終コミット日時またはビルド日時からバージョン文字列を生成する。
 *
 * @remarks
 * - 形式は `yyyy.m.d+<hash>`（月と日はゼロ埋めしない）となります。
 * - git から取得する日付はゼロ埋めされた `yyyy.mm.dd` 形式のため、数値変換してから整形し直しています。
 *
 * @returns {string} `yyyy.m.d+<hash>` 形式のバージョン文字列
 */
const buildVersion = () => {
	let date;
	try {
		// 最終コミット日を yyyy.mm.dd 形式で取得（後でゼロ埋めを外す）
		const out = execSync(
			"git log -1 --format=%cd --date=format:'%Y.%m.%d'",
			{ encoding: "utf8" },
		).trim();
		if (out) {
			const [yRaw, mRaw, dRaw] = out.split('.');
			const y = Number(yRaw);
			const m = Number(mRaw);
			const d = Number(dRaw);
			date = `${y}.${m}.${d}`;
		} else {
			date = '';
		}
	} catch {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth() + 1;
		const d = now.getDate();
		date = `${y}.${m}.${d}`;
	}
	const hash = (process.env.COMMIT_HASH || 'dev').slice(0, 6);
	return `${date}+${hash}`;
};

const version = buildVersion();

gulp.task('copy:backend:views', () =>
	gulp.src('./packages/backend/src/server/web/views/**/*').pipe(gulp.dest('./packages/backend/built/server/web/views'))
);


gulp.task('copy:backend:custom', () =>
	gulp.src('./custom/assets/**/*').pipe(gulp.dest('./packages/backend/assets/'))
);

gulp.task('copy:client:fonts', () =>
	gulp.src('./packages/client/node_modules/three/examples/fonts/**/*').pipe(gulp.dest('./built/_client_dist_/fonts/'))
);

gulp.task('copy:client:locales', cb => {
	fs.mkdirSync('./built/_client_dist_/locales', { recursive: true });

	const v = { '_version_': version };

	for (const [lang, locale] of Object.entries(locales)) {
		fs.writeFileSync(`./built/_client_dist_/locales/${lang}.${version}.json`, JSON.stringify({ ...locale, ...v }), 'utf-8');
	}

	cb();
});


gulp.task('build:backend:script', () => {
	return gulp.src(['./packages/backend/src/server/web/boot.js', './packages/backend/src/server/web/bios.js', './packages/backend/src/server/web/cli.js'])
		.pipe(replace('LANGS', JSON.stringify(Object.keys(locales))))
		.pipe(terser({
			toplevel: true
		}))
		.pipe(gulp.dest('./packages/backend/built/server/web/'));
});

gulp.task('build:backend:style', () => {
	return gulp.src(['./packages/backend/src/server/web/style.css', './packages/backend/src/server/web/bios.css', './packages/backend/src/server/web/cli.css'])
		.pipe(cssnano({
			zindex: false
		}))
		.pipe(gulp.dest('./packages/backend/built/server/web/'));
});

/**
 * Light Client 用の light.css / light.js を minify して built に出力する。
 * ソースは整形のまま維持し、minify はビルド出力のみ。
 */
gulp.task('build:backend:light', () => {
	const lightTasks = [
		gulp.src('./packages/backend/src/server/web/light.css')
			.pipe(cssnano({ zindex: false }))
			.pipe(gulp.dest('./packages/backend/built/server/web/')),
		gulp.src('./packages/backend/src/server/web/light.js')
			.pipe(terser({ toplevel: true }))
			.pipe(gulp.dest('./packages/backend/built/server/web/')),
	];
	return Promise.all(lightTasks);
});

gulp.task('build', gulp.parallel(
	'copy:client:locales', 'copy:backend:views', 'copy:backend:custom', 'build:backend:script', 'build:backend:style', 'build:backend:light', 'copy:client:fonts'
));

gulp.task('default', gulp.task('build'));

gulp.task('watch', () => {
	gulp.watch([
		'./packages/*/src/**/*',
	], { ignoreInitial: false }, gulp.task('build'));
});
