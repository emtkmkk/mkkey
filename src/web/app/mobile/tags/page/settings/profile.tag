<mk-profile-setting-page>
	<mk-ui ref="ui">
		<mk-profile-setting/>
	</mk-ui>
	<style lang="stylus" scoped>
		:scope
			display block
	</style>
	<script lang="typescript">
		import ui from '../../../scripts/ui-event';

		this.on('mount', () => {
			document.title = 'Misskey | %i18n:mobile.tags.mk-profile-setting-page.title%';
			ui.trigger('title', '%fa:user%%i18n:mobile.tags.mk-profile-setting-page.title%');
			document.documentElement.style.background = '#313a42';
		});
	</script>
</mk-profile-setting-page>

<mk-profile-setting>
	<div>
		<p>%fa:info-circle%%i18n:mobile.tags.mk-profile-setting.will-be-published%</p>
		<div class="form">
			<div style={ I.banner_url ? 'background-image: url(' + I.banner_url + '?thumbnail&size=1024)' : '' } @click="clickBanner">
				<img src={ I.avatar_url + '?thumbnail&size=200' } alt="avatar" @click="clickAvatar"/>
			</div>
			<label>
				<p>%i18n:mobile.tags.mk-profile-setting.name%</p>
				<input ref="name" type="text" value={ I.name }/>
			</label>
			<label>
				<p>%i18n:mobile.tags.mk-profile-setting.location%</p>
				<input ref="location" type="text" value={ I.profile.location }/>
			</label>
			<label>
				<p>%i18n:mobile.tags.mk-profile-setting.description%</p>
				<textarea ref="description">{ I.description }</textarea>
			</label>
			<label>
				<p>%i18n:mobile.tags.mk-profile-setting.birthday%</p>
				<input ref="birthday" type="date" value={ I.profile.birthday }/>
			</label>
			<label>
				<p>%i18n:mobile.tags.mk-profile-setting.avatar%</p>
				<button @click="setAvatar" disabled={ avatarSaving }>%i18n:mobile.tags.mk-profile-setting.set-avatar%</button>
			</label>
			<label>
				<p>%i18n:mobile.tags.mk-profile-setting.banner%</p>
				<button @click="setBanner" disabled={ bannerSaving }>%i18n:mobile.tags.mk-profile-setting.set-banner%</button>
			</label>
		</div>
		<button class="save" @click="save" disabled={ saving }>%fa:check%%i18n:mobile.tags.mk-profile-setting.save%</button>
	</div>
	<style lang="stylus" scoped>
		:scope
			display block

			> div
				margin 8px auto
				max-width 500px
				width calc(100% - 16px)

				@media (min-width 500px)
					margin 16px auto
					width calc(100% - 32px)

				> p
					display block
					margin 0 0 8px 0
					padding 12px 16px
					font-size 14px
					color #79d4e6
					border solid 1px #71afbb
					//color #276f86
					//background #f8ffff
					//border solid 1px #a9d5de
					border-radius 8px

					> [data-fa]
						margin-right 6px

				> .form
					position relative
					background #fff
					box-shadow 0 0 0 1px rgba(0, 0, 0, 0.2)
					border-radius 8px

					&:before
						content ""
						display block
						position absolute
						bottom -20px
						left calc(50% - 10px)
						border-top solid 10px rgba(0, 0, 0, 0.2)
						border-right solid 10px transparent
						border-bottom solid 10px transparent
						border-left solid 10px transparent

					&:after
						content ""
						display block
						position absolute
						bottom -16px
						left calc(50% - 8px)
						border-top solid 8px #fff
						border-right solid 8px transparent
						border-bottom solid 8px transparent
						border-left solid 8px transparent

					> div
						height 128px
						background-color #e4e4e4
						background-size cover
						background-position center
						border-radius 8px 8px 0 0

						> img
							position absolute
							top 25px
							left calc(50% - 40px)
							width 80px
							height 80px
							border solid 2px #fff
							border-radius 8px

					> label
						display block
						margin 0
						padding 16px
						border-bottom solid 1px #eee

						&:last-of-type
							border none

						> p:first-child
							display block
							margin 0
							padding 0 0 4px 0
							font-weight bold
							color #2f3c42

						> input[type="text"]
						> textarea
							display block
							width 100%
							padding 12px
							font-size 16px
							color #192427
							border solid 2px #ddd
							border-radius 4px

						> textarea
							min-height 80px

				> .save
					display block
					margin 8px 0 0 0
					padding 16px
					width 100%
					font-size 16px
					color $theme-color-foreground
					background $theme-color
					border-radius 8px

					&:disabled
						opacity 0.7

					> [data-fa]
						margin-right 4px

	</style>
	<script lang="typescript">
		this.mixin('i');
		this.mixin('api');

		this.setAvatar = () => {
			const i = riot.mount(document.body.appendChild(document.createElement('mk-drive-selector')), {
				multiple: false
			})[0];
			i.one('selected', file => {
				this.update({
					avatarSaving: true
				});

				this.api('i/update', {
					avatar_id: file.id
				}).then(() => {
					this.update({
						avatarSaving: false
					});

					alert('%i18n:mobile.tags.mk-profile-setting.avatar-saved%');
				});
			});
		};

		this.setBanner = () => {
			const i = riot.mount(document.body.appendChild(document.createElement('mk-drive-selector')), {
				multiple: false
			})[0];
			i.one('selected', file => {
				this.update({
					bannerSaving: true
				});

				this.api('i/update', {
					banner_id: file.id
				}).then(() => {
					this.update({
						bannerSaving: false
					});

					alert('%i18n:mobile.tags.mk-profile-setting.banner-saved%');
				});
			});
		};

		this.clickAvatar = e => {
			this.setAvatar();
			return false;
		};

		this.clickBanner = e => {
			this.setBanner();
			return false;
		};

		this.save = () => {
			this.update({
				saving: true
			});

			this.api('i/update', {
				name: this.$refs.name.value,
				location: this.$refs.location.value || null,
				description: this.$refs.description.value || null,
				birthday: this.$refs.birthday.value || null
			}).then(() => {
				this.update({
					saving: false
				});

				alert('%i18n:mobile.tags.mk-profile-setting.saved%');
			});
		};
	</script>
</mk-profile-setting>
