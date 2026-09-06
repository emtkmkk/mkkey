/**
 * webpack の DefinePlugin が差し込むコンパイル時定数の型宣言。
 *
 * @remarks
 * 実体は `packages/sw/webpack.config.js` の DefinePlugin にある。
 * 宣言が無く `TS2304: Cannot find name` が多数出ていたため追加した。
 */

/** 開発ビルドか */
declare const _DEV_: boolean;

/** クライアントのバージョン（package.json 由来） */
declare const _VERSION_: string;

/** 利用可能なロケール一覧 */
declare const _LANGS_: string[][];
