/**
 * Gulp tasks
 */

import * as fs from 'fs';
import * as gulp from 'gulp';
import * as gutil from 'gulp-util';
import * as ts from 'gulp-typescript';
const sourcemaps = require('gulp-sourcemaps');
import tslint from 'gulp-tslint';
const cssnano = require('gulp-cssnano');
const stylus = require('gulp-stylus');
import * as uglifyComposer from 'gulp-uglify/composer';
import pug = require('gulp-pug');
import * as rimraf from 'rimraf';
import chalk from 'chalk';
const imagemin = require('gulp-imagemin');
import * as rename from 'gulp-rename';
import * as mocha from 'gulp-mocha';
import * as replace from 'gulp-replace';
import * as htmlmin from 'gulp-htmlmin';
const uglifyes = require('uglify-es');

const locales = require('./locales');
import { fa } from './src/misc/fa';

const uglify = uglifyComposer(uglifyes, console);

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const isDebug = !isProduction;

if (isDebug) {
	console.warn(chalk.yellow.bold('WARNING! NODE_ENV is not "production".'));
	console.warn(chalk.yellow.bold('         built script will not be compressed.'));
}

const constants = require('./src/const.json');

gulp.task('build', [
	'build:ts',
	'build:copy',
	'build:client',
	'doc'
]);

gulp.task('build:ts', () => {
	const tsProject = ts.createProject('./tsconfig.json');

	return tsProject
		.src()
		.pipe(sourcemaps.init())
		.pipe(tsProject())
		.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../built' }))
		.pipe(gulp.dest('./built/'));
});

gulp.task('build:copy:views', () =>
	gulp.src('./src/server/web/views/**/*').pipe(gulp.dest('./built/server/web/views'))
);

// 互換性のため
gulp.task('build:copy:lang', () =>
	gulp.src(['./built/client/assets/*.*-*.js'])
		.pipe(rename(path => {
			path.basename = path.basename.replace(/\-(.*)$/, '');
		}))
		.pipe(gulp.dest('./built/client/assets/'))
);

gulp.task('build:copy', ['build:copy:views', 'build:copy:lang'], () =>
	gulp.src([
		'./build/Release/crypto_key.node',
		'./src/const.json',
		'./src/server/web/views/**/*',
		'./src/**/assets/**/*',
		'!./src/client/app/**/assets/**/*'
	]).pipe(gulp.dest('./built/'))
);

gulp.task('test', ['lint', 'mocha']);

gulp.task('lint', () =>
	gulp.src('./src/**/*.ts')
		.pipe(tslint({
			formatter: 'verbose'
		}))
		.pipe(tslint.report())
);

gulp.task('format', () =>
	gulp.src('./src/**/*.ts')
		.pipe(tslint({
			formatter: 'verbose',
			fix: true
		}))
		.pipe(tslint.report())
);

gulp.task('mocha', () =>
	gulp.src('./test/**/*.ts')
		.pipe(mocha({
			exit: true,
			require: 'ts-node/register'
		} as any))
);

gulp.task('clean', cb =>
	rimraf('./built', cb)
);

gulp.task('cleanall', ['clean'], cb =>
	rimraf('./node_modules', cb)
);

gulp.task('default', ['build']);

gulp.task('build:client', [
	'build:ts',
	'build:client:script',
	'build:client:pug',
	'copy:client'
]);

gulp.task('build:client:script', () => {
	const client = require('./built/client/meta.json');
	return gulp.src(['./src/client/app/boot.js', './src/client/app/safe.js'])
		.pipe(replace('VERSION', JSON.stringify(client.version)))
		.pipe(replace('ENV', JSON.stringify(env)))
		.pipe(replace('LANGS', JSON.stringify(Object.keys(locales))))
		.pipe(isProduction ? uglify({
			toplevel: true
		} as any) : gutil.noop())
		.pipe(gulp.dest('./built/client/assets/'));
});

gulp.task('build:client:styles', () =>
	gulp.src('./src/client/app/init.css')
		.pipe(isProduction
			? (cssnano as any)()
			: gutil.noop())
		.pipe(gulp.dest('./built/client/assets/'))
);

gulp.task('copy:client', [
	'build:client:script'
], () =>
		gulp.src([
			'./assets/**/*',
			'./src/client/assets/**/*',
			'./src/client/app/*/assets/**/*'
		])
			.pipe(isProduction ? (imagemin as any)() : gutil.noop())
			.pipe(rename(path => {
				path.dirname = path.dirname.replace('assets', '.');
			}))
			.pipe(gulp.dest('./built/client/assets/'))
);

gulp.task('build:client:pug', [
	'copy:client',
	'build:client:script',
	'build:client:styles'
], () =>
		gulp.src('./src/client/app/base.pug')
			.pipe(pug({
				locals: {
					themeColor: constants.themeColor,
					facss: fa.dom.css(),
					//hljscss: fs.readFileSync('./node_modules/highlight.js/styles/default.css', 'utf8')
					hljscss: fs.readFileSync('./src/client/assets/code-highlight.css', 'utf8')
				}
			}))
			.pipe(htmlmin({
				// 真理値属性の簡略化 e.g.
				// <input value="foo" readonly="readonly"> to
				// <input value="foo" readonly>
				collapseBooleanAttributes: true,

				// テキストの一部かもしれない空白も削除する e.g.
				// <div> <p>    foo </p>    </div> to
				// <div><p>foo</p></div>
				collapseWhitespace: true,

				// タグ間の改行を保持する
				preserveLineBreaks: true,

				// (できる場合は)属性のクォーテーション削除する e.g.
				// <p class="foo-bar" id="moo" title="blah blah">foo</p> to
				// <p class=foo-bar id=moo title="blah blah">foo</p>
				removeAttributeQuotes: true,

				// 省略可能なタグを省略する e.g.
				// <html><p>yo</p></html> ro
				// <p>yo</p>
				removeOptionalTags: true,

				// 属性の値がデフォルトと同じなら省略する e.g.
				// <input type="text"> to
				// <input>
				removeRedundantAttributes: true,

				// CSSも圧縮する
				minifyCSS: true
			}))
			.pipe(gulp.dest('./built/client/app/'))
);

gulp.task('doc', () =>
	gulp.src('./src/docs/**/*.styl')
		.pipe(stylus())
		.pipe((cssnano as any)())
		.pipe(gulp.dest('./built/docs/assets/'))
);
