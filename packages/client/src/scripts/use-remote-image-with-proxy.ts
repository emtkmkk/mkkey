import { ref, watch } from "vue";
import { getProxiedImageUrl } from "@/scripts/media-proxy";

export function useRemoteImageWithProxy(
        sourceGetter: () => string | null | undefined,
        shouldTryProxy: () => boolean,
) {
        const resolvedUrl = ref<string | null>(null);
        let triedProxy = false;

        const load = (url: string | null | undefined, allowProxyRetry: boolean) => {
                if (!url) {
                        resolvedUrl.value = null;
                        return;
                }

                resolvedUrl.value = url;

                if (typeof window === "undefined" || !shouldTryProxy()) {
                        return;
                }

                const img = new Image();

                img.onload = () => {
                        if (resolvedUrl.value !== url) {
                                resolvedUrl.value = url;
                        }
                };

                img.onerror = () => {
                        if (!allowProxyRetry || triedProxy) return;

                        triedProxy = true;

                        const proxiedUrl = getProxiedImageUrl(url);
                        if (proxiedUrl === url) {
                                return;
                        }

                        load(proxiedUrl, false);
                };

                img.src = url;
        };

        watch(
                sourceGetter,
                (newUrl) => {
                        triedProxy = false;
                        load(newUrl, true);
                },
                { immediate: true },
        );

        return resolvedUrl;
}
