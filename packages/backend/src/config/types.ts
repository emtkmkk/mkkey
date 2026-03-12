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
