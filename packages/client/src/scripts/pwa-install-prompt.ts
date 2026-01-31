const PWA_INSTALL_PROMPT_SUPPRESSED_KEY = "pwaInstallPromptSuppressed";
const PWA_BROWSER_VISIT_COUNT_KEY = "pwaBrowserVisitCount";
const PWA_BROWSER_VISIT_LIMIT = 10;

const getIsStandalonePwa = () => {
	if (typeof window === "undefined") return false;
	const displayModeStandalone =
		window.matchMedia?.("(display-mode: standalone)").matches ?? false;
	const navigatorStandalone =
		"standalone" in navigator
			? (navigator as Navigator & { standalone?: boolean }).standalone === true
			: false;
	return displayModeStandalone || navigatorStandalone;
};

const getVisitCount = () => {
	const rawCount = localStorage.getItem(PWA_BROWSER_VISIT_COUNT_KEY);
	const count = rawCount ? Number.parseInt(rawCount, 10) : 0;
	return Number.isNaN(count) ? 0 : count;
};

export const getPwaInstallPromptVisibility = () => {
	if (typeof window === "undefined") return false;
	if (getIsStandalonePwa()) return false;
	const suppressed =
		localStorage.getItem(PWA_INSTALL_PROMPT_SUPPRESSED_KEY) === "1";
	if (suppressed) return false;
	const nextCount = getVisitCount() + 1;
	localStorage.setItem(PWA_BROWSER_VISIT_COUNT_KEY, String(nextCount));
	if (nextCount >= PWA_BROWSER_VISIT_LIMIT) {
		localStorage.setItem(PWA_INSTALL_PROMPT_SUPPRESSED_KEY, "1");
		return false;
	}
	return true;
};

export const resetPwaInstallPromptSuppression = () => {
	if (typeof window === "undefined") return;
	localStorage.removeItem(PWA_INSTALL_PROMPT_SUPPRESSED_KEY);
	localStorage.removeItem(PWA_BROWSER_VISIT_COUNT_KEY);
};
