<mk-user>
	<div class="user" if={ !fetching }>
		<header>
			<mk-user-header user={ user }/>
		</header>
		<mk-user-home if={ page == 'home' } user={ user }/>
		<mk-user-graphs if={ page == 'graphs' } user={ user }/>
	</div>
	<style>
		:scope
			display block

			> .user
				> header
					max-width 1200px
					margin 0 auto
					padding 0 16px

					> mk-user-header
						border solid 1px rgba(0, 0, 0, 0.075)
						border-top none
						border-radius 0 0 6px 6px
						overflow hidden

	</style>
	<script>
		this.mixin('api');

		this.username = this.opts.user;
		this.page = this.opts.page ? this.opts.page : 'home';
		this.fetching = true;
		this.user = null;

		this.on('mount', () => {
			this.api('users/show', {
				username: this.username
			}).then(user => {
				this.update({
					fetching: false,
					user: user
				});
				this.trigger('loaded');
			});
		});
	</script>
</mk-user>

<mk-user-header data-is-dark-background={ user.banner_url != null }>
	<div class="banner" ref="banner" style={ user.banner_url ? 'background-image: url(' + user.banner_url + '?thumbnail&size=1024)' : '' } onclick={ onUpdateBanner }></div>
	<img class="avatar" src={ user.avatar_url + '?thumbnail&size=150' } alt="avatar"/>
	<div class="title">
		<p class="name" href={ '/' + user.username }>{ user.name }</p>
		<p class="username">@{ user.username }</p>
		<p class="location" if={ user.profile.location }><i class="fa fa-map-marker"></i>{ user.profile.location }</p>
	</div>
	<footer>
		<a href={ '/' + user.username }>投稿</a>
		<a href={ '/' + user.username + '/media' }>メディア</a>
		<a href={ '/' + user.username + '/graphs' }>グラフ</a>
	</footer>
	<style>
		:scope
			$footer-height = 58px

			display block
			background #fff

			&[data-is-dark-background]
				> .banner
					background-color #383838

				> .title
					color #fff
					background linear-gradient(transparent, rgba(0, 0, 0, 0.7))

					> .name
						text-shadow 0 0 8px #000

			> .banner
				height 280px
				background-color #f5f5f5
				background-size cover
				background-position center

			> .avatar
				display block
				position absolute
				bottom 16px
				left 16px
				z-index 2
				width 150px
				height 150px
				margin 0
				border solid 3px #fff
				border-radius 8px
				box-shadow 1px 1px 3px rgba(0, 0, 0, 0.2)

			> .title
				position absolute
				bottom $footer-height
				left 0
				width 100%
				padding 0 0 8px 195px
				color #656565
				font-family '游ゴシック', 'YuGothic', 'ヒラギノ角ゴ ProN W3', 'Hiragino Kaku Gothic ProN', 'Meiryo', 'メイリオ', sans-serif

				> .name
					display block
					margin 0
					line-height 40px
					font-weight bold
					font-size 2em

				> .username
				> .location
					display inline-block
					margin 0 16px 0 0
					line-height 20px
					opacity 0.8

					> i
						margin-right 4px

			> footer
				z-index 1
				height $footer-height
				padding-left 195px
				background #fff

				> a
					display inline-block
					margin 0
					width 100px
					line-height $footer-height
					color #555

				> button
					display block
					position absolute
					top 0
					right 0
					margin 8px
					padding 0
					width $footer-height - 16px
					line-height $footer-height - 16px - 2px
					font-size 1.2em
					color #777
					border solid 1px #eee
					border-radius 4px

					&:hover
						color #555
						border solid 1px #ddd

	</style>
	<script>
		import updateBanner from '../scripts/update-banner';

		this.mixin('i');

		this.user = this.opts.user;

		this.on('mount', () => {
			window.addEventListener('load', this.scroll);
			window.addEventListener('scroll', this.scroll);
			window.addEventListener('resize', this.scroll);
		});

		this.on('unmount', () => {
			window.removeEventListener('load', this.scroll);
			window.removeEventListener('scroll', this.scroll);
			window.removeEventListener('resize', this.scroll);
		});

		this.scroll = () => {
			const top = window.scrollY;
			const height = 280/*px*/;

			const pos = 50 - ((top / height) * 50);
			this.refs.banner.style.backgroundPosition = `center ${pos}%`;

			const blur = top / 32
			if (blur <= 10) this.refs.banner.style.filter = `blur(${blur}px)`;
		};

		this.onUpdateBanner = () => {
			if (!this.SIGNIN || this.I.id != this.user.id) return;

			updateBanner(this.I, i => {
				this.user.banner_url = i.banner_url;
				this.update();
			});
		};
	</script>
</mk-user-header>

<mk-user-profile>
	<div class="friend-form" if={ SIGNIN && I.id != user.id }>
		<mk-big-follow-button user={ user }/>
		<p class="followed" if={ user.is_followed }>フォローされています</p>
	</div>
	<div class="description" if={ user.description }>{ user.description }</div>
	<div class="birthday" if={ user.profile.birthday }>
		<p><i class="fa fa-birthday-cake"></i>{ user.profile.birthday.replace('-', '年').replace('-', '月') + '日' } ({ age(user.profile.birthday) }歳)</p>
	</div>
	<div class="twitter" if={ user.twitter }>
		<p><i class="fa fa-twitter"></i><a href={ 'https://twitter.com/' + user.twitter.screen_name } target="_blank">@{ user.twitter.screen_name }</a></p>
	</div>
	<div class="status">
	  <p class="posts-count"><i class="fa fa-angle-right"></i><a>{ user.posts_count }</a><b>ポスト</b></p>
		<p class="following"><i class="fa fa-angle-right"></i><a onclick={ showFollowing }>{ user.following_count }</a>人を<b>フォロー</b></p>
		<p class="followers"><i class="fa fa-angle-right"></i><a onclick={ showFollowers }>{ user.followers_count }</a>人の<b>フォロワー</b></p>
	</div>
	<style>
		:scope
			display block
			background #fff

			> *:first-child
				border-top none !important

			> .friend-form
				padding 16px
				border-top solid 1px #eee

				> mk-big-follow-button
					width 100%

				> .followed
					margin 12px 0 0 0
					padding 0
					text-align center
					line-height 24px
					font-size 0.8em
					color #71afc7
					background #eefaff
					border-radius 4px

			> .description
				padding 16px
				color #555
				border-top solid 1px #eee

			> .birthday
				padding 16px
				color #555
				border-top solid 1px #eee

				> p
					margin 0

					> i
						margin-right 8px

			> .twitter
				padding 16px
				color #555
				border-top solid 1px #eee

				> p
					margin 0

					> i
						margin-right 8px

			> .status
				padding 16px
				color #555
				border-top solid 1px #eee

				> p
					margin 8px 0

					> i
						margin-left 8px
						margin-right 8px

	</style>
	<script>
		this.age = require('s-age');

		this.mixin('i');

		this.user = this.opts.user;

		this.showFollowing = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-user-following-window')), {
				user: this.user
			});
		};

		this.showFollowers = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-user-followers-window')), {
				user: this.user
			});
		};
	</script>
</mk-user-profile>

<mk-user-photos>
	<p class="title"><i class="fa fa-camera"></i>フォト</p>
	<p class="initializing" if={ initializing }><i class="fa fa-spinner fa-pulse fa-fw"></i>読み込んでいます<mk-ellipsis/></p>
	<div class="stream" if={ !initializing && images.length > 0 }>
		<virtual each={ image in images }>
			<div class="img" style={ 'background-image: url(' + image.url + '?thumbnail&size=256)' }></div>
		</virtual>
	</div>
	<p class="empty" if={ !initializing && images.length == 0 }>写真はありません</p>
	<style>
		:scope
			display block
			background #fff

			> .title
				z-index 1
				margin 0
				padding 0 16px
				line-height 42px
				font-size 0.9em
				font-weight bold
				color #888
				box-shadow 0 1px rgba(0, 0, 0, 0.07)

				> i
					margin-right 4px

			> .stream
				display -webkit-flex
				display -moz-flex
				display -ms-flex
				display flex
				justify-content center
				flex-wrap wrap
				padding 8px

				> .img
					flex 1 1 33%
					width 33%
					height 80px
					background-position center center
					background-size cover
					background-clip content-box
					border solid 2px transparent

			> .initializing
			> .empty
				margin 0
				padding 16px
				text-align center
				color #aaa

				> i
					margin-right 4px

	</style>
	<script>
		import isPromise from '../../common/scripts/is-promise';

		this.mixin('api');

		this.images = [];
		this.initializing = true;
		this.user = null;
		this.userPromise = isPromise(this.opts.user)
			? this.opts.user
			: Promise.resolve(this.opts.user);

		this.on('mount', () => {
			this.userPromise.then(user => {
				this.update({
					user: user
				});

				this.api('users/posts', {
					user_id: this.user.id,
					with_media: true,
					limit: 9
				}).then(posts => {
					this.initializing = false;
					posts.forEach(post => {
						post.media.forEach(media => {
							if (this.images.length < 9) this.images.push(media);
						});
					});
					this.update();
				});
			});
		});
	</script>
</mk-user-photos>

<mk-user-home>
	<div>
		<mk-user-profile user={ user }/>
		<mk-user-photos user={ user }/>
	</div>
	<main>
		<mk-user-timeline ref="tl" user={ user }/>
	</main>
	<div>
		<mk-calendar-widget warp={ warp } start={ new Date(user.created_at) }/>
		<mk-activity-widget user={ user }/>
	</div>
	<style>
		:scope
			display flex
			justify-content center
			margin 0 auto
			max-width 1200px

			> *
				> *
					display block
					//border solid 1px #eaeaea
					border solid 1px rgba(0, 0, 0, 0.075)
					border-radius 6px

					&:not(:last-child)
						margin-bottom 16px

			> main
				padding 16px
				width calc(100% - 275px * 2)

			> div
				width 275px
				margin 0

				&:first-child
					padding 16px 0 16px 16px

				&:last-child
					padding 16px 16px 16px 0

	</style>
	<script>
		this.user = this.opts.user;

		this.on('mount', () => {
			this.refs.tl.on('loaded', () => {
				this.trigger('loaded');
			});
		});

		this.warp = date => {
			this.refs.tl.warp(date);
		};
	</script>
</mk-user-home>

<mk-user-graphs>
	<section>
		<h1>投稿</h1>
		<mk-user-posts-graph user={ opts.user }/>
	</section>
	<section>
		<h1>フォロー/フォロワー</h1>
		<mk-user-friends-graph user={ opts.user }/>
	</section>
	<section>
		<h1>いいね</h1>
		<mk-user-likes-graph user={ opts.user }/>
	</section>
	<style>
		:scope
			display block

			> section
				margin 16px 0
				background #fff
				border solid 1px rgba(0, 0, 0, 0.1)
				border-radius 4px

				> h1
					margin 0 0 8px 0
					padding 0 16px
					line-height 40px
					font-size 1em
					color #666
					border-bottom solid 1px #eee

				> *:not(h1)
					margin 0 auto 16px auto

	</style>
	<script>
		this.on('mount', () => {
			this.trigger('loaded');
		});
	</script>
</mk-user-graphs>
