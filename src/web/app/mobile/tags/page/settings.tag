<mk-settings-page>
	<mk-ui ref="ui">
		<mk-settings />
	</mk-ui>
	<style>
		:scope
			display block
	</style>
	<script>
		import ui from '../../scripts/ui-event';

		this.on('mount', () => {
			document.title = 'Misskey | %i18n:mobile.tags.mk-settings-page.settings%';
			ui.trigger('title', '<i class="fa fa-cog"></i>%i18n:mobile.tags.mk-settings-page.settings%');
			document.documentElement.style.background = '#313a42';
		});
	</script>
</mk-settings-page>

<mk-settings>
	<p><mk-raw content={ '%i18n:mobile.tags.mk-settings.signed-in-as%'.replace('{}', '<b>' + I.name + '</b>') }/></p>
	<ul>
		<li><a href="./settings/profile"><i class="fa fa-user"></i>%i18n:mobile.tags.mk-settings-page.profile%<i class="fa fa-angle-right"></i></a></li>
		<li><a href="./settings/authorized-apps"><i class="fa fa-puzzle-piece"></i>%i18n:mobile.tags.mk-settings-page.applications%<i class="fa fa-angle-right"></i></a></li>
		<li><a href="./settings/twitter"><i class="fa fa-twitter"></i>%i18n:mobile.tags.mk-settings-page.twitter-integration%<i class="fa fa-angle-right"></i></a></li>
		<li><a href="./settings/signin-history"><i class="fa fa-sign-in"></i>%i18n:mobile.tags.mk-settings-page.signin-history%<i class="fa fa-angle-right"></i></a></li>
		<li><a href="./settings/api"><i class="fa fa-key"></i>%i18n:mobile.tags.mk-settings-page.api%<i class="fa fa-angle-right"></i></a></li>
	</ul>
	<ul>
		<li><a onclick={ signout }><i class="fa fa-power-off"></i>%i18n:mobile.tags.mk-settings-page.signout%</a></li>
	</ul>
	<p><small>ver { _VERSION_ } (葵 aoi)</small></p>
	<style>
		:scope
			display block

			> p
				display block
				margin 24px
				text-align center
				color #cad2da

			> ul
				$radius = 8px

				display block
				margin 16px auto
				padding 0
				max-width 500px
				width calc(100% - 32px)
				list-style none
				background #fff
				border solid 1px rgba(0, 0, 0, 0.2)
				border-radius $radius

				> li
					display block
					border-bottom solid 1px #ddd

					&:hover
						background rgba(0, 0, 0, 0.1)

					&:first-child
						border-top-left-radius $radius
						border-top-right-radius $radius

					&:last-child
						border-bottom-left-radius $radius
						border-bottom-right-radius $radius
						border-bottom none

					> a
						$height = 48px

						display block
						position relative
						padding 0 16px
						line-height $height
						color #4d635e

						> i:nth-of-type(1)
							margin-right 4px

						> i:nth-of-type(2)
							display block
							position absolute
							top 0
							right 8px
							z-index 1
							padding 0 20px
							font-size 1.2em
							line-height $height

	</style>
	<script>
		import signout from '../../../common/scripts/signout';
		this.signout = signout;

		this.mixin('i');
	</script>
</mk-settings>
