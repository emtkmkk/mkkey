<mk-selectdrive-page>
	<mk-drive-browser ref="browser" multiple={ multiple }/>
	<div>
		<button class="upload" title="PCからドライブにファイルをアップロード" onclick={ upload }><i class="fa fa-upload"></i></button>
		<button class="cancel" onclick={ close }>キャンセル</button>
		<button class="ok" onclick={ ok }>決定</button>
	</div>

	<style>
		:scope
			display block
			height 100%
			background #fff

			> mk-drive-browser
				height calc(100% - 72px)

			> div
				position fixed
				bottom 0
				left 0
				width 100%
				height 72px
				background lighten($theme-color, 95%)

				.upload
					display inline-block
					position absolute
					top 8px
					left 16px
					cursor pointer
					padding 0
					margin 8px 4px 0 0
					width 40px
					height 40px
					font-size 1em
					color rgba($theme-color, 0.5)
					background transparent
					outline none
					border solid 1px transparent
					border-radius 4px

					&:hover
						background transparent
						border-color rgba($theme-color, 0.3)

					&:active
						color rgba($theme-color, 0.6)
						background transparent
						border-color rgba($theme-color, 0.5)
						box-shadow 0 2px 4px rgba(darken($theme-color, 50%), 0.15) inset

					&:focus
						&:after
							content ""
							pointer-events none
							position absolute
							top -5px
							right -5px
							bottom -5px
							left -5px
							border 2px solid rgba($theme-color, 0.3)
							border-radius 8px

				.ok
				.cancel
					display block
					position absolute
					bottom 16px
					cursor pointer
					padding 0
					margin 0
					width 120px
					height 40px
					font-size 1em
					outline none
					border-radius 4px

					&:focus
						&:after
							content ""
							pointer-events none
							position absolute
							top -5px
							right -5px
							bottom -5px
							left -5px
							border 2px solid rgba($theme-color, 0.3)
							border-radius 8px

					&:disabled
						opacity 0.7
						cursor default

				.ok
					right 16px
					color $theme-color-foreground
					background linear-gradient(to bottom, lighten($theme-color, 25%) 0%, lighten($theme-color, 10%) 100%)
					border solid 1px lighten($theme-color, 15%)

					&:not(:disabled)
						font-weight bold

					&:hover:not(:disabled)
						background linear-gradient(to bottom, lighten($theme-color, 8%) 0%, darken($theme-color, 8%) 100%)
						border-color $theme-color

					&:active:not(:disabled)
						background $theme-color
						border-color $theme-color

				.cancel
					right 148px
					color #888
					background linear-gradient(to bottom, #ffffff 0%, #f5f5f5 100%)
					border solid 1px #e2e2e2

					&:hover
						background linear-gradient(to bottom, #f9f9f9 0%, #ececec 100%)
						border-color #dcdcdc

					&:active
						background #ececec
						border-color #dcdcdc

	</style>
	<script>
		const q = (new URL(location)).searchParams;
		this.multiple = q.get('multiple') == 'true' ? true : false;

		this.on('mount', () => {
			document.documentElement.style.background = '#fff';

			this.refs.browser.on('selected', file => {
				this.files = [file];
				this.ok();
			});

			this.refs.browser.on('change-selection', files => {
				this.update({
					files: files
				});
			});
		});

		this.upload = () => {
			this.refs.browser.selectLocalFile();
		};

		this.close = () => {
			window.close();
		};

		this.ok = () => {
			window.opener.cb(this.multiple ? this.files : this.files[0]);
			window.close();
		};
	</script>
</mk-selectdrive-page>
