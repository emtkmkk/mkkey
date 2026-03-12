const webpack = require("webpack");
const path = require("path");
const { execSync } = require("child_process");
const locales = require("../../locales");

const isProduction = process.env.NODE_ENV === "production";

const buildVersion = () => {
	let date;
	try {
		const out = execSync(
			"git log -1 --format=%cd --date=format:'%Y.%m.%d'",
			{ encoding: "utf8" },
		).trim();
		if (out) {
			const [yRaw, mRaw, dRaw] = out.split(".");
			const y = Number(yRaw);
			const m = Number(mRaw);
			const d = Number(dRaw);
			date = `${y}.${m}.${d}`;
		} else {
			date = "";
		}
	} catch {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth() + 1;
		const d = now.getDate();
		date = `${y}.${m}.${d}`;
	}
	const hash = (process.env.COMMIT_HASH || "dev").slice(0, 6);
	return `${date}+${hash}`;
};

module.exports = {
	mode: isProduction ? "production" : "development",
	stats: "errors-only",
	entry: "./src/sw.ts",
	output: {
		path: path.resolve(__dirname, "../../built/_sw_dist_"),
		filename: "sw.js",
	},
	resolve: {
		extensions: [".js", ".ts"],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: "swc-loader",
					options: {
						// This makes swc-loader invoke swc synchronously.
						sync: true,
						jsc: {
							parser: {
								syntax: "typescript",
							},
						},
					},
				},
			},
		],
	},
	plugins: [
		new webpack.DefinePlugin({
			_VERSION_: JSON.stringify(buildVersion()),
			_LANGS_: JSON.stringify(
				Object.entries(locales).map(([k, v]) => [k, v._lang_]),
			),
			_ENV_: JSON.stringify(process.env.NODE_ENV),
			_DEV_: !isProduction,
			_PERF_PREFIX_: JSON.stringify("Calckey:"),
		}),
	],
};
