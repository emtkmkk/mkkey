/**
 * 型チェックをまとめて実行し、既知のエラー一覧（ベースライン）と比較するスクリプト。
 *
 * このリポジトリのビルドは swc / esbuild を使っていて型を見ないため、型エラーがあってもビルドは通る。
 * そのため「今あるエラーは記録しておき、これ以上増やさない」ことを担保するのがこのスクリプトの役割。
 *
 * 使い方:
 *   node ./scripts/typecheck.js            現状とベースラインを比較する。増えていたら異常終了する
 *   node ./scripts/typecheck.js --update   今の状態を新しいベースラインとして保存する
 *
 * ベースラインは行番号を持たない（ファイル名 + エラー番号 + 件数 だけを記録する）。
 * 行がずれただけで差分が出ないようにするため。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** リポジトリのルート */
const repoRoot = path.resolve(__dirname, '..');

/** ベースラインの保存先 */
const baselinePath = path.join(repoRoot, 'dev', 'typecheck-baseline.json');

/**
 * 型チェックの対象。
 *
 * client は .vue ファイルを含むため tsc だけでは検査できない（vue-tsc の導入が必要）。
 * 導入するまでは対象外とする。
 */
const targets = [
	{ name: 'backend', dir: 'packages/backend' },
	{ name: 'sw', dir: 'packages/sw' },
	{ name: 'calckey-js', dir: 'packages/calckey-js' },
];

/** tsc の実体 */
const tscPath = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

/** `src/foo.ts(12,34): error TS2345: ...` の形の行を拾う */
const errorLineRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+):/;

/**
 * パスをリポジトリのルートからの相対パスに揃える。
 * OS による区切り文字の違いを吸収するため、常に `/` 区切りにする。
 */
function normalizePath(pkgDir, filePath) {
	const abs = path.resolve(repoRoot, pkgDir, filePath);
	return path.relative(repoRoot, abs).split(path.sep).join('/');
}

/**
 * 1 パッケージ分の型チェックを実行し、結果を集計して返す。
 */
function typecheck(target) {
	const cwd = path.join(repoRoot, target.dir);
	const result = spawnSync(process.execPath, [tscPath, '--noEmit', '-p', 'tsconfig.json'], {
		cwd,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	});

	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

	/** ファイル名 → エラー番号 → 件数 */
	const files = {};
	let total = 0;

	for (const line of output.split(/\r?\n/)) {
		const matched = errorLineRegex.exec(line);
		if (matched == null) continue;

		const file = normalizePath(target.dir, matched[1]);
		const code = matched[4];

		files[file] ??= {};
		files[file][code] = (files[file][code] ?? 0) + 1;
		total++;
	}

	// tsc がエラー以外の理由で落ちた場合（設定ミスなど）は気付けるようにしておく
	if (total === 0 && result.status !== 0) {
		console.error(`[${target.name}] 型チェックを実行できませんでした:\n${output.trim()}`);
		process.exitCode = 1;
	}

	return { total, files };
}

/**
 * 現状とベースラインを比べ、増えたものだけを返す。
 */
function diff(current, baseline) {
	const added = [];

	for (const [pkgName, pkgResult] of Object.entries(current)) {
		const basePkg = baseline?.packages?.[pkgName]?.files ?? {};

		for (const [file, codes] of Object.entries(pkgResult.files)) {
			for (const [code, count] of Object.entries(codes)) {
				const baseCount = basePkg[file]?.[code] ?? 0;
				if (count > baseCount) {
					added.push({ pkgName, file, code, count, baseCount });
				}
			}
		}
	}

	return added;
}

(() => {
	const shouldUpdate = process.argv.includes('--update');

	/** パッケージ名 → 集計結果 */
	const current = {};

	for (const target of targets) {
		process.stdout.write(`型チェック中: ${target.name} ... `);
		current[target.name] = typecheck(target);
		console.log(`${current[target.name].total} 件`);
	}

	const currentTotal = Object.values(current).reduce((a, b) => a + b.total, 0);

	if (shouldUpdate) {
		const baseline = {
			generatedAt: new Date().toISOString(),
			note: '型エラーの既知一覧。scripts/typecheck.js が「増えていないか」を判定するために使う。減ったときは --update で更新する。',
			total: currentTotal,
			packages: current,
		};
		fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
		fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, '\t')}\n`);
		console.log(`\nベースラインを更新しました（合計 ${currentTotal} 件）: ${path.relative(repoRoot, baselinePath)}`);
		return;
	}

	if (!fs.existsSync(baselinePath)) {
		console.error('\nベースラインがありません。まず `pnpm run typecheck:update` を実行してください。');
		process.exitCode = 1;
		return;
	}

	const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
	const added = diff(current, baseline);

	console.log(`\n合計 ${currentTotal} 件（ベースライン: ${baseline.total} 件）`);

	if (added.length > 0) {
		console.error(`\nベースラインに無いエラーが ${added.length} 種類あります:`);
		for (const item of added) {
			console.error(`  ${item.file}: ${item.code} ${item.baseCount} → ${item.count} 件`);
		}
		console.error('\n直すか、意図した増加であれば `pnpm run typecheck:update` でベースラインを更新してください。');
		process.exitCode = 1;
		return;
	}

	if (currentTotal < baseline.total) {
		console.log(`エラーが ${baseline.total - currentTotal} 件減りました。`);
		console.log('`pnpm run typecheck:update` でベースラインを更新してください。');
		return;
	}

	console.log('新しい型エラーはありません。');
})();
