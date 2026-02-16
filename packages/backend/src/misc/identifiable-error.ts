/**
 * ID付きエラー
 */
export class IdentifiableError extends Error {
	public message: string;
	public id: string;
	public isRetryable: boolean;

	constructor(id: string, message?: string, isRetryable = true) {
		super(message);
		this.message = message || "";
		this.id = id;
		this.isRetryable = isRetryable;
	}
}
