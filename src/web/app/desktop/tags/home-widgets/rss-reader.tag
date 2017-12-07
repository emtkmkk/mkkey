<mk-rss-reader-home-widget>
	<virtual if={ !data.compact }>
		<p class="title">%fa:rss-square%RSS</p>
		<button onclick={ settings } title="設定">%fa:cog%</button>
	</virtual>
	<div class="feed" if={ !initializing }>
		<virtual each={ item in items }><a href={ item.link } target="_blank">{ item.title }</a></virtual>
	</div>
	<p class="initializing" if={ initializing }>%fa:spinner .pluse .fw%%i18n:common.loading%<mk-ellipsis/></p>
	<style>
		:scope
			display block
			background #fff
			border solid 1px rgba(0, 0, 0, 0.075)
			border-radius 6px

			> .title
				margin 0
				padding 0 16px
				line-height 42px
				font-size 0.9em
				font-weight bold
				color #888
				box-shadow 0 1px rgba(0, 0, 0, 0.07)

				> [data-fa]
					margin-right 4px

			> button
				position absolute
				top 0
				right 0
				padding 0
				width 42px
				font-size 0.9em
				line-height 42px
				color #ccc

				&:hover
					color #aaa

				&:active
					color #999

			> .feed
				padding 12px 16px
				font-size 0.9em

				> a
					display block
					padding 4px 0
					color #666
					border-bottom dashed 1px #eee

					&:last-child
						border-bottom none

			> .initializing
				margin 0
				padding 16px
				text-align center
				color #aaa

				> [data-fa]
					margin-right 4px

	</style>
	<script>
		this.data = {
			compact: false
		};

		this.mixin('widget');

		this.url = 'http://news.yahoo.co.jp/pickup/rss.xml';
		this.items = [];
		this.initializing = true;

		this.on('mount', () => {
			this.fetch();
			this.clock = setInterval(this.fetch, 60000);
		});

		this.on('unmount', () => {
			clearInterval(this.clock);
		});

		this.fetch = () => {
			fetch(`https://api.rss2json.com/v1/api.json?rss_url=${this.url}`, {
				cache: 'no-cache'
			}).then(res => {
				res.json().then(feed => {
					this.update({
						initializing: false,
						items: feed.items
					});
				});
			});
		};

		this.settings = () => {
		};

		this.func = () => {
			this.data.compact = !this.data.compact;
			this.save();
		};
	</script>
</mk-rss-reader-home-widget>
