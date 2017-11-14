<mk-post-page>
	<mk-ui ref="ui">
		<main if={ !parent.fetching }>
			<a if={ parent.post.next } href={ parent.post.next }><i class="fa fa-angle-up"></i>%i18n:desktop.tags.mk-post-page.next%</a>
			<mk-post-detail ref="detail" post={ parent.post }/>
			<a if={ parent.post.prev } href={ parent.post.prev }><i class="fa fa-angle-down"></i>%i18n:desktop.tags.mk-post-page.prev%</a>
		</main>
	</mk-ui>
	<style>
		:scope
			display block

			main
				padding 16px
				text-align center

				> a
					display inline-block

					&:first-child
						margin-bottom 4px

					&:last-child
						margin-top 4px

					> i
						margin-right 4px

				> mk-post-detail
					margin 0 auto
					width 640px

	</style>
	<script>
		import Progress from '../../../common/scripts/loading';

		this.mixin('api');

		this.fetching = true;
		this.post = null;

		this.on('mount', () => {
			Progress.start();

			this.api('posts/show', {
				post_id: this.opts.post
			}).then(post => {

				this.update({
					fetching: false,
					post: post
				});

				Progress.done();
			});
		});
	</script>
</mk-post-page>
