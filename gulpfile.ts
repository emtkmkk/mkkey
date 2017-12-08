/**
 * Gulp tasks
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as Path from 'path';
import * as gulp from 'gulp';
import * as gutil from 'gulp-util';
import * as ts from 'gulp-typescript';
import tslint from 'gulp-tslint';
import * as es from 'event-stream';
import cssnano = require('gulp-cssnano');
import * as uglifyComposer from 'gulp-uglify/composer';
import pug = require('gulp-pug');
import * as rimraf from 'rimraf';
import chalk from 'chalk';
import imagemin = require('gulp-imagemin');
import * as rename from 'gulp-rename';
import * as mocha from 'gulp-mocha';
import * as replace from 'gulp-replace';
import * as htmlmin from 'gulp-htmlmin';
const uglifyes = require('uglify-es');
import * as fontawesome from '@fortawesome/fontawesome';
import * as regular from '@fortawesome/fontawesome-free-regular';
import * as solid from '@fortawesome/fontawesome-free-solid';
import * as brands from '@fortawesome/fontawesome-free-brands';

// Add icons
fontawesome.library.add(regular);
fontawesome.library.add(solid);
fontawesome.library.add(brands);

import version from './src/version';

const uglify = uglifyComposer(uglifyes, console);

const env = process.env.NODE_ENV;
const isProduction = env === 'production';
const isDebug = !isProduction;

if (isDebug) {
	console.warn(chalk.yellow.bold('WARNING! NODE_ENV is not "production".'));
	console.warn(chalk.yellow.bold('         built script will not be compressed.'));
}

const constants = require('./src/const.json');

gulp.task('build', [
	'build:js',
	'build:ts',
	'build:copy',
	'build:client'
]);

gulp.task('rebuild', ['clean', 'build']);

gulp.task('build:js', () =>
	gulp.src(['./src/**/*.js', '!./src/web/**/*.js'])
		.pipe(gulp.dest('./built/'))
);

gulp.task('build:ts', () => {
	const tsProject = ts.createProject('./src/tsconfig.json');

	return tsProject
		.src()
		.pipe(tsProject())
		.pipe(gulp.dest('./built/'));
});

gulp.task('build:copy', () =>
	es.merge(
		gulp.src([
			'./src/**/assets/**/*',
			'!./src/web/app/**/assets/**/*'
		]).pipe(gulp.dest('./built/')) as any,
		gulp.src([
			'./src/web/about/**/*',
			'!./src/web/about/**/*.pug'
		]).pipe(gulp.dest('./built/web/about/')) as any
	)
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
	gulp.src([])
		.pipe(mocha({
			exit: true
			//compilers: 'ts:ts-node/register'
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
	'build:js',
	'webpack',
	'build:client:script',
	'build:client:pug',
	'copy:client'
]);

gulp.task('webpack', done => {
	const webpack = childProcess.spawn(
		Path.join('.', 'node_modules', '.bin', 'webpack'),
		['--config', './webpack/webpack.config.ts'], {
			shell: true,
			stdio: 'inherit'
		});

	webpack.on('exit', done);
});

gulp.task('build:client:script', () =>
	gulp.src(['./src/web/app/boot.js', './src/web/app/safe.js'])
		.pipe(replace('VERSION', JSON.stringify(version)))
		.pipe(isProduction ? uglify({
			toplevel: true
		} as any) : gutil.noop())
		.pipe(gulp.dest('./built/web/assets/')) as any
);

gulp.task('build:client:styles', () =>
	gulp.src('./src/web/app/init.css')
		.pipe(isProduction
			? (cssnano as any)()
			: gutil.noop())
		.pipe(gulp.dest('./built/web/assets/'))
);

gulp.task('copy:client', [
	'build:client:script',
	'webpack'
], () =>
		gulp.src([
			'./assets/**/*',
			'./src/web/assets/**/*',
			'./src/web/app/*/assets/**/*'
		])
			.pipe(isProduction ? (imagemin as any)() : gutil.noop())
			.pipe(rename(path => {
				path.dirname = path.dirname.replace('assets', '.');
			}))
			.pipe(gulp.dest('./built/web/assets/'))
);

gulp.task('build:client:pug', [
	'copy:client',
	'build:client:script',
	'build:client:styles'
], () =>
		gulp.src('./src/web/app/base.pug')
			.pipe(pug({
				locals: {
					themeColor: constants.themeColor,
					facss: fontawesome.dom.css(),
					//hljscss: fs.readFileSync('./node_modules/highlight.js/styles/default.css', 'utf8')
					hljscss: fs.readFileSync('./src/web/assets/code-highlight.css', 'utf8')
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
			.pipe(gulp.dest('./built/web/app/'))
);
