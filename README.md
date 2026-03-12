# Cluckey (mkkey)

[![liberapay badge](https://img.shields.io/liberapay/receives/emtk?logo=liberapay)](https://liberapay.com/emtk)

## これは何か

# ✨ Cluckeyについて

Cluckey は 分散型のマイクロブログサーバーです。

## 目次

- [動作要件](#動作要件)
- [セットアップ](#セットアップ)
- [初期設定](#初期設定)
- [検索のセットアップ（Sonic）](#検索のセットアップsonic)
- [ビルドと起動](#ビルドと起動)
- [Web プロキシ](#web-プロキシ)
- [移行](#移行)
- [関連ドキュメント](#関連ドキュメント)
- [カスタマイズ](#カスタマイズ)
- [小ネタ](#小ネタ)

## 動作要件

### 必須

- Node.js 18 以上（[nvm](https://github.com/nvm-sh/nvm) での導入を推奨）
- PostgreSQL 12 以上
- Redis 6 以上

### 推奨

- Node.js 19 系
- Redis 7 系
- Nginx などのリバースプロキシ

### 任意

- FFmpeg（動画変換）
- Sonic または Elasticsearch（検索）

### ビルド時に必要

- Rust toolchain
- C/C++ のビルドツール
  - Debian/Ubuntu: `build-essential`
  - Arch Linux: `base-devel`
- Python 3

## セットアップ

```sh
git clone --depth 1 https://github.com/emtkmkk/mkkey.git
cd mkkey
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
```

TensorFlow を使わずに依存を入れたい場合:

```sh
pnpm install --no-optional
```

## 初期設定

1. 設定ファイルを作成します。

```sh
cp .config/example.yml .config/default.yml
```

1. `.config/default.yml` の最低限の項目を編集します。
   - `url`
   - `db.host` / `db.port` / `db.db` / `db.user` / `db.pass`
   - `redis.host` / `redis.port`

1. PostgreSQL にデータベースを作成します。

```sh
psql postgres -c "create database calckey with encoding = 'UTF8';"
```

1. Docker 運用する場合は環境変数ファイルを作成します。

```sh
cp .config/docker_example.env .config/docker.env
```

## 検索のセットアップ（Sonic）

全文検索に Sonic を使う場合は、[Sonic のインストールガイド](https://github.com/valeriansaliou/sonic#installation) に従ってセットアップしてください。IPv4 で待ち受ける場合は、Sonic の `config.cfg` の `inet` を `"0.0.0.0:1491"` に変更します。`.config/default.yml` の `sonic` セクションに設定を反映してください。

## ビルドと起動

### 通常起動

```sh
NODE_ENV=production pnpm run build
pnpm run migrate
NODE_ENV=production pnpm run start
```

今後の更新時は `git pull` してから、以下を実行します。

```sh
git pull
pnpm install
NODE_ENV=production pnpm run build && pnpm run migrate
NODE_ENV=production pnpm run start
```

### pm2 利用例

```sh
npm i -g pm2
pm2 install pm2-logrotate
pm2 start "NODE_ENV=production pnpm run start" --name Cluckey
```

## Web プロキシ

### Nginx（推奨）

```sh
sudo cp ./calckey.nginx.conf /etc/nginx/sites-available/
cd /etc/nginx/sites-available/
# calckey.nginx.conf をインスタンスに合わせて編集
sudo ln -s ./calckey.nginx.conf ../sites-enabled/calckey.nginx.conf
sudo nginx -t
# 問題なければ Nginx を再起動
```

### Apache

```sh
sudo cp ./calckey.apache.conf /etc/apache2/sites-available/
cd /etc/apache2/sites-available/
# calckey.apache.conf をインスタンスに合わせて編集
sudo a2ensite calckey.apache
sudo service apache2 restart
```

### Caddy

`Caddyfile` に以下を追加し、`example.tld` を自分のドメインに置き換えてから、Caddy を再読み込みしてください。

```caddy
example.tld {
    reverse_proxy http://127.0.0.1:3000
}
```

## 関連ドキュメント

- Docker 運用: [`docs/docker.md`](./docs/docker.md)
- Kubernetes/Helm 運用: [`docs/kubernetes.md`](./docs/kubernetes.md)
- 開発環境: [`docs/development.md`](./docs/development.md)
- 移行手順: [`docs/migrate.md`](./docs/migrate.md)
- コントリビュート: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- セキュリティ報告: [`SECURITY.md`](./SECURITY.md)
- 行動規範: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

## カスタマイズ

- 全体 CSS: `custom/assets/instance.css`
- 静的ファイル: `custom/assets/`
- カスタムロケール: `custom/locales/`（ファイル名の先頭はベースにするロケール名に合わせてください。例: `en-FOO.yml`）
- カスタムエラー画像: `custom/assets/badges`（既存ファイルを置換）
- カスタムサウンド: `custom/assets/sounds`（mp3）

アセットだけ差し替えて再ビルドを避けたい場合:

```sh
pnpm run gulp
```

## 小ネタ

- 設定ファイル末尾の項目はマネージドホスティング向けのため、セルフホストでは未入力でよいです。これらはコントロールパネルで設定するのが適切です。
- デフォルトの 3000 番ポートが他の用途で使われている場合、空きポートを探す例: `for p in {3000..4000}; do ss -tlnH | tr -s ' ' | cut -d" " -sf4 | grep -q "${p}$" || echo "${p}"; done | head -n 1`（必要に応じて範囲を調整）
- `calckey.nginx.conf` / `calckey.apache.conf` はファイル名互換のためそのまま残しています。DB 名などで `calckey` という文字列が残る箇所もありますが、既存互換を優先しています。
- 特に Docker 利用時は、オブジェクトストレージに S3 バケットや CDN を使うことを推奨します。
- Cloudflare の利用は非推奨です。使う場合はコード最小化を無効にしてください。
- Push 通知を使う場合は `npx web-push generate-vapid-keys` を実行し、公開鍵・秘密鍵を「コントロールパネル > 全般 > ServiceWorker」に設定します。
- 翻訳機能を使う場合は [DeepL](https://www.deepl.com/) の API キーを取得し、「コントロールパネル > 全般 > DeepL 翻訳」に設定します。
- **管理者アカウントの追加**: ユーザーページで 3 点メニュー > About > Moderation の「Moderator」を有効化 → Overview に戻り、ID 横のクリップボードアイコンで ID をコピー → `psql -d calckey`（DB 名が異なる場合は置き換え）で `UPDATE "user" SET "isAdmin" = true WHERE id='ここにコピーしたID';` を実行 → 対象ユーザーは一度ログアウトしてから再ログイン
