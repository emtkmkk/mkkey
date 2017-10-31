<mk-timeline>
	<virtual each={ post, i in posts }>
		<mk-timeline-post post={ post }/>
		<p class="date" if={ i != posts.length - 1 && post._date != posts[i + 1]._date }><span><i class="fa fa-angle-up"></i>{ post._datetext }</span><span><i class="fa fa-angle-down"></i>{ posts[i + 1]._datetext }</span></p>
	</virtual>
	<footer data-yield="footer">
		<yield from="footer"/>
	</footer>
	<style>
		:scope
			display block

			> .date
				display block
				margin 0
				line-height 32px
				font-size 14px
				text-align center
				color #aaa
				background #fdfdfd
				border-bottom solid 1px #eaeaea

				span
					margin 0 16px

				i
					margin-right 8px

			> footer
				padding 16px
				text-align center
				color #ccc
				border-top solid 1px #eaeaea
				border-bottom-left-radius 4px
				border-bottom-right-radius 4px

	</style>
	<script>
		this.posts = [];

		this.on('update', () => {
			this.posts.forEach(post => {
				const date = new Date(post.created_at).getDate();
				const month = new Date(post.created_at).getMonth() + 1;
				post._date = date;
				post._datetext = `${month}月 ${date}日`;
			});
		});

		this.setPosts = posts => {
			this.update({
				posts: posts
			});
		};

		this.prependPosts = posts => {
			posts.forEach(post => {
				this.posts.push(post);
				this.update();
			});
		}

		this.addPost = post => {
			this.posts.unshift(post);
			this.update();
		};

		this.tail = () => {
			return this.posts[this.posts.length - 1];
		};

		this.clear = () => {
			this.posts = [];
			this.update();
		};

		this.focus = () => {
			this.root.children[0].focus();
		};

	</script>
</mk-timeline>

<mk-timeline-post tabindex="-1" title={ title } onkeydown={ onKeyDown } dblclick={ onDblClick }>
	<div class="reply-to" if={ p.reply_to }>
		<mk-timeline-post-sub post={ p.reply_to }/>
	</div>
	<div class="repost" if={ isRepost }>
		<p>
			<a class="avatar-anchor" href={ '/' + post.user.username } data-user-preview={ post.user_id }>
				<img class="avatar" src={ post.user.avatar_url + '?thumbnail&size=32' } alt="avatar"/>
			</a>
			<i class="fa fa-retweet"></i>{'%i18n:desktop.tags.mk-timeline-post.reposted-by%'.substr(0, '%i18n:desktop.tags.mk-timeline-post.reposted-by%'.indexOf('{'))}<a class="name" href={ '/' + post.user.username } data-user-preview={ post.user_id }>{ post.user.name }</a>{'%i18n:desktop.tags.mk-timeline-post.reposted-by%'.substr('%i18n:desktop.tags.mk-timeline-post.reposted-by%'.indexOf('}') + 1)}
		</p>
		<mk-time time={ post.created_at }/>
	</div>
	<article>
		<a class="avatar-anchor" href={ '/' + p.user.username }>
			<img class="avatar" src={ p.user.avatar_url + '?thumbnail&size=64' } alt="avatar" data-user-preview={ p.user.id }/>
		</a>
		<div class="main">
			<header>
				<a class="name" href={ '/' + p.user.username } data-user-preview={ p.user.id }>{ p.user.name }</a>
				<span class="is-bot" if={ p.user.is_bot }>bot</span>
				<span class="username">@{ p.user.username }</span>
				<div class="info">
					<span class="app" if={ p.app }>via <b>{ p.app.name }</b></span>
					<a class="created-at" href={ url }>
						<mk-time time={ p.created_at }/>
					</a>
				</div>
			</header>
			<div class="body">
				<div class="text" ref="text">
					<p class="channel" if={ p.channel != null }><a href={ CONFIG.chUrl + '/' + p.channel.id } target="_blank">{ p.channel.title }</a>:</p>
					<a class="reply" if={ p.reply_to }>
						<i class="fa fa-reply"></i>
					</a>
					<p class="dummy"></p>
					<a class="quote" if={ p.repost != null }>RP:</a>
				</div>
				<div class="media" if={ p.media }>
					<mk-images-viewer images={ p.media }/>
				</div>
				<mk-poll if={ p.poll } post={ p } ref="pollViewer"/>
				<div class="repost" if={ p.repost }><i class="fa fa-quote-right fa-flip-horizontal"></i>
					<mk-post-preview class="repost" post={ p.repost }/>
				</div>
			</div>
			<footer>
				<mk-reactions-viewer post={ p } ref="reactionsViewer"/>
				<button onclick={ reply } title="%i18n:desktop.tags.mk-timeline-post.reply%">
					<i class="fa fa-reply"></i><p class="count" if={ p.replies_count > 0 }>{ p.replies_count }</p>
				</button>
				<button onclick={ repost } title="%i18n:desktop.tags.mk-timeline-post.repost%">
					<i class="fa fa-retweet"></i><p class="count" if={ p.repost_count > 0 }>{ p.repost_count }</p>
				</button>
				<button class={ reacted: p.my_reaction != null } onclick={ react } ref="reactButton" title="%i18n:desktop.tags.mk-timeline-post.add-reaction%">
					<i class="fa fa-plus"></i><p class="count" if={ p.reactions_count > 0 }>{ p.reactions_count }</p>
				</button>
				<button onclick={ menu } ref="menuButton">
					<i class="fa fa-ellipsis-h"></i>
				</button>
				<button onclick={ toggleDetail } title="%i18n:desktop.tags.mk-timeline-post.detail">
					<i class="fa fa-caret-down" if={ !isDetailOpened }></i>
					<i class="fa fa-caret-up" if={ isDetailOpened }></i>
				</button>
			</footer>
		</div>
	</article>
	<div class="detail" if={ isDetailOpened }>
		<mk-post-status-graph width="462" height="130" post={ p }/>
	</div>
	<style>
		:scope
			display block
			margin 0
			padding 0
			background #fff
			border-bottom solid 1px #eaeaea

			&:first-child
				border-top-left-radius 6px
				border-top-right-radius 6px

				> .repost
					border-top-left-radius 6px
					border-top-right-radius 6px

			&:last-of-type
				border-bottom none

			&:focus
				z-index 1

				&:after
					content ""
					pointer-events none
					position absolute
					top 2px
					right 2px
					bottom 2px
					left 2px
					border 2px solid rgba($theme-color, 0.3)
					border-radius 4px

			> .repost
				color #9dbb00
				background linear-gradient(to bottom, #edfde2 0%, #fff 100%)

				> p
					margin 0
					padding 16px 32px
					line-height 28px

					.avatar-anchor
						display inline-block

						.avatar
							vertical-align bottom
							width 28px
							height 28px
							margin 0 8px 0 0
							border-radius 6px

					i
						margin-right 4px

					.name
						font-weight bold

				> mk-time
					position absolute
					top 16px
					right 32px
					font-size 0.9em
					line-height 28px

				& + article
					padding-top 8px

			> .reply-to
				padding 0 16px
				background rgba(0, 0, 0, 0.0125)

				> mk-post-preview
					background transparent

			> article
				padding 28px 32px 18px 32px

				&:after
					content ""
					display block
					clear both

				&:hover
					> .main > footer > button
						color #888

				> .avatar-anchor
					display block
					float left
					margin 0 16px 10px 0
					position -webkit-sticky
					position sticky
					top 74px

					> .avatar
						display block
						width 58px
						height 58px
						margin 0
						border-radius 8px
						vertical-align bottom

				> .main
					float left
					width calc(100% - 74px)

					> header
						display flex
						margin-bottom 4px
						white-space nowrap
						line-height 1.4

						> .name
							display block
							margin 0 .5em 0 0
							padding 0
							overflow hidden
							color #777
							font-size 1em
							font-weight 700
							text-align left
							text-decoration none
							text-overflow ellipsis

							&:hover
								text-decoration underline

						> .is-bot
							text-align left
							margin 0 .5em 0 0
							padding 1px 6px
							font-size 12px
							color #aaa
							border solid 1px #ddd
							border-radius 3px

						> .username
							text-align left
							margin 0 .5em 0 0
							color #ccc

						> .info
							margin-left auto
							text-align right
							font-size 0.9em

							> .app
								margin-right 8px
								padding-right 8px
								color #ccc
								border-right solid 1px #eaeaea

							> .created-at
								color #c0c0c0

					> .body

						> .text
							cursor default
							display block
							margin 0
							padding 0
							overflow-wrap break-word
							font-size 1.1em
							color #717171

							> .dummy
								display none

							mk-url-preview
								margin-top 8px

							.link
								&:after
									content "\f14c"
									display inline-block
									padding-left 2px
									font-family FontAwesome
									font-size .9em
									font-weight 400
									font-style normal

							> .channel
								margin 0

							> .reply
								margin-right 8px
								color #717171

							> .quote
								margin-left 4px
								font-style oblique
								color #a0bf46

							code
								padding 4px 8px
								margin 0 0.5em
								font-size 80%
								color #525252
								background #f8f8f8
								border-radius 2px

							pre > code
								padding 16px
								margin 0

							[data-is-me]:after
								content "you"
								padding 0 4px
								margin-left 4px
								font-size 80%
								color $theme-color-foreground
								background $theme-color
								border-radius 4px

						> .media
							> img
								display block
								max-width 100%

						> mk-poll
							font-size 80%

						> .repost
							margin 8px 0

							> i:first-child
								position absolute
								top -8px
								left -8px
								z-index 1
								color #c0dac6
								font-size 28px
								background #fff

							> mk-post-preview
								padding 16px
								border dashed 1px #c0dac6
								border-radius 8px

					> footer
						> button
							margin 0 28px 0 0
							padding 0 8px
							line-height 32px
							font-size 1em
							color #ddd
							background transparent
							border none
							cursor pointer

							&:hover
								color #666

							> .count
								display inline
								margin 0 0 0 8px
								color #999

							&.reacted
								color $theme-color

							&:last-child
								position absolute
								right 0
								margin 0

			> .detail
				padding-top 4px
				background rgba(0, 0, 0, 0.0125)

	</style>
	<script>
		import compile from '../../common/scripts/text-compiler';
		import dateStringify from '../../common/scripts/date-stringify';

		this.mixin('i');
		this.mixin('api');
		this.mixin('stream');
		this.mixin('user-preview');

		this.isDetailOpened = false;

		this.set = post => {
			this.post = post;
			this.isRepost = this.post.repost && this.post.text == null && this.post.media_ids == null && this.post.poll == null;
			this.p = this.isRepost ? this.post.repost : this.post;
			this.p.reactions_count = this.p.reaction_counts ? Object.keys(this.p.reaction_counts).map(key => this.p.reaction_counts[key]).reduce((a, b) => a + b) : 0;
			this.title = dateStringify(this.p.created_at);
			this.url = `/${this.p.user.username}/${this.p.id}`;
		};

		this.set(this.opts.post);

		this.refresh = post => {
			this.set(post);
			this.update();
			if (this.refs.reactionsViewer) this.refs.reactionsViewer.update({
				post
			});
			if (this.refs.pollViewer) this.refs.pollViewer.init(post);
		};

		this.onStreamPostUpdated = data => {
			const post = data.post;
			if (post.id == this.post.id) {
				this.refresh(post);
			}
		};

		this.onStreamConnected = () => {
			this.capture();
		};

		this.capture = withHandler => {
			if (this.SIGNIN) {
				this.stream.send({
					type: 'capture',
					id: this.post.id
				});
				if (withHandler) this.stream.on('post-updated', this.onStreamPostUpdated);
			}
		};

		this.decapture = withHandler => {
			if (this.SIGNIN) {
				this.stream.send({
					type: 'decapture',
					id: this.post.id
				});
				if (withHandler) this.stream.off('post-updated', this.onStreamPostUpdated);
			}
		};

		this.on('mount', () => {
			this.capture(true);

			if (this.SIGNIN) {
				this.stream.on('_connected_', this.onStreamConnected);
			}

			if (this.p.text) {
				const tokens = this.p.ast;

				this.refs.text.innerHTML = this.refs.text.innerHTML.replace('<p class="dummy"></p>', compile(tokens));

				this.refs.text.children.forEach(e => {
					if (e.tagName == 'MK-URL') riot.mount(e);
				});

				// URLをプレビュー
				tokens
				.filter(t => (t.type == 'url' || t.type == 'link') && !t.silent)
				.map(t => {
					riot.mount(this.refs.text.appendChild(document.createElement('mk-url-preview')), {
						url: t.url
					});
				});
			}
		});

		this.on('unmount', () => {
			this.decapture(true);
			this.stream.off('_connected_', this.onStreamConnected);
		});

		this.reply = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-post-form-window')), {
				reply: this.p
			});
		};

		this.repost = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-repost-form-window')), {
				post: this.p
			});
		};

		this.react = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-reaction-picker')), {
				source: this.refs.reactButton,
				post: this.p
			});
		};

		this.menu = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-post-menu')), {
				source: this.refs.menuButton,
				post: this.p
			});
		};

		this.toggleDetail = () => {
			this.update({
				isDetailOpened: !this.isDetailOpened
			});
		};

		this.onKeyDown = e => {
			let shouldBeCancel = true;

			switch (true) {
				case e.which == 38: // [↑]
				case e.which == 74: // [j]
				case e.which == 9 && e.shiftKey: // [Shift] + [Tab]
					focus(this.root, e => e.previousElementSibling);
					break;

				case e.which == 40: // [↓]
				case e.which == 75: // [k]
				case e.which == 9: // [Tab]
					focus(this.root, e => e.nextElementSibling);
					break;

				case e.which == 81: // [q]
				case e.which == 69: // [e]
					this.repost();
					break;

				case e.which == 70: // [f]
				case e.which == 76: // [l]
					this.like();
					break;

				case e.which == 82: // [r]
					this.reply();
					break;

				default:
					shouldBeCancel = false;
			}

			if (shouldBeCancel) e.preventDefault();
		};

		this.onDblClick = () => {
			riot.mount(document.body.appendChild(document.createElement('mk-detailed-post-window')), {
				post: this.p.id
			});
		};

		function focus(el, fn) {
			const target = fn(el);
			if (target) {
				if (target.hasAttribute('tabindex')) {
					target.focus();
				} else {
					focus(target, fn);
				}
			}
		}
	</script>
</mk-timeline-post>

<mk-timeline-post-sub title={ title }>
	<article>
		<a class="avatar-anchor" href={ '/' + post.user.username }>
			<img class="avatar" src={ post.user.avatar_url + '?thumbnail&size=64' } alt="avatar" data-user-preview={ post.user_id }/>
		</a>
		<div class="main">
			<header>
				<a class="name" href={ '/' + post.user.username } data-user-preview={ post.user_id }>{ post.user.name }</a>
				<span class="username">@{ post.user.username }</span>
				<a class="created-at" href={ '/' + post.user.username + '/' + post.id }>
					<mk-time time={ post.created_at }/>
				</a>
			</header>
			<div class="body">
				<mk-sub-post-content class="text" post={ post }/>
			</div>
		</div>
	</article>
	<style>
		:scope
			display block
			margin 0
			padding 0
			font-size 0.9em

			> article
				padding 16px

				&:after
					content ""
					display block
					clear both

				&:hover
					> .main > footer > button
						color #888

				> .avatar-anchor
					display block
					float left
					margin 0 14px 0 0

					> .avatar
						display block
						width 52px
						height 52px
						margin 0
						border-radius 8px
						vertical-align bottom

				> .main
					float left
					width calc(100% - 66px)

					> header
						display flex
						margin-bottom 2px
						white-space nowrap
						line-height 21px

						> .name
							display block
							margin 0 .5em 0 0
							padding 0
							overflow hidden
							color #607073
							font-size 1em
							font-weight 700
							text-align left
							text-decoration none
							text-overflow ellipsis

							&:hover
								text-decoration underline

						> .username
							text-align left
							margin 0 .5em 0 0
							color #d1d8da

						> .created-at
							margin-left auto
							color #b2b8bb

					> .body

						> .text
							cursor default
							margin 0
							padding 0
							font-size 1.1em
							color #717171

							pre
								max-height 120px
								font-size 80%

	</style>
	<script>
		import dateStringify from '../../common/scripts/date-stringify';

		this.mixin('user-preview');

		this.post = this.opts.post;
		this.title = dateStringify(this.post.created_at);
	</script>
</mk-timeline-post-sub>
