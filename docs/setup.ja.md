Misskey構築の手引き
================================================================

Misskeyサーバーの構築にご関心をお寄せいただきありがとうございます！
このガイドではMisskeyのインストール・セットアップ方法について解説します。

[英語版もあります - English version also available](./setup.en.md)

----------------------------------------------------------------

*1.* reCAPTCHAトークンの用意
----------------------------------------------------------------
MisskeyはreCAPTCHAトークンを必要とします。
https://www.google.com/recaptcha/intro/ にアクセスしてトークンを生成してください。

*(オプション)* VAPIDキーペアの生成
----------------------------------------------------------------
ServiceWorkerを有効にする場合、VAPIDキーペアを生成する必要があります:

``` shell
npm install web-push -g
web-push generate-vapid-keys
```

*2.* 依存関係をインストールする
----------------------------------------------------------------
これらのソフトウェアをインストール・設定してください:

#### 依存関係 :package:
* *Node.js* と *npm*
* **[MongoDB](https://www.mongodb.com/)**
* **[Redis](https://redis.io/)**
* **[ImageMagick](http://www.imagemagick.org/script/index.php)**

##### オプション
* [Elasticsearch](https://www.elastic.co/) - 検索機能を向上させるために用います。

*3.* Misskeyのインストール
----------------------------------------------------------------
1. `git clone -b master git://github.com/syuilo/misskey.git`
2. `cd misskey`
3. `npm install`

*4.* 設定ファイルを用意する
----------------------------------------------------------------
`npm run config`コマンドを利用して、ガイドに従って情報を入力してください。

*5.* Misskeyのビルド
----------------------------------------------------------------
1. `npm install -g node-gyp`
2. `node-gyp configure`
3. `node-gyp build`
4. `npm run build`

*6.* 以上です！
----------------------------------------------------------------
お疲れ様でした。これでMisskeyを動かす準備は整いました。

### 起動
`sudo npm start`するだけです。GLHF!

### Misskeyを最新バージョンにアップデートする方法:
1. `git reset --hard && git pull origin master`
2. `npm install`
3. `npm run build`

## メモリが足りなくてビルドできない場合
Misskeyの(クライアントの)ビルドには、目安として8GBくらいのメモリを必要とします。
VPSなどでビルドする時は、もしかしたらメモリが足りなくなる可能性があります。
そうなった場合、もしVPSではなくあなたのPCが十分なメモリを搭載しているなら、あなたのPC上でビルドし、生成されたファイルをVPSにFTPでアップロードする方法を採ることができます。

1. あなたのPC上にMisskeyをインストールする
2. 設定ファイルを用意する。設定ファイルは、サーバーに合わせた設定にします。
3. npm run webpack
4. built/client をサーバーにアップロードする
5. サーバー上で、npm run gulp
6. 完了
