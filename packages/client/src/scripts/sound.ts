import { ColdDeviceStorage } from "@/store";

const ctx = new AudioContext();
const cache = new Map<string, AudioBuffer>();
let canPlay = true;

export async function loadAudio(file: string, useCache = true) {
	if (useCache && cache.has(file)) {
		return cache.get(file);
	}

	const response = await fetch(`/client-assets/sounds/${file}.mp3`);
	const arrayBuffer = await response.arrayBuffer();
	const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

	if (useCache) {
		cache.set(file, audioBuffer);
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
	(async () => {
		canPlay = false;
		try {
			await playFile(sound.type, sound.volume);
		} finally {
			// ごく短時間に音が重複しないように
			setTimeout(() => {
				canPlay = true;
			}, 25);
		}
	})();
}

export async function playFile(file: string, volume: number) {
	if (!file.toLowerCase().includes("none")){
		const buffer = await loadAudio(file);
		createSourceNode(buffer, volume)?.start();
	}
}

export function createSourceNode(buffer: AudioBuffer | undefined, volume: number) {
	const masterVolume = ColdDeviceStorage.get("sound_masterVolume");
	if (!buffer || masterVolume === 0 || volume === 0)
		return null;

	const gainNode = ctx.createGain();
	gainNode.gain.value = masterVolume * volume;

	const soundSource = ctx.createBufferSource();
	soundSource.buffer = buffer;
	soundSource.connect(gainNode).connect(ctx.destination);

	return soundSource;
}
