import { ColdDeviceStorage } from "@/store";
import { defaultStore } from "@/store.js";

let ctx: AudioContext;
const cache = new Map<string, AudioBuffer>();
let canPlay = true;

export async function loadAudio(sound, useCache = true) {
	if (sound.type === null || (sound.type === '_driveFile_' && !sound.fileUrl)) {
		return;
	}
	if (ctx == null) {
		ctx = new AudioContext();
	}
	if (useCache) {
		if (sound.type === '_driveFile_' && cache.has(sound.fileId)) {
			return cache.get(sound.fileId) as AudioBuffer;
		} else if (cache.has(sound.type)) {
			return cache.get(sound.type) as AudioBuffer;
		}
	}

	let response: Response;

	if (sound.type === '_driveFile_') {
		try {
			response = await fetch(sound.fileUrl);
		} catch (err) {
			try {
				// URLが変わっている可能性があるのでドライブ側からURLを取得するフォールバック
				const apiRes = await os.api('drive/files/show', {
					fileId: sound.fileId,
				});
				response = await fetch(apiRes.url);
			} catch (fbErr) {
				// それでも無理なら諦める
				return;
			}
		}
	} else {
		try {
			response = await fetch(`/client-assets/sounds/${sound.type}.mp3`);
		} catch (err) {
			return;
		}
	}

	const arrayBuffer = await response.arrayBuffer();
	const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

	if (useCache) {
		if (sound.type === '_driveFile_') {
			cache.set(sound.fileId, audioBuffer);
		} else {
			cache.set(sound.type, audioBuffer);
		}
	}

	return audioBuffer;
}

export function setVolume(
	audio: HTMLAudioElement,
	volume: number,
): HTMLAudioElement {
	const masterVolume = ColdDeviceStorage.get("sound_masterVolume");
	audio.volume = masterVolume - (1 - volume) * masterVolume;
	return audio;
}

export function play(type: string) {
	const sound = ColdDeviceStorage.get(`sound_${type}` as any);
	if (sound.type == null || !canPlay) return;
	canPlay = false;
	playFile(sound).then(() => {
		// ごく短時間に音が重複しないように
		setTimeout(() => {
			canPlay = true;
		}, 25);
	});
}

export async function playFile(sound) {
	const buffer = await loadAudio(sound);
	if (!buffer) return;
	createSourceNode(buffer, sound.volume)?.start();
}

export function createSourceNode(
	buffer: AudioBuffer | undefined,
	volume: number,
) {
	const masterVolume = ColdDeviceStorage.get("sound_masterVolume");
	if (!buffer || isMute() || masterVolume === 0 || volume === 0) return null;

	const gainNode = ctx.createGain();
	gainNode.gain.value = masterVolume * volume;

	const soundSource = ctx.createBufferSource();
	soundSource.buffer = buffer;
	soundSource.connect(gainNode).connect(ctx.destination);

	return soundSource;
}
export async function getSoundDuration(file: string): Promise<number> {
	const audioEl = document.createElement('audio');
	audioEl.src = file;
	return new Promise((resolve) => {
		const si = setInterval(() => {
			if (audioEl.readyState > 0) {
				resolve(audioEl.duration * 1000);
				clearInterval(si);
				audioEl.remove();
			}
		}, 100);
	});
}

export function isMute(): boolean {
	if (defaultStore.state.notUseSound) {
		// サウンドを出力しない
		return true;
	}

	// noinspection RedundantIfStatementJS
	if (
		defaultStore.state.useSoundOnlyWhenActive &&
		document.visibilityState === "hidden"
	) {
		// ブラウザがアクティブな時のみサウンドを出力する
		return true;
	}

	return false;
}
