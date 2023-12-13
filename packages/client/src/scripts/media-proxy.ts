import { query } from "@/scripts/url";
import { url } from "@/config";

export function getProxiedImageUrl(imageUrl: string, type?: "preview"): string {

	if (imageUrl.startsWith('/proxy/')) {
		// もう既にproxyっぽそうだったらurlを取り出す
		imageUrl = (new URL(imageUrl)).searchParams.get('url') ?? imageUrl;
	}

	return `${url}/proxy/${
		type === 'preview' ? 'preview.webp'
		: 'image.webp'
	}?${query({
		url: imageUrl,
		fallback: "1",
		...(type ? { [type]: "1" } : {}),
	})}`;
}

export function getProxiedImageUrlNullable(
	imageUrl: string | null | undefined,
	type?: "preview",
): string | null {
	if (imageUrl == null) return null;
	return getProxiedImageUrl(imageUrl, type);
}
