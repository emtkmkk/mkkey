# Helm Chart（Cluckey）

このディレクトリは Cluckey 配備用の Helm Chart です。

## 注意

- 既存互換のため、Values のキー名に `calckey.*` が残っています。
- 今回のドキュメント更新では、キー名は変更していません。

## 使い方（最小）

```sh
cp .config/helm_values_example.yml .config/helm_values.yml
helm dependency update chart/
helm upgrade --install cluckey chart/ -f .config/helm_values.yml --namespace cluckey --create-namespace
```

## 主な Values

現在の `chart/values.yaml` および `.config/helm_values_example.yml` に合わせた説明です。キー名は変更していません。

| キー | 説明 |
| --- | --- |
| `replicaCount` | アプリのレプリカ数 |
| `image.repository` / `image.tag` | 利用する Docker イメージ |
| `calckey.domain` | インスタンスのドメイン |
| `calckey.isManagedHosting` | マネージドホスティング用設定の有効化 |
| `calckey.smtp.*` | メール送信（from_address, server, port, login, password 等） |
| `calckey.objectStorage.*` | オブジェクトストレージ（S3 互換: endpoint, bucket, access_key 等） |
| `calckey.allowedPrivateNetworks` | 接続を許可するプライベートネットワーク（CIDR のリスト） |
| `calckey.reservedUsernames` | 予約ユーザー名 |
| `postgresql.enabled` / `postgresql.auth.*` | PostgreSQL の有無と認証（database, username, password） |
| `redis.enabled` / `redis.hostname` / `redis.auth.*` | Redis の有無と接続先・認証 |
| `elasticsearch.enabled` | 全文検索に Elasticsearch を使うか |
| `ingress.enabled` / `ingress.hosts` / `ingress.tls` | Ingress の有効化とホスト・TLS |
| `service.type` / `service.port` | Service の種類とポート |
| `autoscaling.enabled` | 水平 Pod オートスケールの有無 |

詳細は `chart/values.yaml` と `.config/helm_values_example.yml` を参照してください。
