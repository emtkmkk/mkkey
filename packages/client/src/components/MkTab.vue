<script lang="ts">
import { defineComponent, h, resolveDirective, withDirectives } from "vue";

export default defineComponent({
	props: {
		modelValue: {
			required: true,
		},
	},
	render() {
		const options = this.$slots.default();

		return h(
			"div",
			{
				class: "pxhvhrfw",
			},
			options.map((option) =>
				withDirectives(
					h(
						"button",
						{
							class: [
								"_button",
								{
									active:
										this.modelValue === option.props?.value,
								},
							],
							key: option.key,
							disabled: this.modelValue === option.props?.value,
							onClick: () => {
								this.$emit(
									"update:modelValue",
									option.props?.value
								);
							},
						},
						option.children
					),
					[[resolveDirective("click-anime")]]
				)
			)
		);
	},
});
</script>

<style lang="scss">
.pxhvhrfw {
	display: flex;
	font-size: 90%;
	border-radius: var(--radius);
	padding: 0.625rem 0.5rem;

	> button {
		flex: 1;
		padding: 0.625rem 0.5rem;
		margin: 0 0.5rem;
		border-radius: var(--radius);

		&:disabled {
			opacity: 1 !important;
			cursor: default;
		}

		&.active {
			color: var(--accent);
			background: var(--accentedBg);
		}

		&:not(.active):hover {
			color: var(--fgHighlighted);
			background: var(--panelHighlight);
		}

		&:not(:first-child) {
			margin-left: 0.5rem;
		}

		> .icon {
			margin-right: 0.375rem;
		}
	}

	&.max-width_500px {
		font-size: 80%;

		> button {
			padding: 0.6875rem 0.5rem;
		}
	}
}
</style>
