import Vue from 'vue';

export default function <T extends object>(data: {
	name: string;
	props?: () => T;
}) {
	return Vue.extend({
		props: {
			widget: {
				type: Object
			},
			platform: {
				type: String,
				required: true
			},
			isCustomizeMode: {
				type: Boolean,
				default: false
			}
		},

		computed: {
			id(): string {
				return this.widget.id;
			},

			props(): T {
				return this.widget.data;
			}
		},

		data() {
			return {
				bakedOldProps: null
			};
		},

		created() {
			this.mergeProps();

			this.$watch('props', () => {
				this.mergeProps();
			});

			this.bakeProps();
		},

		methods: {
			bakeProps() {
				this.bakedOldProps = JSON.stringify(this.props);
			},

			mergeProps() {
				if (data.props) {
					const defaultProps = data.props();
					for (const prop of Object.keys(defaultProps)) {
						if (this.props.hasOwnProperty(prop)) continue;
						Vue.set(this.props, prop, defaultProps[prop]);
					}
				}
			},

			save() {
				if (this.bakedOldProps == JSON.stringify(this.props)) return;

				this.bakeProps();

				this.$root.api('i/update_widget', {
					id: this.id,
					data: this.props
				});
			}
		}
	});
}
