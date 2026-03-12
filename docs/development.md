# Cluckey 開発ドキュメント

このページは、`mkkey` のローカル開発を始めるための最短手順です。

## 1. 前提ソフト

- Node.js
- pnpm（corepack 推奨）
- PostgreSQL
- Redis

Nix 環境を使う場合は、既存の `flake.nix` / `devenv` 構成も利用できます（x86_64-linux で検証）。手順は次のとおりです。

1. [Nix](https://nixos.org/download.html) と [direnv](https://direnv.net/docs/installation.html) を入れ、シェルに direnv の hook を追加する。
2. リポジトリで `direnv allow` を実行し、開発用シェルを有効にする。
3. `devenv run install-deps` で依存を入れ、`devenv run prepare-config` で `.config/devenv.yml` を `.config/default.yml` にコピーする。
4. `.config/default.yml` の `db` / `redis` / `url` を編集する（devenv の Redis/PostgreSQL を使う場合はそのままでも可）。
5. `devenv up` を実行すると Redis / Postgres / 開発サーバーが起動する。初回は別ターミナルで `devenv run migrate` を実行する。
6. ブラウザで [http://localhost:3000](http://localhost:3000) を開く。初回は管理者作成画面が出る。
7. 開発サーバーを再開するときは、`devenv up` を再度実行すればよい（または Node 手順の場合は `pnpm run dev`）。

## 2. リポジトリ準備

```sh
git clone https://github.com/emtkmkk/mkkey.git
cd mkkey
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

## 3. 設定ファイル作成

```sh
cp .config/example.yml .config/default.yml
```

`default.yml` の `db` / `redis` / `url` を開発環境に合わせて編集します。

## 4. 初期化と起動

```sh
pnpm run migrate
pnpm run dev
```

通常は `http://localhost:3000` で確認できます。

## 5. よく使うコマンド

- まとめてビルド: `pnpm run build`
- フォーマット: `pnpm run format`
- Lint: `pnpm run lint`
- テスト: `pnpm run test`

## 6. 補足

- 静的アセット更新だけ反映したい場合は `pnpm run gulp` が使えます。
- DB を作り直す場合は、先にバックアップを取ってから作業してください。
- Nix 環境が使えない、または未整備の場合は、上記の Node.js + pnpm 手順（2〜4、`pnpm run migrate` と `pnpm run dev`）を利用してください。
