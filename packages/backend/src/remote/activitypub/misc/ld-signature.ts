/**
 * @packageDocumentation
 *
 * ActivityPub 用の Linked Data 署名（RsaSignature2017）。署名・検証および JSON-LD 正規化を提供する。
 *
 * @remarks
 * - **役割**: AP 配信時の署名付与と inbox 受信時の署名検証に利用する。
 *
 * @see {@link remote/activitypub/request} AP リクエスト
 * @internal
 */
import * as crypto from "node:crypto";
import jsonld from "jsonld";
import { CONTEXTS, WellKnownContext } from "./contexts.js";

// RsaSignature2017 は https://github.com/transmute-industries/RsaSignature2017 をベースにしている

export class LdSignature {
	public debug = false;

	constructor() {}

	public async signRsaSignature2017(
		data: any,
		privateKey: string,
		creator: string,
		domain?: string,
		created?: Date,
	): Promise<any> {
		const options = {
			type: "RsaSignature2017",
			creator,
			domain,
			nonce: crypto.randomBytes(16).toString("hex"),
			created: (created || new Date()).toISOString(),
		} as {
			type: string;
			creator: string;
			domain?: string;
			nonce: string;
			created: string;
		};

		if (!domain) {
			options.domain = undefined;
		}

		const toBeSigned = await this.createVerifyData(data, options);

		const signer = crypto.createSign("sha256");
		signer.update(toBeSigned);
		signer.end();

		const signature = signer.sign(privateKey);

		return {
			...data,
			signature: {
				...options,
				signatureValue: signature.toString("base64"),
			},
		};
	}

	public async verifyRsaSignature2017(
		data: any,
		publicKey: string,
	): Promise<boolean> {
		const toBeSigned = await this.createVerifyData(data, data.signature);
		const verifier = crypto.createVerify("sha256");
		verifier.update(toBeSigned);
		return verifier.verify(publicKey, data.signature.signatureValue, "base64");
	}

	public async createVerifyData(data: any, options: any) {
		const transformedOptions = {
			...options,
			"@context": "https://w3id.org/identity/v1",
		};
		delete transformedOptions["type"];
		delete transformedOptions["id"];
		delete transformedOptions["signatureValue"];
		const canonizedOptions = await this.normalize(transformedOptions);
		const optionsHash = this.sha256(canonizedOptions);
		const transformedData = { ...data };
		delete transformedData["signature"];
		const cannonidedData = await this.normalize(transformedData);
		if (this.debug) console.debug(`cannonidedData: ${cannonidedData}`);
		const documentHash = this.sha256(cannonidedData);
		const verifyData = `${optionsHash}${documentHash}`;
		return verifyData;
	}

	public async normalize(data: any) {
		const customLoader = this.getLoader();
		return await jsonld.normalize(data, {
			documentLoader: customLoader,
		});
	}

	public async compactToWellKnown(data: any): Promise<any> {
		const options = { documentLoader: this.getLoader() };
		const context = WellKnownContext as any;
		delete data["signature"];
		return await jsonld.compact(data, context, options);
	}

	/**
	 * JSON-LD 正規化・compaction 用のドキュメントローダーを返す。
	 *
	 * @remarks
	 * GHSA-38jx-423m-g387 (CVE-2026-47746, TOCTOU) / GHSA-w8x2-gpq6-jxvf 対策:
	 * 以前は未知の `@context` URL を都度リモートからフェッチしていたため、
	 * 攻撃者が「署名検証時」と「実処理（compaction）時」で異なる context 定義を
	 * 返すことで、検証済みの内容と実際に処理される内容を食い違わせられた
	 * （TOCTOU）。また、毎回のリモートフェッチは応答時間の差を生み、
	 * タイミング情報の漏洩や SSRF 的な挙動にも繋がっていた。
	 *
	 * これを防ぐため、ローダーはプリロード済みの既知 context（{@link CONTEXTS}）
	 * のみを返し、未知の context URL はリモート取得せずにエラーとする。
	 * これにより、検証時と処理時で必ず同一の context 解釈が共有される。
	 */
	private getLoader() {
		return async (url: string): Promise<any> => {
			if (!url.match("^https?://")) throw new Error(`Invalid URL ${url}`);

			if (url in CONTEXTS) {
				if (this.debug) console.debug(`HIT: ${url}`);
				return {
					contextUrl: null,
					document: CONTEXTS[url],
					documentUrl: url,
				};
			}

			// 既知 context 以外はリモートから取得しない（TOCTOU・タイミング攻撃対策）。
			if (this.debug) console.debug(`UNKNOWN CONTEXT (rejected): ${url}`);
			throw new Error(`Unknown context URL is not allowed: ${url}`);
		};
	}

	public sha256(data: string): string {
		const hash = crypto.createHash("sha256");
		hash.update(data);
		return hash.digest("hex");
	}
}
