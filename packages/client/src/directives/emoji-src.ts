import { Directive } from "vue";

let isEmojiLoading = false;

const emojiSrc: Directive = {
  mounted(el: HTMLImageElement, binding) {
    // isEmojiLoading が false になるまでポーリング
    const waitForEmojiLoad = (): Promise<void> => {
      let delayLogged = false;
      return new Promise<void>((resolve) => {
        const check = () => {
          if (!isEmojiLoading) {
            resolve();
          } else {
            if (!delayLogged) {
                console.log("v-emoji-src: isEmojiLoading (mounted)");
							el.src = 'https://mkkey.net/static-assets/loading.png';
              delayLogged = true;
            }
            setTimeout(check, 50);
          }
        };
        check();
      });
    };


    // 読み込み開始時に5秒後に強制リセットするタイマーを設定
    const setLoadingTimeout = () => {
      (el as any).__emojiSrcTimeout__ = setTimeout(() => {
        if (isEmojiLoading) {
          isEmojiLoading = false;
          console.warn("v-emoji-src: Loading timeout exceeded 5 seconds. Forcing reset.");
        }
      }, 5000);
    };

    if (
      binding.value &&
      typeof binding.value === "string" &&
      (binding.value.includes("/emoji/") || binding.value.includes("/proxy/"))
    ) {
      waitForEmojiLoad().then(() => {
        // 読み込み開始前にフラグをオンし、タイマーを設定
        isEmojiLoading = true;
        setLoadingTimeout();
        el.src = binding.value;
      });
      // load イベントでタイマーをクリアし、フラグをオフにする
      el.addEventListener("load", () => {
        isEmojiLoading = false;
        if ((el as any).__emojiSrcTimeout__) {
          clearTimeout((el as any).__emojiSrcTimeout__);
          delete (el as any).__emojiSrcTimeout__;
        }
      });
      // error イベントでも同様にタイマーをクリアする
      el.addEventListener("error", () => {
        isEmojiLoading = false;
        if ((el as any).__emojiSrcTimeout__) {
          clearTimeout((el as any).__emojiSrcTimeout__);
          delete (el as any).__emojiSrcTimeout__;
        }
      });
    } else {
      el.src = binding.value;
    }
  },

  updated(el: HTMLImageElement, binding) {
    if (
      binding.value &&
      typeof binding.value === "string" &&
      (binding.value.includes("/emoji/") || binding.value.includes("/proxy/")) &&
      el.src !== binding.value
    ) {
      const waitForEmojiLoad = (): Promise<void> => {
        let delayLogged = false;
        return new Promise<void>((resolve) => {
          const check = () => {
            if (!isEmojiLoading) {
              resolve();
            } else {
              if (!delayLogged) {
                console.log("v-emoji-src: isEmojiLoading (updated)");
								el.src = 'https://mkkey.net/static-assets/loading.png';
                delayLogged = true;
              }
              setTimeout(check, 50);
            }
          };
          check();
        });
      };

      const setLoadingTimeout = () => {
        (el as any).__emojiSrcTimeout__ = setTimeout(() => {
          if (isEmojiLoading) {
            isEmojiLoading = false;
            console.warn("v-emoji-src: Loading timeout exceeded 5 seconds (updated). Forcing reset.");
          }
        }, 5000);
      };

      waitForEmojiLoad().then(() => {
        isEmojiLoading = true;
        setLoadingTimeout();
        el.src = binding.value;
      });
    } else {
      el.src = binding.value;
    }
  },
};

export default emojiSrc;
