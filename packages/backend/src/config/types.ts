/**
 * ユーザーが設定する必要のある情報
 */
export type Source = {
	repository_url?: string;
	feedback_url?: string;
	url: string;
	port: number;
	portproxy: number;
	disableHsts?: boolean;
	db: {
		host: string;
		port: number;
		db: string;
		user: string;
		pass: string;
		disableCache?: boolean;
		extra?: { [x: string]: string };
		/** 集計系API専用ロールのユーザ名。指定時は専用接続プールを使用し、通常APIへの影響を軽減する。 */
		statsUser?: string;
		/** 集計系API専用ロールのパスワード（statsUser 指定時必須）。 */
		statsPass?: string;
		/** 集計用接続プールの最大接続数（デフォルト: 5）。 */
		statsPoolSize?: number;
		/** 集計用接続の statement_timeout（ミリ秒）。未指定時は 120000（2分）。 */
		statsStatementTimeoutMs?: number;
		/** 集計用接続の work_mem（例: '1MB'）。未指定時はサーバー既定値。 */
		statsWorkMem?: string;
		/** 集計用接続の temp_file_limit（例: '100MB'）。未指定時はサーバー既定値。 */
		statsTempFileLimit?: string;
		/** 集計用接続の max_parallel_workers_per_gather（0 で並列無効）。未指定時はサーバー既定値。 */
		statsMaxParallelWorkersPerGather?: number;
	};
	redis: {
		host: string;
		port: number;
		family?: number;
		pass: string;
		db?: number;
		prefix?: string;
	};
	elasticsearch: {
		host: string;
		port: number;
		ssl?: boolean;
		user?: string;
		pass?: string;
		index?: string;
	};
	sonic: {
		host: string;
		port: number;
		auth?: string;
		collection?: string;
		bucket?: string;
	};

	proxy?: string;
	proxySmtp?: string;
	proxyBypassHosts?: string[];

	/**
	 * リバースプロキシが付与する `X-Forwarded-For` / `X-Forwarded-Proto` 等を信頼するか。
	 *
	 * @remarks
	 * GHSA-wwrj-3hvj-prpm 関連:
	 * `true` のとき Koa は `X-Forwarded-For` の値を信頼してクライアント IP を決定する。
	 * 信頼できないリバースプロキシ配下、またはプロキシを介さず直接公開している場合に
	 * `true` のままだと、攻撃者が `X-Forwarded-For` を偽装してログイン等のレート制限を
	 * 回避できる（毎回別 IP に見せかけられる）。
	 * - リバースプロキシ（nginx 等）配下で、プロキシ側が `X-Forwarded-For` を
	 *   上書き設定している場合は `true`（既定）のままで問題ない。
	 * - プロキシを介さず直接インターネットに公開する場合は `false` を推奨。
	 *
	 * 未指定時は後方互換のため `true`。
	 */
	trustProxy?: boolean;

	allowedPrivateNetworks?: string[];

	maxFileSize?: number;

	accesslog?: string;

	clusterLimit?: number;

	clusterLimits?: {
		web?: number;
		queue?: number;
		proxy?: number;
	};

	id: string;

	outgoingAddressFamily?: "ipv4" | "ipv6" | "dual";

	deliverJobConcurrency?: number;
	inboxJobConcurrency?: number;
	deliverJobPerSec?: number;
	inboxJobPerSec?: number;
	deliverJobMaxAttempts?: number;
	inboxJobMaxAttempts?: number;
	/** deliver / noteApDeliver の 1 回あたりジョブ実行上限（ミリ秒）。未指定時は 60000（1分）。 */
	deliverJobTimeoutMs?: number;
	/** inbox の 1 回あたりジョブ実行上限（ミリ秒）。未指定時は 300000（5分）。 */
	inboxJobTimeoutMs?: number;
	/** apBackoff の初期待ち時間（ミリ秒）。未指定時は 60000（1分）。 */
	apBackoffBaseDelayMs?: number;
	/** apBackoff の最大待ち時間（ミリ秒）。未指定時は 28800000（8時間）。 */
	apBackoffMaxDelayMs?: number;
	queueAdaptiveThrottle?: {
		enabled?: boolean;
		latencyThresholdMs?: number;
		baseDelayMs?: number;
		maxDelayMs?: number;
		dbSlowQueryThresholdMs?: number;
		dbPollIntervalMs?: number;
	};

	syslog: {
		host: string;
		port: number;
	};

	mediaProxy?: string;
	proxyRemoteFiles?: boolean;

	twa: {
		nameSpace?: string;
		packageName?: string;
		sha256CertFingerprints?: string[];
	};

	reservedUsernames?: string[];

	// Managed hosting stuff
	maxUserSignups?: number;
	isManagedHosting?: boolean;
	maxNoteLength?: number;
	maxCaptionLength?: number;
	deepl: {
		managed?: boolean;
		authKey?: string;
		isPro?: boolean;
	};
	libreTranslate: {
		managed?: boolean;
		apiUrl?: string;
		apiKey?: string;
	};
	email: {
		managed?: boolean;
		address?: string;
		host?: string;
		port?: number;
		user?: string;
		pass?: string;
		useImplicitSslTls?: boolean;
	};
	objectStorage: {
		managed?: boolean;
		baseUrl?: string;
		bucket?: string;
		prefix?: string;
		endpoint?: string;
		region?: string;
		accessKey?: string;
		secretKey?: string;
		useSsl?: boolean;
		connnectOverProxy?: boolean;
		setPublicReadOnUpload?: boolean;
		s3ForcePathStyle?: boolean;
	};
	summalyProxyUrl?: string;
	/**
	 * `/url` 外向き削減（サーバ側キャッシュ・セマフォ等）。未指定時は url-preview-outbound 内の既定値を使う。
	 *
	 * @remarks
	 * - `maxConcurrentPerHost` / `maxGlobalConcurrent` に **0 以下**を指定すると、その軸の制限を無効化する。
	 */
	urlPreview?: {
		/** false のとき成功・ネガティブ・短縮 URL キャッシュを使わない（既定: true 相当）。 */
		cacheEnabled?: boolean;
		/** Redis 成功キャッシュ TTL（秒）。 */
		redisOkTtlSec?: number;
		/** プロセス内成功キャッシュ TTL（ミリ秒）。 */
		memoryOkTtlMs?: number;
		/** 429 等で Retry-After が無いときのネガティブ TTL（秒）。 */
		negativeDefaultSec?: number;
		/** ネガティブ TTL の下限（秒）。 */
		negativeMinSec?: number;
		/** ネガティブ TTL の上限（秒）。Retry-After の異常値対策。 */
		negativeMaxSec?: number;
		/** 5xx で Retry-After が無いときのネガティブ TTL（秒）。 */
		negative5xxSec?: number;
		/** 同一ホストへの同時プレビュー取得上限（0 以下で無制限）。 */
		maxConcurrentPerHost?: number;
		/** インスタンス全体の同時プレビュー取得上限（0 以下で無制限）。 */
		maxGlobalConcurrent?: number;
		/** 短縮 URL 解決結果のキャッシュ TTL（秒）。 */
		shortUrlResolveTtlSec?: number;
		/**
		 * ワーカー横断インフライト結合（Redis lock/result/notify）。
		 *
		 * @remarks
		 * - `enabled` が false のときは従来どおりプロセス内インフライトのみ使用する。
		 * - 既定値は `url-preview-outbound.ts` 側で補完する。
		 */
		inflightDistributed?: {
			/** true のとき分散インフライトを有効化する。 */
			enabled?: boolean;
			/** lock の TTL（秒）。 */
			lockTtlSec?: number;
			/** 共有 result の TTL（秒）。 */
			resultTtlSec?: number;
			/** follower の待機上限（ミリ秒）。 */
			waitTimeoutMs?: number;
			/** Pub/Sub 通知の待機時間（ミリ秒）。 */
			pubsubTimeoutMs?: number;
			/** ポーリング間隔（ミリ秒）。 */
			pollIntervalMs?: number;
			/** ポーリング間隔のジッター率（0.2 = ±20%）。 */
			pollJitterRatio?: number;
			/** lock 延長の実行間隔（ミリ秒）。 */
			lockExtendIntervalMs?: number;
			/** lock 延長回数の上限。 */
			maxLockExtendCount?: number;
		};
	};
	/**
	 * 汎用 `Cache` のワーカー横断インフライト設定。
	 *
	 * @remarks
	 * - false 指定時以外は有効（既定: true）。
	 * - Redis エラー時は `Cache` 側でフェイルオープンする。
	 */
	cache?: {
		distributedInflight?: {
			enabled?: boolean;
			lockTtlSec?: number;
			resultTtlSec?: number;
			waitTimeoutMs?: number;
			pubsubTimeoutMs?: number;
			pollIntervalMs?: number;
			pollJitterRatio?: number;
			lockExtendIntervalMs?: number;
			maxLockExtendCount?: number;
		};
		/**
		 * 汎用 `Cache` のインメモリ上限・定期 sweep 設定。
		 *
		 * @remarks
		 * - `defaultMaxEntries`: `maxEntries` 未指定の `Cache` インスタンスに適用する既定件数上限。
		 * - `sweepIntervalMs`: 失効エントリを一括削除する間隔。`0` 以下で無効。
		 */
		memory?: {
			defaultMaxEntries?: number;
			sweepIntervalMs?: number;
		};
	};
	userAgent2?: string;
	specialServerHosts?: string[];
};

/**
 * Misskeyが自動的に(ユーザーが設定した情報から推論して)設定する情報
 */
export type Mixin = {
	version: string;
	/** 対応言語コードの一覧（boot.js の言語検出で使用） */
	langs: string[];
	host: string;
	hostname: string;
	scheme: string;
	wsScheme: string;
	apiUrl: string;
	wsUrl: string;
	authUrl: string;
	driveUrl: string;
	userAgent: string;
	clientEntry: string;
};

export type Config = Source & Mixin;
