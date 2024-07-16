import { Directive } from "vue";
import { throttle } from "throttle-debounce";

type Value = { max?: number[]; min?: number[] };

const mountings = new Map<
	Element,
	{
		value: Value;
		resize: ResizeObserver;
		intersection?: IntersectionObserver;
		previousWidth: number;
	}
>();

type ClassOrder = {
	add: string[];
	remove: string[];
};

const cache = new Map<string, ClassOrder>();

function getClassOrder(width: number, queue: Value): ClassOrder {
	const getMaxClass = (v: number) => `max-width_${v}px`;
	const getMinClass = (v: number) => `min-width_${v}px`;

	return {
		add: [
			...(queue.max ? queue.max.filter((v) => width <= v).map(getMaxClass) : []),
			...(queue.min ? queue.min.filter((v) => width >= v).map(getMinClass) : []),
		],
		remove: [
			...(queue.max ? queue.max.filter((v) => width > v).map(getMaxClass) : []),
			...(queue.min ? queue.min.filter((v) => width < v).map(getMinClass) : []),
		],
	};
}

function applyClassOrder(el: Element, order: ClassOrder) {
	const currentClasses = new Set(el.classList);
	const classesToAdd = order.add.filter((cls) => !currentClasses.has(cls));
	const classesToRemove = order.remove.filter((cls) => currentClasses.has(cls));
	
	if (classesToAdd.length > 0) {
		el.classList.add(...classesToAdd);
	}
	if (classesToRemove.length > 0) {
		el.classList.remove(...classesToRemove);
	}
}

function getOrderName(width: number, queue: Value): string {
	return `${width}|${queue.max ? queue.max.join(",") : ""}|${
		queue.min ? queue.min.join(",") : ""
	}`;
}

const throttledCalc = throttle(500, (el: Element) => {
	const info = mountings.get(el);
	const width = el.clientWidth;

	if (!info || info.previousWidth === width) return;

	// アクティベート前などでsrcが描画されていない場合
	if (!width) {
		// IntersectionObserverで表示検出する
		if (!info.intersection) {
			info.intersection = new IntersectionObserver((entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					throttledCalc(el);
					info.intersection.disconnect();
					info.intersection = undefined;
				}
			});
			info.intersection.observe(el);
		}
		return;
	}

	mountings.set(el, Object.assign(info, { previousWidth: width }));

	const cached = cache.get(getOrderName(width, info.value));
	if (cached) {
		applyClassOrder(el, cached);
	} else {
		const order = getClassOrder(width, info.value);
		cache.set(getOrderName(width, info.value), order);
		applyClassOrder(el, order);
	}
});

export default {
	mounted(src, binding, vn) {
		const resize = new ResizeObserver(() => {
			throttledCalc(src);
		});

		mountings.set(src, {
			value: binding.value,
			resize,
			previousWidth: 0,
		});

		throttledCalc(src);
		resize.observe(src);
	},

	updated(src, binding, vn) {
		const info = mountings.get(src);
		if (info) {
			info.value = binding.value;
			throttledCalc(src);
		}
	},

	unmounted(src, binding, vn) {
		const info = mountings.get(src);
		if (!info) return;
		info.resize.disconnect();
		if (info.intersection) info.intersection.disconnect();
		mountings.delete(src);
	},
} as Directive<Element, Value>;
