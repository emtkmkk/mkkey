import { defaultStore } from "@/store";

function isEnableDataSaver(type: string): boolean {
	return ["cellular", "unknown"].includes(type);
}

export function isSupportNavigatorConnection(): boolean {
	const connection = (navigator as any).connection;
	return connection && typeof connection.type === 'string' && 'onchange' in connection;
}

export function isMobileData(): boolean {
	const connection = (navigator as any).connection;
	if (!isSupportNavigatorConnection()) return false;
	return isEnableDataSaver(connection.type);
}

export function initializeDetectNetworkChange(): void {
	if (!isSupportNavigatorConnection()) return;

	const connection = (navigator as any).connection;

	const handleChange = () => {
		if (!connection || typeof connection.type !== 'string') return;
		const isDataSaverEnabled = isEnableDataSaver(connection.type);
		defaultStore.set("enableDataSaverMode", isDataSaverEnabled);
	};

	connection.addEventListener("change", handleChange);

	// 初期状態の確認
	handleChange();
}
