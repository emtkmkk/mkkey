<mk-timemachine-home-widget>
	<mk-calendar-widget design={ data.design } warp={ warp }/>
	<style>
		:scope
			display block
	</style>
	<script>
		this.data = {
			design: 0
		};

		this.mixin('widget');

		this.warp = date => {
			this.opts.tl.warp(date);
		};

		this.func = () => {
			if (++this.data.design == 6) this.data.design = 0;
			this.save();
		};
	</script>
</mk-timemachine-home-widget>
