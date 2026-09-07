/**
 * @packageDocumentation
 *
 * 分割アップロードのサイズ境界に関する単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	CHUNKED_UPLOAD_PART_FILE_SIZE_LIMIT,
	CHUNKED_UPLOAD_PART_SIZE,
} from "../../src/services/drive/chunked-upload-constants.js";

describe("分割アップロードのサイズ境界", () => {
	it("境界値：64 MiB のパートが Multer の上限未満になる", () => {
		assert.ok(CHUNKED_UPLOAD_PART_SIZE < CHUNKED_UPLOAD_PART_FILE_SIZE_LIMIT);
	});

	it("異常系：64 MiB を 1 byte 超えたパートが Multer の上限値になる", () => {
		assert.strictEqual(
			CHUNKED_UPLOAD_PART_FILE_SIZE_LIMIT,
			CHUNKED_UPLOAD_PART_SIZE + 1,
		);
	});
});
