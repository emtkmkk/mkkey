<script lang="ts">
import { defineComponent, h, PropType, TransitionGroup } from "vue";
import MkAd from "@/components/global/MkAd.vue";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";

export default defineComponent({
	props: {
		items: {
			type: Array as PropType<
				{ id: string; createdAt: string; _shouldInsertAd_: boolean }[]
			>,
			required: true,
		},
		direction: {
			type: String,
			required: false,
			default: "down",
		},
		reversed: {
			type: Boolean,
			required: false,
			default: false,
		},
		noGap: {
			type: Boolean,
			required: false,
			default: false,
		},
		ad: {
			type: Boolean,
			required: false,
			default: false,
		},
	},

	setup(props, { slots, expose }) {
		function getDateText(time: string) {
			const date = new Date(time).getDate();
			const month = new Date(time).getMonth() + 1;
			return i18n.t("monthAndDay", {
				month: month.toString(),
				day: date.toString(),
			});
		}

		if (props.items.length === 0) return;

		const renderChildren = () =>
			props.items.map((item, i) => {
				if (!slots || !slots.default) return;

				const el = slots.default({
					item: item,
				})[0];
				if (el.key == null && item.id) el.key = item.id;

				if (
					i !== props.items.length - 1 &&
					new Date(item.createdAt).getDate() !==
						new Date(props.items[i + 1].createdAt).getDate() &&
					(!props.items?.[i + 2] ||
						new Date(props.items[i + 1].createdAt).getDate() ===
							new Date(props.items[i + 2].createdAt).getDate()) &&
					props.items?.[i - 1] &&
					new Date(item.createdAt).getDate() ===
						new Date(props.items[i - 1].createdAt).getDate()
				) {
					const separator = h(
						"div",
						{
							class: "separator",
							key: `${item.id}:separator`,
						},
						h(
							"p",
							{
								class: "date",
							},
							[
								h("span", [
									h("i", {
										class: "ph-caret-up ph-bold ph-lg icon",
									}),
									getDateText(item.createdAt),
								]),
								h("span", [
									getDateText(props.items[i + 1].createdAt),
									h("i", {
										class: "ph-caret-down ph-bold ph-lg icon",
									}),
								]),
							]
						)
					);

					return [el, separator];
				} else {
					if (props.ad && item._shouldInsertAd_) {
						return [
							h(MkAd, {
								class: "a", // advertiseの意(ブロッカー対策)
								key: `${item.id}:ad`,
								prefer: ["inline", "inline-big"],
							}),
							el,
						];
					} else {
						return el;
					}
				}
			});

		return () =>
			h(
				defaultStore.state.animation ? TransitionGroup : "div",
				defaultStore.state.animation
					? {
							class: `sqadhkmv${props.noGap ? " noGap" : ""}`,
							name: "list",
							tag: "div",
							"data-direction": props.direction,
							"data-reversed": props.reversed ? "true" : "false",
					  }
					: {
							class: `sqadhkmv${props.noGap ? " noGap" : ""}`,
					  },
				{ default: renderChildren }
			);
	},
});
</script>

<style lang="scss">
.sqadhkmv {
	> *:empty {
		display: none;
	}

	> *:not(:last-child) {
		margin-bottom: var(--margin);
	}

	> .list-move {
		transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1);
	}

	> .list-enter-active {
		transition: transform 0.7s cubic-bezier(0.23, 1, 0.32, 1),
			opacity 0.7s cubic-bezier(0.23, 1, 0.32, 1);
	}

	&[data-direction="up"] {
		> .list-enter-from {
			opacity: 0;
			transform: translateY(4rem);
		}
	}

	&[data-direction="down"] {
		> .list-enter-from {
			opacity: 0;
			transform: translateY(-4rem);
		}
	}

	> .separator {
		text-align: center;

		> .date {
			display: inline-block;
			position: relative;
			margin: 0;
			padding: 0 1rem;
			line-height: 2rem;
			text-align: center;
			font-size: 0.75rem;
			color: var(--dateLabelFg);

			> span {
				&:first-child {
					margin-right: 0.5rem;

					> .icon {
						margin-right: 0.5rem;
					}
				}

				&:last-child {
					margin-left: 0.5rem;

					> .icon {
						margin-left: 0.5rem;
					}
				}
			}
		}
	}

	&.noGap {
		> * {
			margin: 0 !important;
			border: none;
			border-radius: 0;
			box-shadow: none;

			&:first-child {
				border-radius: var(--radius) var(--radius) 0 0;
			}
			&:last-child {
				border-radius: 0 0 var(--radius) var(--radius);
			}

			&:not(:last-child) {
				border-bottom: solid 0.03125rem var(--divider);
			}
		}
	}
}
</style>
