# 運営ガイド

## ジョブキューの状態を調べる
coming soon

## 管理者ユーザーを設定する
``` shell
node cli/mark-admin (ユーザーID または ユーザー名)
```

## 'verified'ユーザーを設定する
``` shell
node cli/mark-verified (ユーザーID または ユーザー名)
```

## ユーザーを凍結する
``` shell
node cli/suspend (ユーザーID または ユーザー名)
```
例:
``` shell
# ユーザーID
node cli/suspend 57d01a501fdf2d07be417afe

# ユーザー名
node cli/suspend @syuilo

# ユーザー名 (リモート)
node cli/suspend @syuilo@misskey.xyz
```

## ユーザーのパスワードをリセットする
``` shell
node cli/reset-password (ユーザーID または ユーザー名)
```
