import { i18n } from "@/i18n";

/**
 * URL先の画像が存在するかチェックします
 * @param {*} 画像URL
 */
export async function isImageExists(imgUrl: string): boolean {
	const imgLoad = new Promise(async (resolve, reject) => {
		try {
			//ステータスコードで判定
			const xhr = new Promise((resolve, reject) => {
				new XMLHttpRequest();
				xhr.open("HEAD", imgUrl, false);
				xhr.send(null);
				return resolve(xhr);
			});

			if ((xhr.status = 404)) reject(imgUrl);

			//画像であるかどうかで判定
			if (!xhr.headers["content-type"].startsWith("image/")) reject(imgUrl);

			//画像が取得できるかどうかで判定
			const img = new Image();
			img.src = imgUrl;
			img.onerror = () => reject(imgUrl);

			//画像サイズで判定
			if (img.width === 0 || img.height === 0) {
				reject(imgUrl);
			}

			resolve(imgUrl);
		} catch (err) {
			reject(imgUrl);
		}
	});

	return imgLoad
		.then(() => {
			return true;
		})
		.catch(() => {
			return false;
		});
}
