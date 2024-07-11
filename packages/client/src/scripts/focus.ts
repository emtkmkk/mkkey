export function focusPrev(el: Element | null, self = false, scroll = true) {
	if (el == null) return;
	let target = self ? el : el.previousElementSibling;

	while (target) {
		if (target.hasAttribute("tabindex")) {
			(target as HTMLElement).focus({
				preventScroll: !scroll,
			});
			return;
		}
		target = target.previousElementSibling;
	}
}

export function focusNext(el: Element | null, self = false, scroll = true) {
	if (el == null) return;
	let target = self ? el : el.nextElementSibling;

	while (target) {
		if (target.hasAttribute("tabindex")) {
			(target as HTMLElement).focus({
				preventScroll: !scroll,
			});
			return;
		}
		target = target.nextElementSibling;
	}
}
