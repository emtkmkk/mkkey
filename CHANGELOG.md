# Changelog

All changes from v13.0.0 onwards, for a full list of differences read CALCKEY.md

## [13.1.3] - 2023-02-09

### Bug Fixes

- Fix: Hide unmute option when the user is blocked

### Features

- Feat: Mute and unfollow when blocking a user

- Feat: Unblock with follow button

- Feat: プロフィールでのリンク検証

- Refresh user when changed

- Feature/help_menu ([#9587](https://github.com/orhun/git-cliff/issues/9587))

Co-authored-by: ThatOneCalculator <kainoa@t1c.dev>
Reviewed-on: https://codeberg.org/calckey/calckey/pulls/9587


### Miscellaneous Tasks

- Chore: up vite

- Chore: update credits


## [13.1.2] - 2023-02-06

### Bug Fixes

- Fix: :bug: federate fedibird quote properly

https://codeberg.org/calckey/calckey/pulls/9399#issuecomment-758047

- Fixes & tweaks

- Fix: background color in classic view

- Fix: comply with nodeinfo 2.1

- Fix: nodeinfo links without inflamatory comments.
Sorry for everyone who I have hurt with this, I had a really bad day, I promise this will
be the last time something like this happened. Please read my public statement.

- Fix: 🐛 Poll choice length 256

Co-authored-by: Syuilo <Syuilotan@yahoo.co.jp>
Closes #9433

- Fix: :bug: better update detection logic

- Fix: header actions tooltips in timeline

- Fix: drive/files/create.ts endpoint

- Fix build

- Fix: chat realtime update

- Fix: heart reactions

- Fix: tooltip lingering

- Fix: render MkToast with Mfm

- Fix: return only first emoji but fully

- Fix: add purple to hannuka

- Fix: deliver queue

- Fix user list widget

- Fix dup

- Fix: avatars in grid, not seperate grids

- Fix: make perm selector look nicer

- Fix: Chats did nt update in realtime

- Fix: disable reloads on timeline

- Fix: heart reaction

- Fix: :bug: double name on splash

Closes #9500

- Fix: :bug: signin with ipv6

co-authored-by: Syuilo

- Fix(client): use proxied image for instance icon

- Fix: actually add swc to sw package

- Fix: :zap: use proxied image for instance icon on ticker

Closes #9426

- Fix style

- Fix: show mfm cheat sheet as popup instead of new window

- Fix

- Fix wrong locale

- Fix: update dialog

- Fix

- Fix: margin on tab button

- Fix lock

- Fix: Use ❤️ instead of ♥️

- Fix: :bug: following issues

Closes #9544

- Fix: :lock: improve tag search security

- Fix: reactions using unicode weren't processed


### Documentation

- Docs: YunoHost

- Docs: 📝 easy installers

- Docs: 📝 easy installer images

- Docs: 📝 aur

- Docs: 📝 aur badge

- Docs: 🌋 Lavaforge

- Docs: no tensorflow

- Docs: :memo: clone depth 1

closes #9501


### Features

- Add -webkit-mask to line

- Feat: introduce devBuild

- Add back note-context wrapper

- Add back pfp in compose box when replying

- Feat: PWA icons

- Feat: :sparkles: dialog to remove follower

co-authored-by: atsu1125 <atsu1125@github>


### Miscellaneous Tasks

- Chore: remove links to misskey-hub

- Update pug description

- Chore: translated comments in MkPagination

- Chore: :fire: remove vue version from environment

why was this ever needed

- Chore: change code commit of pictogram to emoji

- Chore: rome linting

- Chore: add various keywords

- Chore: update patrons

- Chore: lavaforge links

- Chore: update patrons

- Chore: update patrons

- Update brnach

- Chore: reformat MkPagination

- Chore: reformat messaging/index.vue

- Chore: :wrench: remove eslint from service worker, up pnpm

- Chore: release notes

- Chore: up pnpm

- Chore: update german translations

- Update changelog

- Chore: formatting


### Performance

- Perf: :construction_worker: build backend with swc

Co-authored-by: pikokr <@paring@pikokr.dev>


### Refactor

- Refactor: :wrench: vite config

Co-authored-by: Syuilo <Syuilotan@yahoo.co.jp>

- Refactor: merge CI configs

- Refactor: :hammer: Use pnpm instead of yarn ([#9461](https://github.com/orhun/git-cliff/issues/9461))

Reasons:

1. `pnpm` is now an industry standard, being faster and less buggy than `yarn`.
2. Faster build time as builds are concurrent: 63 seconds down to 35 seconds!!
3. Resolves #9412

Co-authored-by: ThatOneCalculator <kainoa@t1c.dev>
Reviewed-on: https://codeberg.org/calckey/calckey/pulls/9461

- Refactor: :art: rome

- Refactor constants
Also added more standard media formats

- 🎨 Improve structure / format of MkPagination.vue

- Refactor: online indicator


### Styling

- Style: outline instance name in ticker

- Style: border radius on instance ticker icon

- Style: :lipstick: ticker improvements

premature partial from #9415


## [13.0.6-rc] - 2023-01-04

### Bug Fixes

- Prevent notifications if the notification contains a note that is muted

- Fix padding on normal display

- Fix: Cliff design

- Fix: user view z-fighting

- Fix: overlapping user follow button in mobile view

- Fixes

- Fix

- Fix

- Fix

- Fixes

- Fix bot tag

- Fix????

- Fix mobile button

- Fix

- Fix

- Fix?

- Fix

- Fix shadows

- Fix?

- Fix

- Fix: Header of cliff.toml changed to automatically link to calckey.md


### Documentation

- Docker immutable install

- Docs: node 19

- Docs: ck

- Docs: changelog

- Docs: shrink changelogs


### Features

- Add checks to resolver and performOneActivity

- Add .js to the end of two type-scripts, fixing a critical error that crashes calckey

- Add antenna mark read functionality

- Add antenna mark read functionalityu

- Add .js to the end of two type-scripts, fixing a critical error that crashes calckey ([#9347](https://github.com/orhun/git-cliff/issues/9347))

- ✨ automatic changelog generation using git cliffy


### Miscellaneous Tasks

- Update yarn

- Chore: bump version number

- Chore: upgrade packages

- Chore: up pkgs

- Chore: deprecate `deckDivider`


## [13.0.5] - 2022-12-18

### Bug Fixes

- Fix typo

- Fix-docker-env-path ([#9241](https://github.com/orhun/git-cliff/issues/9241))

- Fix: use correct color for MkMoved

- Fixed additional path to .config

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴

- Fix: 🥴


### Documentation

- Docs: 📝 more badges

- Docs: 📝 badges [CI Skip]

- Docs: 📝 weblate

- Docs: 📝 more images

- Docs: 📝 fix spacing

- Docker-compose-port-fix ([#9251](https://github.com/orhun/git-cliff/issues/9251))

- Docs: 🥴


### Features

- Feat: weblate!

- Feat: 🥴

- Feat: :package: upgrade to vite 4


### Miscellaneous Tasks

- Update example.yml with container names specified in docker-compose, to support running either a dev or production containers off the same configs

- Chore: lint

- Chore: dockerfile cleanup

- Chore: Update patron list

- Chore: remove unicode fault in KO

- Chore: update gitignore

- Chore: fix rebuild


### Refactor

- Refactor: :busts_in_silhouette: update cleo link

- Refactor: new repo link


### Testing

- Test: 🥴


## [13.0.4] - 2022-12-16

## [13.0.3] - 2022-12-16

### Bug Fixes

- Fix: 🐛 fix inconsistent theming

- Fix: css class match

- Fix: insert into correct textarea


### Documentation

- Docs: :memo: fix badge position


### Features

- Feat: Insert text at cursor for caption


### Refactor

- Refactor: rm .github folder


## [13.0.0] - 2022-12-16

## [13-rc1] - 2022-12-16

### Bug Fixes

- Fix

- Fix: :bug: wrong placement

- Fix?

- Fix broken order

- Fix: :alembic: messaging pagination

- Fix?

- Fix: :lipstick: calc style

- Fix

- Fix

- Fix???

- Fix

- Fix?????

- Fix: REALLY make sure there's no text decoration

- Fix groups button display

- Fix

- Fixxxxx

- Fix

- Fix

- Fix scroll anim bug?

- Fix

- Fix

- Fix imports

- Fix style

- Fix pinned users

- Fix pinned users list

- Fix: 🐛 no double import

- Fix: workaround for sticky image container header

- Fix i18n

- Fix pages index

- Fix pages swiping

- Fix?

- Fix chat message

- Fix pages margin

- Fix user profile

- Fix fill out profile step of tutorial

- Fix: :bug: fix image size in dms

- Fix: actually set in-dm to be true if in dm

- Fix serviceworker

- Fix

- Fix: don't show rtl if disabled, regardless of perms

- Fix

- Fix

- Fix locale

- Fix

- Fix defaults

- Fix patrons

- Fixes

- Fix gulpfile

- Fix again

- Fix out link

- Fix: don't do icon transform by default

- Fix #9140

- Fix cursor in note thread

- Fix problems from #9146

- Fix

- Fix

- Fix

- Fix

- Fix

- Fix cleo's oopsie

- Fix imports

- Fix import once and for all

- Fix migration

- Fix

- Fixes

- Fix

- Fix

- Fix

- Fix ap person to db model

fixed entries of movedToUri and added entries of alsoKnownAs

- Fixed it for good

- Fix more icons

- Fix remote move queue

- Fix queue?

- Fixed stupidness again

- Fix ??

- Fix import

- Fix path

- Fix liked pages

- Fix liked pages endpoint

- Fix??

- Fix remote move queue

- Fix queue?

maybe pls

debug log

fixed stupidness again

fix ??

fix import

im a idiot lol

make remote mig work

- Fix path

- Fix unicode weirdness

- Fix: call functions properly

- Fix viewing basic federaion info

- Fix: migration labels

- Fix: label

- Fix ckjs

- Fix calckeyjs

- Fix calckey-js | fix migration url

- Fix locale

- Fix alsoKnownAs federation

- Fix redis in ci

- Fix federation of moved to to pleroma
because it expects it to be non-existant if its null.

- Fix docker ci


### Documentation

- Docs: :memo: deps

- Docs: :memo: typo

- Docs: :memo: latest 18

- Docs: 📝 pm2

- Docs: more accessible links

- Docs: move intro to wip

- Docs: :memo: intro tutorial

- Docs: 📝 tips & tricks

- Docs: fix typo

- Docs: tips

- Docs: :memo: improve documentation, nginx

- Docs: :memo: tip

- Docs: :memo: open port tip

- Docs: 📝 alt text for calc

- Docs: 📝 typo

It's "available". Thank you luke :P

- Docs: 📝 typo

- Docs: 📝 official account

- Docs: another tip

- Docs: 📝 improve install instructions

- Docs: 📝 formatting

- Docs: 📝 optional deps

- Docs: custom locales

- Docs: a11y

- Docs: reflect last change in readme

- Docs: deps

- Docs: 📝 better links

- Docs: 📝 be more descriptive with new techs

- Docs: 📝 scylla will be optional

- Docs: 📝 better links

- Docs: 📝 be more descriptive with new techs

- Docs: 📝 scylla will be optional

- Docs: 📝 account migration


### Features

- Feat: :art: move reaction button

- Feat: :sparkles: Star button

- Feat: :art: add ripple to star react

- Feat: :art: add ripple to star react

- Feat: :sparkles: Toggle showing calckey updates as admin

- Feat: ✨ add `os.yesno` for yes/no questions

- Feat: :lipstick: add right margin to title text

- Feat: :sparkles: Allow importing follows from Pixelfed

- Feat: ✨ Append caption to textarea

- Feat: :sparkles: Managed hosting complete

- Feat: :lipstick: Phosphor icons!

- Feat: :lipstick: Phosphor icons!

- Add effects, japanese translation

- Feat: ✨ Page drafts

- Feat: Docker update script ([#9159](https://github.com/orhun/git-cliff/issues/9159))

- Feat: Docker update script ([#9159](https://github.com/orhun/git-cliff/issues/9159))

- Feat: :sparkles: Add delete all lists

- Add ui back

- Add local move follower migration

- Feat: customizable max note length

- Add check for already moved


### Miscellaneous Tasks

- Chore: :package: Update packages

- Update example

- Update deps

- Chore: :package: package upgrades

- Chore: :arrow_up: update deps

- Chore: :arrow_up: upgrade packages

- Chore: :arrow_up: yarn 3.3.0

- Update person model


### Performance

- Perf: :zap: load icons css last

- Perf: :zap: load icons css last


### Refactor

- Refactor readme

- Refactor: :alembic: try `active-class`

- Refactor: :recycle: Replace all `$ts` with i18n

- Refactor


### Styling

- Style

- Style


### Testing

- Test

- Test

- Test

- Test new chat layout

- Test

- Test

- Test

- Test

- Test explore page fix

- Test

- Test api docs


## [12.119.0-calc.3] - 2022-10-26

### Bug Fixes

- Fix streaming

- Fix gulpfile

- Fix caption in admin settings

- Fix: :fire: Remove meta implementation in routing for now

- Fix: recommended timeline

I doubt itll work, but...

🙏

hail mairy

certified typeorm moment

im stuff

debug log

not a fan of js/ts

istg

missing parenthesis

postgres can kiss my ass

didnt need `::string[]` i think

hide caption button

Remove debug log

Clean up

no longer beta!

fix streaming

- Fix: caption in admin settings

Move splash below theme

Splash below theme

- Fix: :alembic: Attempt to fix routing

- Fix: :pencil2: Async typo

- Fix: :pencil2: Same typo as before...

- Fix: :lock: Remove timeline source if not logged in and guest tl isn't enabled

- Fix: :bug: No computed on declared var

- Fix: :bug: Allow timeline if logged in, loll

- Fix: :bug: timeline secured

- Fix: :bug: Remove header tabs if guest not enabled and not logged in

- Fix: :package: Fix yarn.lock

- Fix: :alembic: Try swiped-events

- Fix: :package: fix import

- Fix: :iphone: Fix for mobile

- Fix: :ambulance: No with dialog on load

- Fix: :bug: more mobile stuff

- Fix: :bug: fix avatar not showing up

- Fix: :alembic:

- Fix: :art: mount plyr with app

- Fix: :zap: Better import for plyr

- Fix: :lipstick: style

- Fix: :lipstick: style

- Fix: :bug: fix clicking on note content

- Fix: :alembic:

- Fix: :bug: do it right

- Fix: :bug: need MkA

- Fix: :bug: use router

- Fix: :bug: Prevent clicking on child elements of timeline posts

- Fix: :children_crossing: No more stupid details for replies

- Fix: :lock: Up multer to LTS as to avoid CVE-2022-24434

- Fix: :ambulance: Fix vue-plyr import

- Fix again

- Fix: :lipstick: fix buttons on entrance screen being squished on mobile

- Fix: :bug: only show on mobile, fix animation

- Fix: :bug: fix scroll

- Fix: :bug: fix again

- Fix: :bug: scroll

- Fix: :bug: fix videos having `<a>`

- Fix: :lipstick: only show post button on home tl

- Fix: :bug: ref

- Fix swipes?

- Fix: :bug: swipe left goes back a page

- Fix: :bug: swipe left on home wraps back

- Fix: :lipstick: consistent cw bg hover

- Fix: :bug: swipe bug

- Fix: :bug: fix scrolling bugs

- Fix

- Fix????

- Fix

- Fix: :zap: prerender prev and after slide

- Fix: :bug: show swiper

- Fix lints in folder.vue

- Fix pagination.vue lints

- Fix: volume sliders

Fixed a typo that made a required property be undefined.

- Fix screenshot size

- Fix: :lipstick: no blur on emoji picker --> blur safe by default

- Fix(client): fix syntax error of pages/follow.vue

- Fix: :ambulance: fix ref

- Fix: :bug: sync fixed

- Fix(server): 他人の通知を既読にできる可能性があるのを修正

- Fix

- Fix: :bug: Don't show tab title on mobile

- Fix: :bug: sync tab when getting last timeline

- Fix sync

- Fix: :rewind:

- Fix: :bug: fix header button positions on mobile

- Fix: :bug: Fix slide sync on initial timeline load

- Fix: :bug: Promper Info import

- Fix: :ambulance: tl not showing up

- Fix

- Fix: :bug: gay gay homosexual gay

- Fix: :bug: Show title on mobile if there's no tab buttons

- Fix: :bug: add script to pages view

- Fix

- Fix??

- Fix???

- Fix

- Fix motd

- Fix: :bug: motd

- Fix: :bug: No swiper on desktop

- Fix dup import

- Fix dup import

- Fix channels

- Fix clicking cw button on reply

- Fix: Profile bg blur respects user blur choice

- Fix

- Fix link

- Fix

- Fix

- Fix

- Fix


### Documentation

- Docs: :memo: Remove duplicate line

- Docs: :memo: npm -> yarn

- Docs: :memo: Add links

- Docs: :memo: Notable differences

- Docs: :memo: Customize instructions

- Docs: :memo: checksum behavior note

- Docs: :memo: emojis!

- Docs: :memo: planning join reasons

- Docs: :memo: warning for node 18.6.0

- Docs: :memo: Add swipe to WIP

- Docs: :memo:

- Docs: :memo: cl

- Docs: :memo: cl

- Docs: :memo: cl

- Docs: :memo: Mention groups

- Docs: 📝 cl

- Docs: 📝 Move add groups back to Implemented

- Docs: 📝 Docker instructions 🐋

- Docker-compose: replace misskey with calckey to fix example

- Docs :memo: 🐳


### Features

- Feat: ✨ custom css/assets

typo

fix gulpfile

- Feat: ✨ togglable guest timeline

default false

rc 9

no async

welcome explore button to `/explore`

fix: :fire: Remove meta implementation in routing for now

- Feat: :bookmark: 12.118.1-calc release!

- Feat: show header with current user avatar on TL ([#9051](https://github.com/orhun/git-cliff/issues/9051))

* feat: show header with current user avatar on TL

* refactor(client): use displayMyAvatar prop instead of metadata

* refactor(client): prefer v-if to `display: none;`
- Feat: :bookmark: .1

- Feat: :sparkles: foundkey: add recollapsing quote notes

- Feat: :sparkles: Swipe through timelines on mobile

- Feat: :alembic: ripple effect

- Feat: :bookmark: .7

- Feat: :sparkles: Make mobile account avatar clickable

- Feat: :alembic: vue-plyr

- Feat: :bookmark: .5

- Feat: :lipstick: New note style

- Feat: :bookmark: .7

- Feat: :sparkles: Replies can be clicked too

- Feat: :lipstick: highlight hover replies

- Feat: :sparkles: More hover events!\

- Feat: :alembic: New post button on mobile

- Feat: :sparkles: Fade

- Feat: :sparkles: swipe thru notifs

- Feat: :alembic: try swiper

- Feat: :sparkles: pagination

- Feat: 💄 style swiper

- Feat: :package: use swc

- Feat: :alembic: vsides

- Feat: ✨ improve pwa manifest

- Feat: :sparkles: Better tabs for mobile

- Feat: :sparkles: Swiper in notifs

- Feat: :alembic: Swiping in featured

- Feat: start work on vue-isyourpasswordsafe integration

- Feat: :sparkles: Attempt to add groups back!

- Feat: show 📎 in chats if only attachment

- Feat: :bookmark: v12.119.0

- Feat: ✨ Warning in control panel if there's update

- Feat: :sparkles: Add setting for swipe behavior

- Add console log


### Miscellaneous Tasks

- Chore: :loud_sound: Test logging

- Chore: :alembic: More debugging

- Chore: :bookmark: Bump to .3

- Update deps

- Chore: :package: Use proper misskey browser image resizer package

- Chore: :package: Add vue3-lottie

- Chore: :coffin: works

- Chore: :fire: remove fader

- Chore: 💄 button height 3.5rem

- Chore: :loud_sound: log x swipe

- Chore(client): tweak loading display

- Update deps

- Chore: :arrow_up: Upgrade TypeORM

- Chore: :twisted_rightwards_arrows: Merge upstream

- Chore: :arrow_up: Upgrade Vite

- Chore: :arrow_up: Upgrade several deps

From yarn upgrade-interactive

- Chore: :bookmark: .16

- Chore: :twisted_rightwards_arrows: Merge upstream

- Chore(client): :art:

- Update deps

- Chore(sw): only proxies HTML requests ([#9070](https://github.com/orhun/git-cliff/issues/9070))

* chore(sw): only proxies HTML requests

もはやHTMLじゃなさそうなリクエストにはSWで関与しないようにする

こうするといろいろな面倒事が解決するはず…たぶん

Resolve #9037
Resolve #9038

* align code style

* Update packages/sw/src/sw.ts

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
Co-authored-by: tamaina <tamaina@hotmail.co.jp>
Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
- Chore: :twisted_rightwards_arrows: Merge upstream to 12.119.0

- Chore: :twisted_rightwards_arrows: Merge upstream

- Chore: :package: Update lockfile

- Chore: :recycle: `about-misskey` -> `about-calckey`

- Chore: :loud_sound:

- Chore: spacing between icons in gallery index

- Chore: rm unused import

- Chore: :fire: rm tabs

- Chore: quote-button --> MkQuoteButton


### Refactor

- Enhance: add re-collapsing to quoted notes

- Refactor: :package: fuck them libs

- Refactor: :package: Use updated fork of vue-plyr

- Enhance(client): mobile twitter url can be used as widget ([#9057](https://github.com/orhun/git-cliff/issues/9057))


- Enhance(client): add html color-schema support

- Enhance(client): tweak clock

- Refactor(client): align filename to component name

- Enhance(client): improve analog-clock

- Refactor(client): use setup syntax

- Refactor(client): use setup syntax

- Refactor(client): use setup syntax

- Refactor(client): use setup syntax

- Refactor(client): use setup syntax

- Refactor(client): use setup syntax

- Refactor: :sparkles: Swiper, no swiping! :fox:

Swiper everywhere, attempt to sync to header bar

- Refactor(client): use setup syntax

- Refactor(client): use setup syntax

- Refactor(client): refactor file name and directory structure

- Refactor: :recycle: Use setup syntax for groups index

- Refactor: :sparkles: Move group actions to header bar


### Testing

- Test

- Test

- Testing

- Test

- Testtt


## [12.118.1-calc.rc.5.1] - 2022-08-09

### Bug Fixes

- Fix

- Fix again

- Fix fr on god no cap

- Fix lints

- Fix migration

- Fix againnn

- Fix duplicate keys

- Fix!!!!

- Fix: use new for throw error

Co-Authored-By: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

- Fix spelling error

- Fix textarea not updating properly

fixes https://akkoma.dev/FoundKeyGang/FoundKey/issues/54

- Fix(client): cannot show some setting pages

Fix #9043

- Fix: copy visibility for renotes

- Fixxx


### Documentation

- Docs


### Features

- Feature: Client Preferences Registry ([#8511](https://github.com/orhun/git-cliff/issues/8511))

* Fix settings page

* nanka iroiro

* clean up

* clean up

* feature: Client Preferences Registry on the account

* add changelog

* インデックスに戻ってもタイトルが残ってしまうのを修正

* fix createdAt -> updatedAt

* remove console.log

* 適用→このデバイスに適用

* add wallpaper

* ローカルのjsonファイルを保存・読み込みできるように

* clean up

* use apiWithDialog

* Update packages/client/src/pages/settings/preferences-registry.vue

Co-authored-by: Andreas Nedbal <github-bf215181b5140522137b3d4f6b73544a@desu.email>

* Update packages/client/src/pages/settings/preferences-registry.vue

Co-authored-by: Andreas Nedbal <github-bf215181b5140522137b3d4f6b73544a@desu.email>

* Update packages/client/src/pages/settings/preferences-registry.vue

Co-authored-by: Andreas Nedbal <github-bf215181b5140522137b3d4f6b73544a@desu.email>

* fix lint

* :v:

* change router

* nanka iroiro

* tweak

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
Co-authored-by: Andreas Nedbal <github-bf215181b5140522137b3d4f6b73544a@desu.email>
- Feat(client): improve widget

- Add bullboard

- Add tes as dep, even if unused


### Miscellaneous Tasks

- Update deps

- Update preferences backup for calckey

- Chore(client): tweak scroll behavior in routing


### Performance

- Perf(client): use shallowRef as possible


### Refactor

- 🎨

- 🎨

- 🎨

- 🎨

- Refactor: welcome.setup.vue to composition api

- Enhance(client): improve clock widgets

- Enhance(client): improve clock widget

- Enhance(client): improve clock widget

- Enhance(client): improve clock widget

- Refactor


### Testing

- Test

- Test

- Test :(

- Testtt

- Testtt

- Test


## [12.118.0-calc.3.b4] - 2022-07-26

## [12.118.0-calc.b4] - 2022-07-26

### Bug Fixes

- Fix

- Fix search

- Fix(client): タイミングによっては tag-cloud でエラーが発生するのを修正

- Fix(client): support v-if of select component

- Fix(client): fix some routings

- Fix(client): some fixes

- Fix: not logged in clients send correct header

- Fix(client): fix drawer menu style regression

- Fix(client): MiAuth page is broken

Fix #9026

- Fix: broken chats ([#8983](https://github.com/orhun/git-cliff/issues/8983))

* Fix broken chats

Co-authored-by: @ltlapy

* :art:
- Fix

- Fix style

- Fix

- Fixxxx

- Fix note button

- Fix html

- Fix import

- Fix

- Fix


### Features

- Add missing dependency


### Miscellaneous Tasks

- Chore(client): tweak radio component

- Chore(deps): bump terser from 5.9.0 to 5.14.2 ([#9024](https://github.com/orhun/git-cliff/issues/9024))

Bumps [terser](https://github.com/terser/terser) from 5.9.0 to 5.14.2.
- [Release notes](https://github.com/terser/terser/releases)
- [Changelog](https://github.com/terser/terser/blob/master/CHANGELOG.md)
- [Commits](https://github.com/terser/terser/commits)

---
updated-dependencies:
- dependency-name: terser
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(client): tweak theme select ui

- Chore: improve error message of boot

- Update tfjs

- Chore(deps): bump file-type from 17.1.2 to 17.1.3 in /packages/backend ([#9030](https://github.com/orhun/git-cliff/issues/9030))

Bumps [file-type](https://github.com/sindresorhus/file-type) from 17.1.2 to 17.1.3.
- [Release notes](https://github.com/sindresorhus/file-type/releases)
- [Commits](https://github.com/sindresorhus/file-type/compare/v17.1.2...v17.1.3)

---
updated-dependencies:
- dependency-name: file-type
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump undici from 5.5.1 to 5.8.0 in /packages/backend ([#9028](https://github.com/orhun/git-cliff/issues/9028))

Bumps [undici](https://github.com/nodejs/undici) from 5.5.1 to 5.8.0.
- [Release notes](https://github.com/nodejs/undici/releases)
- [Commits](https://github.com/nodejs/undici/compare/v5.5.1...v5.8.0)

---
updated-dependencies:
- dependency-name: undici
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(client): tweak style

- Chore(client): tweak ui

- Update deps

- Chore(client): tweak style


### Refactor

- Enhance(client): ネストしたルーティングに対応

- Refactor(client): :sparkles:

- Enhance(client): add some themes

- 🎨

- 🎨

- Refactor(client): refactor components

- Refactor pages/auth.form.vue to composition API

- Refactor: colours in queue chart

- Refactor queue chart to composition API

- Refactor pages/auth.form.vue to composition API


## [12.117.1.1-calc] - 2022-07-19

## [12.117.1-calc] - 2022-07-19

### Bug Fixes

- Fix(package): update swagger-jsdoc to version 1.9.0

https://greenkeeper.io/

- Fix(package): update @types/elasticsearch to version 5.0.11

https://greenkeeper.io/

- Fix(package): update @types/elasticsearch to version 5.0.12

https://greenkeeper.io/

- Fix(package): update body-parser to version 1.16.0

https://greenkeeper.io/

- Fix(package): update @types/express to version 4.0.35

https://greenkeeper.io/

- Fix(package): update file-type to version 4.1.0

https://greenkeeper.io/

- Fix(package): update whatwg-fetch to version 2.0.2

https://greenkeeper.io/

- Fix(package): update babel-preset-es2015 to version 6.22.0

https://greenkeeper.io/

- Fix(package): update babel-core to version 6.22.1

https://greenkeeper.io/

- Fix(package): update gulp-uglify to version 2.0.1

https://greenkeeper.io/

- Fix(package): update pug to version 2.0.0-beta8

https://greenkeeper.io/

- Fix(package): update browserify to version 14.0.0

https://greenkeeper.io/

- Fix(package): update multer to version 1.3.0

https://greenkeeper.io/

- Fix(package): update tslint to version 4.4.0

https://greenkeeper.io/

- Fix(package): update pug to version 2.0.0-beta9

https://greenkeeper.io/

- Fix(package): update tslint to version 4.4.2

https://greenkeeper.io/

- Fix(package): update express to version 4.14.1

https://greenkeeper.io/

- Fix(package): update riot to version 3.1.0

https://greenkeeper.io/

- Fix(package): update summaly to version 1.4.0

https://greenkeeper.io/

- Fix(package): update summaly to version 1.4.1

https://greenkeeper.io/

- Fix(package): update monk to version 3.1.4

https://greenkeeper.io/

- Fix(package): update velocity-animate to version 1.4.2

https://greenkeeper.io/

- Fix(package): update summaly to version 1.5.0

https://greenkeeper.io/

- Fix(package): update @types/multer to version 0.0.33

https://greenkeeper.io/

- Fix(package): update gulp-tslint to version 7.1.0

https://greenkeeper.io/

- Fix(package): update @types/mongodb to version 2.1.38

https://greenkeeper.io/

- Fix(package): update @types/mocha to version 2.2.39

https://greenkeeper.io/

- Fix(package): update @types/redis to version 0.12.35

https://greenkeeper.io/

- Fix(package): update riot-compiler to version 3.1.3

https://greenkeeper.io/

- Fix(package): update riot-compiler to version 3.1.4

https://greenkeeper.io/

- Fix(package): update riot to version 3.1.1

https://greenkeeper.io/

- Fix(package): update morgan to version 1.8.0

https://greenkeeper.io/

- Fix(package): update summaly to version 1.6.0

https://greenkeeper.io/

- Fix(package): update summaly to version 1.6.1

https://greenkeeper.io/

- Fix(package): update riot to version 3.2.0

https://greenkeeper.io/

- Fix(package): update js-yaml to version 3.8.0

https://greenkeeper.io/

- Fix(package): update bcryptjs to version 2.4.1

https://greenkeeper.io/

- Fix(package): update bcryptjs to version 2.4.2

https://greenkeeper.io/

- Fix(package): update bcryptjs to version 2.4.3

https://greenkeeper.io/

- Fix(package): update @types/chai-http to version 0.0.30

https://greenkeeper.io/

- Fix(package): update summaly to version 2.0.0

https://greenkeeper.io/

- Fix(package): update chart.js to version 2.5.0

https://greenkeeper.io/

- Fix(package): update typescript to version 2.1.6

https://greenkeeper.io/

- Fix(package): update @types/mongodb to version 2.1.39

https://greenkeeper.io/

- Fix(package): update riot to version 3.2.1

https://greenkeeper.io/

- Fix(package): update debug to version 2.6.1

https://greenkeeper.io/

- Fix(package): update @types/mongodb to version 2.1.40

https://greenkeeper.io/

- Fix(package): update body-parser to version 1.16.1

https://greenkeeper.io/

- Fix(package): update morgan to version 1.8.1

https://greenkeeper.io/

- Fix(package): update ratelimiter to version 2.2.0

https://greenkeeper.io/

- Fix(package): update monk to version 4.0.0

https://greenkeeper.io/

- Fix(package): update babel-core to version 6.23.1

https://greenkeeper.io/

- Fix(package): update browserify to version 14.1.0

https://greenkeeper.io/

- Fix(package): update mongodb to version 2.2.24

https://greenkeeper.io/

- Fix(package): update @types/request to version 0.0.40

https://greenkeeper.io/

- Fix(package): update gulp-typescript to version 3.1.5

https://greenkeeper.io/

- Fix(package): update @types/chai to version 3.4.35

https://greenkeeper.io/

- Fix(package): update @types/websocket to version 0.0.33

https://greenkeeper.io/

- Fix(package): update @types/body-parser to version 0.0.34

https://greenkeeper.io/

- Fix(package): update @types/redis to version 0.12.36

https://greenkeeper.io/

- Fix(package): update riot-compiler to version 3.2.0

https://greenkeeper.io/

- Fix(package): update riot to version 3.3.0

https://greenkeeper.io/

- Fix(package): update rimraf to version 2.6.0

https://greenkeeper.io/

- Fix(package): update riot-compiler to version 3.2.1

https://greenkeeper.io/

- Fix(package): update riot to version 3.3.1

https://greenkeeper.io/

- Fix(package): update serve-favicon to version 2.4.0

https://greenkeeper.io/

- Fix(package): update velocity-animate to version 1.4.3

https://greenkeeper.io/

- Fix(package): update swagger-jsdoc to version 1.9.2

https://greenkeeper.io/

- Fix(package): update inquirer to version 3.0.2

https://greenkeeper.io/

- Fix(package): update typescript to version 2.2.1

https://greenkeeper.io/

- Fix(package): update inquirer to version 3.0.3

https://greenkeeper.io/

- Fix(package): update inquirer to version 3.0.4

https://greenkeeper.io/

- Fix(package): update @types/mongodb to version 2.1.41

https://greenkeeper.io/

- Fix(package): update @types/webpack to version 2.2.7

https://greenkeeper.io/

- Fix(package): update rimraf to version 2.6.1

https://greenkeeper.io/

- Fix(package): update css-loader to version 0.26.2

https://greenkeeper.io/

- Fix(package): update cropperjs to version 1.0.0-beta.2

https://greenkeeper.io/

- Fix(package): update ratelimiter to version 3.0.2

https://greenkeeper.io/

- Fix(package): update inquirer to version 3.0.5

https://greenkeeper.io/

- Fix(package): update serve-favicon to version 2.4.1

https://greenkeeper.io/

- Fix(package): update tslint to version 4.5.1

https://greenkeeper.io/

- Fix

- Fix(package): update body-parser to version 1.17.0

https://greenkeeper.io/

- Fix

- Fix(package): update js-yaml to version 3.8.2

https://greenkeeper.io/

- Fix(package): update whatwg-fetch to version 2.0.3

https://greenkeeper.io/

- Fix(package): update inquirer to version 3.0.6

https://greenkeeper.io/

- Fix(package): update request to version 2.80.0

https://greenkeeper.io/

- Fix

- Fix(package): update cafy to version 1.0.1

https://greenkeeper.io/

- Fix(package): update riot to version 3.3.2

https://greenkeeper.io/

- Fix(package): update cafy to version 1.2.0

https://greenkeeper.io/

- Fix(package): update body-parser to version 1.17.1

https://greenkeeper.io/

- Fix(package): update @types/request to version 0.0.41

https://greenkeeper.io/

- Fix(package): update @types/webpack to version 2.2.8

https://greenkeeper.io/

- Fix(package): update string-replace-webpack-plugin to version 0.1.2

https://greenkeeper.io/

- Fix(package): update gulp-mocha to version 4.1.0

https://greenkeeper.io/

- Fix(package): update stylus-loader to version 2.5.1

https://greenkeeper.io/

- Fix(package): update @types/elasticsearch to version 5.0.13

https://greenkeeper.io/

- Fix(package): update @types/gm to version 1.17.30

https://greenkeeper.io/

- Fix(package): update css-loader to version 0.26.4

https://greenkeeper.io/

- Fix(package): update @types/gulp to version 4.0.0

https://greenkeeper.io/

- Fix(package): update ms to version 0.7.3

https://greenkeeper.io/

- Fix(package): update gulp-pug to version 3.3.0

https://greenkeeper.io/

- Fix(package): update @types/body-parser to version 1.16.0

https://greenkeeper.io/

- Fix(package): update @types/webpack to version 2.2.10

https://greenkeeper.io/

- Fix(package): update gulp-uglify to version 2.1.0

https://greenkeeper.io/

- Fix(package): update request to version 2.81.0

https://greenkeeper.io/

- Fix
- Fix(package): update css-loader to version 0.27.0

https://greenkeeper.io/

- Fix(package): update @types/webpack to version 2.2.11

https://greenkeeper.io/

- Fix(package): update css-loader to version 0.27.1

https://greenkeeper.io/

- Fix(package): update debug to version 2.6.2

https://greenkeeper.io/

- Fix(package): update @types/cors to version 2.8.1

https://greenkeeper.io/

- Fix(package): update @types/mocha to version 2.2.40

https://greenkeeper.io/

- Fix(package): update redis to version 2.7.0

https://greenkeeper.io/

- Fix(package): update css-loader to version 0.27.2

https://greenkeeper.io/

- Fix
- Fix(package): update css-loader to version 0.27.3

https://greenkeeper.io/

- Fix(package): update debug to version 2.6.3

https://greenkeeper.io/

- Fix(package): update redis to version 2.7.1

https://greenkeeper.io/

- Fix(package): update @types/gulp to version 4.0.1

https://greenkeeper.io/

- Fix(package): update @types/riot to version 2.6.2

https://greenkeeper.io/

- Fix(package): update @types/event-stream to version 3.3.31

https://greenkeeper.io/

- Fix(package): update @types/gulp to version 4.0.2

https://greenkeeper.io/

- Fix(package): update @types/gulp-mocha to version 0.0.30

https://greenkeeper.io/

- Fix(package): update @types/gulp-rename to version 0.0.32

https://greenkeeper.io/

- Fix(package): update @types/gulp-tslint to version 3.6.31

https://greenkeeper.io/

- Fix(package): update @types/gulp-uglify to version 0.0.30

https://greenkeeper.io/

- Fix(package): update @types/gulp-typescript to version 0.0.33

https://greenkeeper.io/

- Fix(package): update @types/gulp-util to version 3.0.31

https://greenkeeper.io/

- Fix(package): update gulp-typescript to version 3.1.6

https://greenkeeper.io/

- Fix(package): update mongodb to version 2.2.25

https://greenkeeper.io/

- Fix(package): update ms to version 1.0.0

https://greenkeeper.io/

- Fix(package): update gulp-uglify to version 2.1.1

https://greenkeeper.io/

- Fix(package): update gulp-uglify to version 2.1.2

https://greenkeeper.io/

- Fix(package): update ts-node to version 2.1.1

https://greenkeeper.io/

- Fix(package): update @types/body-parser to version 1.16.1

https://greenkeeper.io/

- Fix(package): update ts-node to version 3.0.1

https://greenkeeper.io/

- Fix(package): update @types/webpack to version 2.2.12

https://greenkeeper.io/

- Fix(package): update webpack to version 2.3.0

https://greenkeeper.io/

- Fix(package): update webpack to version 2.3.1

https://greenkeeper.io/

- Fix(package): update @types/request to version 0.0.42

https://greenkeeper.io/

- Fix(package): update mime-types to version 2.1.15

https://greenkeeper.io/

- Fix(package): update webpack to version 2.3.2

https://greenkeeper.io/

- Fix(package): update serve-favicon to version 2.4.2

https://greenkeeper.io/

- Fix(package): update gulp-imagemin to version 3.2.0

https://greenkeeper.io/

- Fix(package): update cropperjs to version 1.0.0-rc

https://greenkeeper.io/

- Fix(package): update animejs to version 2.0.2

https://greenkeeper.io/

- Fix(package): update riot to version 3.4.0

https://greenkeeper.io/

- Fix(package): update typescript to version 2.2.2

https://greenkeeper.io/

- Fix(package): update cors to version 2.8.2

https://greenkeeper.io/

- Fix(package): update cors to version 2.8.3

https://greenkeeper.io/

- Fix(package): update ratelimiter to version 3.0.3

https://greenkeeper.io/

- Fix

- Fix(package): update elasticsearch to version 13.0.0-rc1

https://greenkeeper.io/

- Fix(package): update js-yaml to version 3.8.3

https://greenkeeper.io/

- Fix(package): update accesses to version 2.1.1

https://greenkeeper.io/

- Fix(package): update accesses to version 2.2.0

https://greenkeeper.io/

- Fix(package): update accesses to version 2.3.0

https://greenkeeper.io/

- Fix(package): update accesses to version 2.4.0

https://greenkeeper.io/

- Fix(package): update accesses to version 2.4.1

https://greenkeeper.io/

- Fix(package): update riot to version 3.4.1

https://greenkeeper.io/

- Fix(package): update accesses to version 2.5.0

Closes #405

https://greenkeeper.io/

- Fix(package): update riot to version 3.4.2

https://greenkeeper.io/

- Fix(package): update file-type to version 4.2.0

https://greenkeeper.io/

- Fix(package): update mongodb to version 2.2.26

https://greenkeeper.io/

- Fix(package): update debug to version 2.6.4

https://greenkeeper.io/

- Fix(package): update elasticsearch to version 13.0.0

https://greenkeeper.io/

- Fix(package): update riot to version 3.4.3

https://greenkeeper.io/

- Fix(package): update typescript to version 2.3.1

https://greenkeeper.io/

- Fix(package): update debug to version 2.6.5

https://greenkeeper.io/

- Fix(package): update debug to version 2.6.6

https://greenkeeper.io/

- Fix(package): update download to version 6.0.0

https://greenkeeper.io/

- Fix(package): update typescript to version 2.3.2

https://greenkeeper.io/

- Fix(package): update cropperjs to version 1.0.0-rc.1

https://greenkeeper.io/

- Fix(package): update riot to version 3.4.4

https://greenkeeper.io/

- Fix(package): update pug to version 2.0.0-rc.1

https://greenkeeper.io/

- Fix(package): update ts-node to version 3.0.3
- Fix(package): update summaly to version 2.0.2
- Fix(package): update ts-node to version 3.0.4
- Fix(package): update file-type to version 4.3.0
- Fix(package): update summaly to version 2.0.3
- Fix(package): update js-yaml to version 3.8.4
- Fix(package): update elasticsearch to version 13.0.1
- Fix(package): update download to version 6.1.0
- Fix(package): update riot to version 3.5.0
- Fix(package): update cafy to version 2.4.0
- Fix(package): update ms to version 2.0.0
- Fix(package): update serve-favicon to version 2.4.3
- Fix(package): update debug to version 2.6.7
- Fix(package): update body-parser to version 1.17.2
- Fix(package): update debug to version 2.6.8
- Fix(package): update reconnecting-websocket to version 3.0.5

Closes #473
- Fix(package): update monk to version 4.1.0
- Fix(package): update monk to version 5.0.1

Closes #477
- Fix(package): update riot to version 3.5.1
- Fix(package): update monk to version 5.0.2
- Fix(package): update mongodb to version 2.2.27
- Fix(package): update typescript to version 2.3.3
- Fix(package): update download to version 6.2.0
- Fix(package): update morgan to version 1.8.2
- Fix(package): update download to version 6.2.2
- Fix(package): update cropperjs to version 1.0.0-rc.2
- Fix(package): update typescript to version 2.3.4
- Fix(package): update pictograph to version 2.0.1
- Fix(package): update pictograph to version 2.0.4

Closes #513
- Fix(package): update mongodb to version 2.2.28
- Fix(package): update pug to version 2.0.0-rc.2
- Fix(package): update monk to version 6.0.0
- Fix(package): update file-type to version 5.0.0

Closes #532
- Fix(package): update ts-node to version 3.0.5
- Fix(package): update ts-node to version 3.0.6
- Fix(package): update inquirer to version 3.1.0
- Fix(package): update riot to version 3.6.0
- Fix(package): update file-type to version 5.1.0
- Fix(package): update file-type to version 5.1.1
- Fix(package): update elasticsearch to version 13.1.1
- Fix(package): update uuid to version 3.1.0
- Fix spell
- Fix(package): update inquirer to version 3.1.1
- Fix(package): update download to version 6.2.3
- Fix(package): update mongodb to version 2.2.29
- Fix(package): update elasticsearch to version 13.2.0

Closes #570
- Fix(package): update ts-node to version 3.1.0
- Fix(package): update monk to version 6.0.1
- Fix(package): update riot to version 3.6.1
- Fix(package): update typescript to version 2.4.1
- Fix(package): update download to version 6.2.4
- Fix(package): update download to version 6.2.5
- Fix(package): update chalk to version 2.0.1

Closes #594
- Fix(package): update reconnecting-websocket to version 3.0.6
- Fix(package): update reconnecting-websocket to version 3.0.7
- Fix(package): update ts-node to version 3.2.0
- Fix(package): update cropperjs to version 1.0.0-rc.3
- Fix(package): update mongodb to version 2.2.30
- Fix(package): update js-yaml to version 3.9.0
- Fix(package): update inquirer to version 3.2.0
- Fix(package): update compression to version 1.7.0
- Fix(package): update cors to version 2.8.4
- Fix(package): update typescript to version 2.4.2
- Fix(package): update ts-node to version 3.2.1
- Fix(package): update inquirer to version 3.2.1
- Fix(package): update ts-node to version 3.3.0

Closes #642
- Fix(package): update recaptcha-promise to version 0.1.3
- Fix(package): update js-yaml to version 3.9.1
- Fix(package): update monk to version 6.0.3
- Fix(package): update pug to version 2.0.0-rc.3
- Fix(package): update chalk to version 2.1.0
- Fix(package): update redis to version 2.8.0
- Fix(package): update mongodb to version 2.2.31
- Fix(package): update debug to version 3.0.0
- Fix(package): update elasticsearch to version 13.3.1

Closes #673
- Fix(package): update crypto to version 1.0.1

Closes #682
- Fix(package): update reconnecting-websocket to version 3.1.1

Closes #686
- Fix(package): update file-type to version 6.1.0
- Fix(package): update inquirer to version 3.2.2
- Fix(package): update riot to version 3.6.2
- Fix(package): update reconnecting-websocket to version 3.2.0
- Fix(package): update riot to version 3.6.3
- Fix(package): update debug to version 3.0.1
- Fix(package): update reconnecting-websocket to version 3.2.1
- Fix(package): update inquirer to version 3.2.3
- Fix(package): update typescript to version 2.5.2
- Fix(package): update riot to version 3.7.0
- Fix(package): update cropperjs to version 1.0.0
- Fix(package): update pug to version 2.0.0-rc.4
- Fix(package): update body-parser to version 1.18.0
- Fix(package): update js-yaml to version 3.10.0
- Fix(package): update monk to version 6.0.4
- Fix(package): update rimraf to version 2.6.2
- Fix(package): update serve-favicon to version 2.4.4
- Fix(package): update body-parser to version 1.18.1
- Fix(package): update riot to version 3.7.1
- Fix

- Fix(package): update animejs to version 2.1.0
- Fix(package): update inquirer to version 3.3.0
- Fix(package): update cafy to version 3.0.0
- Fix(package): update request to version 2.82.0
- Fix(package): update body-parser to version 1.18.2
- Fix(package): update file-type to version 6.2.0
- Fix(package): update riot to version 3.7.2
- Fix(package): update reconnecting-websocket to version 3.2.2
- Fix(package): update animejs to version 2.2.0
- Fix(package): update serve-favicon to version 2.4.5
- Fix(package): update debug to version 3.1.0
- Fix(package): update typescript to version 2.5.3
- Fix(package): update morgan to version 1.9.0
- Fix(package): update request to version 2.83.0
- Fix(package): update compression to version 1.7.1
- Fix(package): update riot to version 3.7.3
- Fix(package): update monk to version 6.0.5
- Fix(package): update cropperjs to version 1.1.1

Closes #820
- Fix(package): update mongodb to version 2.2.33

Closes #826
- Fix(package): update file-type to version 7.2.0

Closes #821
- Fix(package): update cropperjs to version 1.1.2
- Fix(package): update websocket to version 1.0.25
- Fix(package): update cropperjs to version 1.1.3
- Fix(package): update chalk to version 2.3.0

Closes #833
- Fix(package): update typescript to version 2.6.1
- Fix(package): update cafy to version 3.1.1

Closes #857
- Fix(package): update riot to version 3.7.4
- Fix timeline

- Fix

- Fix

- Fix lint (automattic)

- Fix

- Fix

- Fix(package): update @types/elasticsearch to version 5.0.18
- Fix(package): update typescript to version 2.6.2
- Fix(package): update @types/chai to version 4.0.6
- Fix(package): update inquirer to version 4.0.1
- Fix(package): update eventemitter3 to version 3.0.0
- Fix(package): update uglifyjs-webpack-plugin to version 1.1.2
- Fix(package): update webpack to version 3.9.0
- Fix(package): update web-push to version 3.2.5
- Fix(package): update webpack to version 3.9.1
- Fix(package): update ms to version 2.1.1

Closes #958
- Fix(package): update awesome-typescript-loader to version 3.4.1
- Fix(package): update file-type to version 7.4.0
- Fix(package): update webpack to version 3.10.0
- Fix(package): update @types/chai to version 4.0.8

Closes #963
- Fix(package): update @types/elasticsearch to version 5.0.19
- Fix(package): update @types/node to version 8.0.57

Closes #964
- Fix(package): update @types/redis to version 2.8.2
- Fix(package): update @fortawesome/fontawesome to version 1.0.1
- Fix(package): update @fortawesome/fontawesome-free-solid to version 5.0.1
- Fix(package): update @fortawesome/fontawesome-free-regular to version 5.0.1
- Fix(package): update @fortawesome/fontawesome-free-brands to version 5.0.1
- Fix(package): update pictograph to version 2.1.5

Closes #979
- Fix(package): update @types/mongodb to version 2.2.17
- Fix(package): update @types/node to version 8.0.58
- Fix(package): update @types/chai to version 4.0.10

Closes #988
- Fix(package): update @types/request to version 2.0.9
- Fix(package): update @types/node to version 8.5.0
- Fix(package): update @types/redis to version 2.8.3
- Fix(package): update @types/inquirer to version 0.0.36
- Fix(package): update @types/node to version 8.5.1
- Fix(package): update uglifyjs-webpack-plugin to version 1.1.3
- Fix(package): update style-loader to version 0.19.1
- Fix(package): update uglifyjs-webpack-plugin to version 1.1.4
- Fix(package): update cropperjs to version 1.2.1

Closes #1006
- Fix(package): update riot-tag-loader to version 1.1.0
- Fix(package): update ts-node to version 4.1.0

Closes #985
- Fix(package): update riot-tag-loader to version 2.0.0

Closes #1042
- Fix(package): update gulp-htmlmin to version 4.0.0
- Fix(package): update mongodb to version 3.0.1

Closes #1046
- Fix(package): update riot-tag-loader to version 2.0.1
- Fix(package): update uglifyjs-webpack-plugin to version 1.1.5
- Fix(package): update qrcode to version 1.0.1
- Fix(package): update gm to version 1.23.1
- Fix(package): update riot to version 3.8.0
- Fix(package): update riot to version 3.8.1
- Fix(package): update qrcode to version 1.2.0

Closes #1053
- Fix(package): update riot-tag-loader to version 2.0.2
- Fix(package): update gulp-imagemin to version 4.1.0
- Fix(package): update css-loader to version 0.28.10
- Fix(package): update vue-js-modal to version 1.3.12
- Fix(package): update mongodb to version 3.0.3
- Fix(package): update web-push to version 3.3.0
- Fix(package): update webpack to version 4.0.0
- Fix(package): update @types/compression to version 0.0.36
- Fix(package): update @types/inquirer to version 0.0.38
- Fix(package): update @types/mongodb to version 3.0.8
- Fix(package): update @types/webpack to version 4.1.1
- Fix(package): update css-loader to version 0.28.11
- Fix(package): update elasticsearch to version 14.2.1
- Fix(package): update eslint to version 4.19.0
- Fix(package): update license-checker to version 17.0.0
- Fix(package): update ws to version 5.1.0
- Fix(package): update html-minifier to version 3.5.12
- Fix(package): update pug to version 2.0.2
- Fix(package): update license-checker to version 18.0.0
- Fix(package): update is-url to version 1.2.3
- Fix(package): update webpack to version 4.2.0
- Fix(package): update pug to version 2.0.3
- Fix(package): update eslint to version 4.19.1
- Fix(package): update eslint-plugin-vue to version 4.4.0
- Fix(package): update chai-http to version 4.0.0
- Fix(package): update is-root to version 2.0.0
- Fix(package): update webpack-cli to version 2.0.13
- Fix(package): update gulp-typescript to version 4.0.2
- Fix(package): update element-ui to version 2.3.0
- Fix(package): update element-ui to version 2.3.2

Closes #1330
- Fix(package): update @types/js-yaml to version 3.11.1
- Fix(package): update html-minifier to version 3.5.13
- Fix(package): update bootstrap-vue to version 2.0.0-rc.4

Closes #1349
- Fix(package): update jsdom to version 11.7.0
- Fix(package): update bootstrap-vue to version 2.0.0-rc.6

Closes #1367
- Fix(package): update ws to version 5.1.1
- Fix(package): update @types/node to version 9.6.2
- Fix(package): update @types/inquirer to version 0.0.41
- Fix(package): update element-ui to version 2.3.3
- Fix(package): update webpack to version 4.5.0
- Fix(package): update object-assign-deep to version 0.4.0
- Fix(package): update webpack-cli to version 2.0.14
- Fix(package): update @types/mongodb to version 3.0.10
- Fix(package): update vue-loader to version 15.0.0-rc.1
- Fix(package): update html-minifier to version 3.5.14
- Fix(package): update gulp-pug to version 4.0.0
- Fix(package): update @types/mongodb to version 3.0.11
- Fix(package): update mongodb to version 3.0.6
- Fix(package): update @types/mongodb to version 3.0.12
- Fix(package): update @types/node to version 9.6.4

Closes #1444
- Fixed english translation

- Fixed english translation

- Fixed translate.en.md

- Fix(package): update mongodb to version 3.0.7
- Fix(package): update @types/mongodb to version 3.0.15

Closes #1513
- Fix(package): update style-loader to version 0.21.0
- Fix typo

- Fix typo

Signed-off-by: Marcin Mikołajczak <me@m4sk.in>

- Fix #1428

- Fix typo

Signed-off-by: Marcin Mikołajczak <me@m4sk.in>

- Fix typo
- Fix: validate post's text on mobile client.
- Fix: validate post's text with Ctrl+Enter on PC.
- Fix: when text is null, bug can pass validation.

fixed. (maybe?)
- Fix: "or" operator.
- Fix #1726

- Fix

- Fix(package): update ts-node to version 6.1.2
- Fix(package): update web-push to version 3.3.2
- Fix(package): update @types/koa-bodyparser to version 5.0.0
- Fix(package): update @types/koa-router to version 7.0.29
- Fix(package): update @types/mocha to version 5.2.3
- Fix(package): update @types/webpack to version 4.4.2
- Fix(package): update @types/koa-router to version 7.0.30
- Fix(package): update ratelimiter to version 3.1.0
- Fix(package): update ts-node to version 7.0.0

Closes #1765
- Fix(package): update @types/node to version 10.3.5
- Fix(package): update hard-source-webpack-plugin to version 0.9.0
- Fix(package): update eslint to version 5.0.0
- Fix(package): update ws to version 5.2.1
- Fix(package): update webpack to version 4.12.1
- Fix(package): update html-minifier to version 3.5.17
- Fix(package): update @types/node to version 10.3.6
- Fix(package): update @types/webpack to version 4.4.3
- Fix(package): update eslint to version 5.0.1
- Fix(package): update element-ui to version 2.4.2
- Fix(package): update uuid to version 3.3.0
- Fix(package): update webpack to version 4.12.2
- Fix(package): update mongodb to version 3.1.0
- Fix(package): update typescript-eslint-parser to version 16.0.1
- Fix(package): update @types/mongodb to version 3.0.22
- Fix(package): update @types/node to version 10.5.0
- Fix(package): update @types/webpack to version 4.4.4
- Fix(package): update uuid to version 3.3.2
- Fix(package): update @types/mongodb to version 3.0.23
- Fix(package): update @types/node to version 10.5.1
- Fix(package): update webpack to version 4.14.0

Closes #1818
- Fix(package): update @types/mongodb to version 3.1.0
- Fix(package): update hard-source-webpack-plugin to version 0.10.0
- Fix(package): update vue-js-modal to version 1.3.16
- Fix(package): update hard-source-webpack-plugin to version 0.10.1
- Fix(package): update element-ui to version 2.4.3
- Fix(package): update html-minifier to version 3.5.18
- Fix(package): update elasticsearch to version 15.1.0
- Fix(package): update elasticsearch to version 15.1.1
- Fix(package): update @types/js-yaml to version 3.11.2
- Fix(package): update @types/mongodb to version 3.1.1
- Fix(package): update @types/webpack to version 4.4.5
- Fix(package): update webpack to version 4.15.0
- Fix(package): update node-sass to version 4.9.1
- Fix(package): update webpack to version 4.15.1
- Fix(package): update mongodb to version 3.1.1
- Fix(package): update @types/node to version 10.5.2
- Fix(package): update css-loader to version 1.0.0
- Fix(package): update hard-source-webpack-plugin to version 0.11.0

Closes #1861
- Fix(package): update node-sass to version 4.9.2
- Fix(package): update file-type to version 8.1.0
- Fix(package): update @types/koa-bodyparser to version 5.0.1
- Fix(package): update webpack to version 4.16.0
- Fix(package): update @koa/cors to version 2.2.2
- Fix(package): update ws to version 5.2.2
- Fix(package): update hard-source-webpack-plugin to version 0.11.1
- Fix(package): update element-ui to version 2.4.4
- Fix(package): update html-minifier to version 3.5.19
- Fix(package): update @types/elasticsearch to version 5.0.25
- Fix(package): update @types/webpack to version 4.4.6
- Fix(package): update eslint-plugin-vue to version 4.6.0
- Fix(package): update eslint-plugin-vue to version 4.7.0
- Fix(package): update webpack to version 4.16.1
- Fix(package): update @types/webpack to version 4.4.7
- Fix(package): update vue-loader to version 15.2.5
- Fix(package): update vue-loader to version 15.2.6
- Fix(package): update webpack-cli to version 3.1.0
- Fix(package): update swagger-jsdoc to version 1.10.2

Closes #1924
- Fix(package): update emojilib to version 2.3.0
- Fix(package): update @types/mongodb to version 3.1.2
- Fix(package): update ratelimiter to version 3.2.0
- Fix(package): update ws to version 6.0.0
- Fix(package): update hard-source-webpack-plugin to version 0.11.2
- Fix(package): update swagger-jsdoc to version 1.10.3
- Fix(package): update webpack to version 4.16.2
- Fix(package): update gulp-rename to version 1.4.0
- Fix(package): update @types/webpack to version 4.4.8
- Fix(package): update eslint-plugin-vue to version 4.7.1
- Fix(package): update @types/node to version 10.5.3
- Fix(package): update gulp-uglify to version 3.0.1
- Fix(package): update element-ui to version 2.4.5
- Fix(package): update typescript-eslint-parser to version 17.0.0
- Fix(package): update typescript-eslint-parser to version 17.0.1
- Fix(package): update jsdom to version 11.12.0
- Fix: critical memory leak.

- Fix(package): update webpack to version 4.16.3
- Fix(package): update @types/koa-router to version 7.0.31
- Fix(package): update @types/node to version 10.5.4
- Fix(package): update hard-source-webpack-plugin to version 0.12.0
- Fix(package): update @types/koa__cors to version 2.2.3
- Fix(package): update qrcode to version 1.2.2
- Fix(package): update @types/node to version 10.5.5
- Fix(package): update sass-loader to version 7.1.0
- Fix(package): update vue-template-compiler to version 2.5.17
- Fix(package): update vue to version 2.5.17
- Fix(package): update @types/webpack to version 4.4.9
- Fix(package): update @types/mongodb to version 3.1.3
- Fix(package): update webpack to version 4.16.4
- Fix(package): update systeminformation to version 3.42.6

Closes #2076
- Fix(package): update systeminformation to version 3.42.8
- Fix(package): update commander to version 2.17.0
- Fix(package): update @types/node to version 10.5.6
- Fix(package): update webpack to version 4.16.5
- Fix(package): update typescript-eslint-parser to version 18.0.0
- Fix(package): update @types/node to version 10.5.7
- Fix(package): update vue-loader to version 15.2.7
- Fix(package): update commander to version 2.17.1
- Fix(package): update style-loader to version 0.22.0
- Fix(package): update vue-loader to version 15.3.0
- Fix(package): update systeminformation to version 3.42.9
- Fix(package): update style-loader to version 0.22.1
- Fix(package): update summaly to version 2.1.0 ([#2132](https://github.com/orhun/git-cliff/issues/2132))


- Fix(package): update node-sass to version 4.9.3 ([#2131](https://github.com/orhun/git-cliff/issues/2131))


- Fix(package): update summaly to version 2.1.1 ([#2135](https://github.com/orhun/git-cliff/issues/2135))


- Fix(package): update element-ui to version 2.4.6
- Fix(package): update file-type to version 9.0.0
- Fix(package): update summaly to version 2.1.2 ([#2149](https://github.com/orhun/git-cliff/issues/2149))


- Fix(package): update request to version 2.88.0 ([#2151](https://github.com/orhun/git-cliff/issues/2151))


- Fix(package): update @types/node to version 10.5.8 ([#2152](https://github.com/orhun/git-cliff/issues/2152))


- Fix(package): update ts-node to version 7.0.1
- Fix(package): update vue-js-modal to version 1.3.17
- Fix(package): update parse5 to version 5.1.0
- Fix(package): update mongodb to version 3.1.2
- Fix(package): update vue-style-loader to version 4.1.2
- Fix(package): update mongodb to version 3.1.3
- Fix(package): update @types/mongodb to version 3.1.4
- Fix(package): update @types/node to version 10.7.0
- Fix(package): update @types/ws to version 6.0.0
- Fix(package): update url-loader to version 1.1.0
- Fix(package): update seedrandom to version 2.4.4
- Fix(package): update @types/node to version 10.7.1
- Fix(package): update @types/webpack to version 4.4.10
- Fix(package): update minio to version 7.0.0
- Fix #2266

- Fix #2266: デフォルト値を設定

- Fix(package): update url-loader to version 1.1.1
- Fix #1776

- Fix(package): update html-minifier to version 3.5.20
- Fix(package): update vue-loader to version 15.4.0
- Fix(package): update vue-js-modal to version 1.3.18
- Fix(package): update webpack to version 4.17.0
- Fix(package): update sharp to version 0.20.7

Closes #2368
- Fix login bug([#2384](https://github.com/orhun/git-cliff/issues/2384))

- Fix(package): update webpack to version 4.17.1
- Fix(package): update summaly to version 2.1.4
- Fix(package): update vue-js-modal to version 1.3.19
- Fix(package): update @types/sharp to version 0.17.10
- Fix(package): update @types/webpack to version 4.4.11
- Fix(package): update @types/node to version 10.9.1

Closes #2431
- Fix(package): update @types/node to version 10.9.2
- Fix(package): update systeminformation to version 3.43.0

Closes #2477
- Fix(package): update systeminformation to version 3.44.0
- Fix(package): update nan to version 2.11.0
- Fix

- Fix(package): update vue-loader to version 15.4.1
- Fix(package): update vue-js-modal to version 1.3.20
- Fix(package): update style-loader to version 0.23.0
- Fix(package): update @types/elasticsearch to version 5.0.26
- Fix(package): update vue-js-modal to version 1.3.23

Closes #2517
- Fix(package): update systeminformation to version 3.44.2

Closes #2519
- Fix(package): update @types/node to version 10.9.3
- Fix(package): update summaly to version 2.2.0
- Fix(package): update vue-js-modal to version 1.3.24
- Fix(package): update @types/uuid to version 3.4.4
- Fix(package): update @types/websocket to version 0.0.40
- Fix(package): update @types/node to version 10.9.4
- Fix #2315 ([#2339](https://github.com/orhun/git-cliff/issues/2339))

* improve MFM to html

* improve html to MFM

* missing semicolon

* missing semicolon

* fix html to MFM

タグのリンクは解除するように

* fix bug

* misssing semicolon

* Update html-to-mfm.ts

* Update html-to-mfm.ts

- Fix

- Fix(package): update webpack to version 4.17.2 ([#2599](https://github.com/orhun/git-cliff/issues/2599))


- Fix(package): update vue-js-modal to version 1.3.26 ([#2613](https://github.com/orhun/git-cliff/issues/2613))


- Fix(package): update systeminformation to version 3.45.0 ([#2609](https://github.com/orhun/git-cliff/issues/2609))


- Fix(package): update node-sass-json-importer to version 4.0.0 ([#2614](https://github.com/orhun/git-cliff/issues/2614))


- Fix(package): update systeminformation to version 3.45.1 ([#2616](https://github.com/orhun/git-cliff/issues/2616))


- Fix mk-media darkmode

- Fix(package): update @types/ws to version 6.0.1 ([#2636](https://github.com/orhun/git-cliff/issues/2636))


- Fix(package): update @types/minio to version 7.0.0 ([#2626](https://github.com/orhun/git-cliff/issues/2626))


- Fix(package): update node-sass-json-importer to version 4.0.1 ([#2645](https://github.com/orhun/git-cliff/issues/2645))


- Fix(package): update commander to version 2.18.0
- Fix(package): update minio to version 7.0.1 ([#2655](https://github.com/orhun/git-cliff/issues/2655))


- Fix docs ([#2678](https://github.com/orhun/git-cliff/issues/2678))


- Fix(package): update systeminformation to version 3.45.6

Closes #2617
- Fix(package): update vue-loader to version 15.4.2 ([#2692](https://github.com/orhun/git-cliff/issues/2692))


- Fix(package): update debug to version 4.0.1 ([#2700](https://github.com/orhun/git-cliff/issues/2700))

Closes #2682
- Fix(package): update @types/mongodb to version 3.1.7 ([#2701](https://github.com/orhun/git-cliff/issues/2701))

Closes #2681
- Fix(package): update webpack to version 4.18.0 ([#2680](https://github.com/orhun/git-cliff/issues/2680))


- Fix(package): update webpack to version 4.18.1 ([#2704](https://github.com/orhun/git-cliff/issues/2704))


- Fix(package): update webpack to version 4.19.0
- Fix(package): update vue-cropperjs to version 2.2.2
- Fix(package): update @types/node to version 10.10.0
- Fix(package): update @types/node to version 10.10.1
- Fix(package): update webpack to version 4.19.1 ([#2732](https://github.com/orhun/git-cliff/issues/2732))


- Fix(package): update web-push to version 3.3.3 ([#2733](https://github.com/orhun/git-cliff/issues/2733))


- Fix(package): update @types/webpack to version 4.4.12 ([#2739](https://github.com/orhun/git-cliff/issues/2739))


- Fix(package): update @types/koa-router to version 7.0.32 ([#2740](https://github.com/orhun/git-cliff/issues/2740))


- Fix(package): update websocket to version 1.0.28 ([#2746](https://github.com/orhun/git-cliff/issues/2746))

Closes #2743
- Fix(package): update @types/bcryptjs to version 2.4.2 ([#2742](https://github.com/orhun/git-cliff/issues/2742))


- Fix(package): update @types/node to version 10.10.2 ([#2750](https://github.com/orhun/git-cliff/issues/2750))


- Fix(package): update @types/node to version 10.10.3 ([#2753](https://github.com/orhun/git-cliff/issues/2753))


- Fix(package): update webpack to version 4.20.2 ([#2814](https://github.com/orhun/git-cliff/issues/2814))

Closes #2768
- Fix(package): update gulp-htmlmin to version 5.0.1 ([#2815](https://github.com/orhun/git-cliff/issues/2815))

Closes #2669
- Fix(package): update nan to version 2.11.1 ([#2784](https://github.com/orhun/git-cliff/issues/2784))


- Fix(package): update koa-mount to version 4.0.0 ([#2776](https://github.com/orhun/git-cliff/issues/2776))


- Fix(package): update diskusage to version 0.2.5 ([#2767](https://github.com/orhun/git-cliff/issues/2767))


- Fix(package): update qrcode to version 1.3.0 ([#2799](https://github.com/orhun/git-cliff/issues/2799))


- Fix(package): update @types/qrcode to version 1.3.0 ([#2813](https://github.com/orhun/git-cliff/issues/2813))


- Fix(package): update jsdom to version 12.1.0 ([#2788](https://github.com/orhun/git-cliff/issues/2788))


- Fix(package): update webpack-cli to version 3.1.2 ([#2816](https://github.com/orhun/git-cliff/issues/2816))

Closes #2757
- Fix(package): update @types/node to version 10.11.4 ([#2817](https://github.com/orhun/git-cliff/issues/2817))

Closes #2765
- Fix(package): update @types/webpack to version 4.4.14 ([#2818](https://github.com/orhun/git-cliff/issues/2818))

Closes #2778
- Fix(package): update typescript-eslint-parser to version 19.0.2 ([#2819](https://github.com/orhun/git-cliff/issues/2819))

Closes #2772
- Fix(package): update sharp to version 0.21.0

Closes #2619
- Fix(package): update vue-svg-inline-loader to version 1.1.4 ([#2821](https://github.com/orhun/git-cliff/issues/2821))


- Fix #2346

- Fix(package): update ws to version 6.1.0 ([#2823](https://github.com/orhun/git-cliff/issues/2823))


- Fix(package): update reconnecting-websocket to version 4.1.5 ([#2845](https://github.com/orhun/git-cliff/issues/2845))

Closes #2785
- Fix(package): update systeminformation to version 3.45.7 ([#2825](https://github.com/orhun/git-cliff/issues/2825))


- Fix(package): update file-loader to version 2.0.0 ([#2827](https://github.com/orhun/git-cliff/issues/2827))


- Fix(package): update vue-svg-inline-loader to version 1.2.0 ([#2844](https://github.com/orhun/git-cliff/issues/2844))


- Fix(package): update @types/debug to version 0.0.31 ([#2822](https://github.com/orhun/git-cliff/issues/2822))


- Fix(package): update file-type to version 10.0.0 ([#2846](https://github.com/orhun/git-cliff/issues/2846))


- Fix(package): update jsdom to version 12.2.0 ([#2848](https://github.com/orhun/git-cliff/issues/2848))


- Fix(package): update @types/mongodb to version 3.1.10 ([#2849](https://github.com/orhun/git-cliff/issues/2849))

Closes #2752
- Fix(package): update style-loader to version 0.23.1
- Fix(package): update typescript-eslint-parser to version 20.0.0
- Fix(package): update debug to version 4.1.0 ([#2857](https://github.com/orhun/git-cliff/issues/2857))


- Fix(package): update commander to version 2.19.0 ([#2862](https://github.com/orhun/git-cliff/issues/2862))


- Fix(package): update @types/mongodb to version 3.1.11 ([#2864](https://github.com/orhun/git-cliff/issues/2864))


- Fix(package): update @types/node to version 10.11.5 ([#2865](https://github.com/orhun/git-cliff/issues/2865))


- Fix(package): update @types/redis to version 2.8.7 ([#2866](https://github.com/orhun/git-cliff/issues/2866))


- Fix(package): update @types/webpack to version 4.4.15 ([#2868](https://github.com/orhun/git-cliff/issues/2868))


- Fix(package): update @types/mongodb to version 3.1.12 ([#2874](https://github.com/orhun/git-cliff/issues/2874))


- Fix(package): update url-loader to version 1.1.2 ([#2883](https://github.com/orhun/git-cliff/issues/2883))


- Fix(package): update @types/webpack to version 4.4.16 ([#2880](https://github.com/orhun/git-cliff/issues/2880))


- Fix(package): update @types/koa-logger to version 3.1.1 ([#2877](https://github.com/orhun/git-cliff/issues/2877))


- Fix(package): update @types/node to version 10.11.6 ([#2876](https://github.com/orhun/git-cliff/issues/2876))


- Fix(package): update vue-color to version 2.7.0 ([#2884](https://github.com/orhun/git-cliff/issues/2884))


- Fix(package): update @types/node to version 10.11.7 ([#2885](https://github.com/orhun/git-cliff/issues/2885))


- Fix(package): update @types/elasticsearch to version 5.0.27
- Fix(package): update reconnecting-websocket to version 4.1.6
- Fix(package): update reconnecting-websocket to version 4.1.7
- Fix(package): update reconnecting-websocket to version 4.1.8
- Fix(package): update chart.js to version 2.7.3 ([#2907](https://github.com/orhun/git-cliff/issues/2907))


- Fix(package): update vue-svg-inline-loader to version 1.2.1 ([#2909](https://github.com/orhun/git-cliff/issues/2909))


- Fix(package): update @types/gulp-uglify to version 3.0.6 ([#2906](https://github.com/orhun/git-cliff/issues/2906))


- Fix(package): update @types/sharp to version 0.21.0 ([#2908](https://github.com/orhun/git-cliff/issues/2908))


- Fix(package): update @types/webpack to version 4.4.17 ([#2911](https://github.com/orhun/git-cliff/issues/2911))


- Fix(package): update @types/node to version 10.12.0 ([#2912](https://github.com/orhun/git-cliff/issues/2912))


- Fix(package): update @fortawesome/free-brands-svg-icons to version 5.4.1 ([#2916](https://github.com/orhun/git-cliff/issues/2916))

Closes #2859
- Fix(package): update reconnecting-websocket to version 4.1.9
- Fix(package): update @types/elasticsearch to version 5.0.28 ([#2924](https://github.com/orhun/git-cliff/issues/2924))


- Fix(package): update showdown to version 1.8.7 ([#2925](https://github.com/orhun/git-cliff/issues/2925))


- Fix(package): update webpack to version 4.21.0
- Fix(package): update vue-sweetalert2 to version 1.5.6 ([#2932](https://github.com/orhun/git-cliff/issues/2932))


- Fix(package): update reconnecting-websocket to version 4.1.10 ([#2937](https://github.com/orhun/git-cliff/issues/2937))


- Fix(package): update webpack to version 4.22.0 ([#2969](https://github.com/orhun/git-cliff/issues/2969))


- Fix(package): update file-type to version 10.1.0 ([#2984](https://github.com/orhun/git-cliff/issues/2984))


- Fix(package): update systeminformation to version 3.45.9 ([#2987](https://github.com/orhun/git-cliff/issues/2987))

Closes #2986
- Blockings list

- Fix self host detection ([#3201](https://github.com/orhun/git-cliff/issues/3201))


- Fix Content-Disposition ([#4573](https://github.com/orhun/git-cliff/issues/4573))


- Fix #4532 ([#4592](https://github.com/orhun/git-cliff/issues/4592))


- Fix syuilo#4711 ([#4715](https://github.com/orhun/git-cliff/issues/4715))


- Fix #1442, fix #2106

- Fix

- Fix build error ([#5162](https://github.com/orhun/git-cliff/issues/5162))


- Fix #5071 ([#5184](https://github.com/orhun/git-cliff/issues/5184))


- Fix #5214 ウィジェットが選択されていないときは追加されないように ([#5227](https://github.com/orhun/git-cliff/issues/5227))

* fix #5214

* null削除の取り消し

* 空白文字の調整

- Fix typo in misskey.nginx ([#5445](https://github.com/orhun/git-cliff/issues/5445))

sites-ebabled => sites-enabled
- Fix typo
- Fix ([#5710](https://github.com/orhun/git-cliff/issues/5710))


- Fix

- Fix #5854

- Fix typo #5890

- Fix files grid height

- Fix

- Fix gif badge ([#6153](https://github.com/orhun/git-cliff/issues/6153))


- Fix(pages): AiScript変数があると型チェックができない問題を修正

- Fix(pages): Fix chart type detection

- Fix(client): Fix canvas overflow

- Fix(client): Fix bug that cannot post when image only

- Fix(lint): Use const

- Fix(client): Fix lint

- Fix(client): Fix a bug that if block of pages not working

- Fix(server): Fix #6284

- Fix(client): Fix default reaction setting

- Fix(client): Add missing icon

- Fix(client): Fix bug that cannot set custom texture

- Fix(client): Do not expand each notes in my/mentions

Related #6336

- Fix(client): Do not expand each notes in my/messages

- Fix(client): Fix style of poll viewer

- Fix(client): Fix poll vote notification

Fix #5998

- Fix(client): Fix reply style

- Fix(server): Remove koa-compress

- Fix(client): Mk:api関数にトークンを渡せない問題

- Fix(client): Use router-link instead of a to avoid page refresh

- Fix(i18n): Fix missing translation
- Fix

- Fix

- Fix(client): 全既読系ボタンのAPIの指定が間違っているのを修正 ([#6424](https://github.com/orhun/git-cliff/issues/6424))


- Fix(api): Fix #6419

Close #6434

- Fix(server): Fix #6433

- Fix(api): Fix #6418 ([#6442](https://github.com/orhun/git-cliff/issues/6442))


- Fix サイドバーの設定に不具合があるとページが表示できなくなる ([#6473](https://github.com/orhun/git-cliff/issues/6473))

* fix #6460

* Update app.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix 非ログイン時に n または p キー押下で投稿フォームが出る ([#6508](https://github.com/orhun/git-cliff/issues/6508))

* fix #5851

* post-formのスポーンを弾く場所を変更
- Fix(client): Fix style

- Fix(client): Fix timeline widget setting definition

- Fix #6335 ([#6507](https://github.com/orhun/git-cliff/issues/6507))


- Fix(cliemt): Fix style

- Fix(client): Fix #6528

- Fix(client): Fix icon

- Fix(server): Fix #6533

- Fix(client): Fix style

- Fix(client): Fix #6532

- Fix(client): i18n

- Fix(client): Fix indicator position

- Fix(locale): Add missing key

- Fix(client): Fix theme color

- Fix(client): Show shadow

- Fix(client): Fix sticky sidebar behavior

- Fix(client): Fix #6540

- Fix(client): Fix #6526

- Fix(client): Better wheel handling

- Fix(docs): Update api doc

- Fix(client): プラグインの動作を修正

- Fix(client): :v:

- Fix lint ([#6568](https://github.com/orhun/git-cliff/issues/6568))


- Fix(client): Fix federation widget

- Fix(client): Remove unncessary #

- Fix(client): Do not render img tag when icon url not provided

- Fix(client): 通知が流れない問題を修正

- Fix(client): ピン留めされたノートがリアクティブではない問題を修正

- Fix(client): 通知のノートがリアクティブではない問題を修正

Fix #6602

- Fix(client): プラグインの設定がnullになることがある問題を修正

- Fix(client): Reactivate poll

- Fix(client): Cannot read announcement

Fix #6609

- Fix appearance

- Fix(client): Broken syntax highlight

- Fix(client): Message read state is not reactive

- Fix(server): Prevent error when recieve non-json data from websocket

Fix #6658

- Fix(clinet): 誤字によりスクロールイベントリスナが解除されていなかったのを修正

- Fix an error on /api-doc ([#6665](https://github.com/orhun/git-cliff/issues/6665))


- Fix(server): Fix #6669

- Fix(client): Fix #6698

- Fix(client): ストリーミングのメモリリークを修正

SharedConnection や NonSharedConnection のインスタンスを Vue コンポーネントの data に含むと、Vue が Proxy に変換するため、Stream クラス内部でインスタンス同士の比較をしても false になり、使われなくなったインスタンスがメモリ上に残り続ける。
なお、チャンネルへの接続/切断は頻繁に行うものではないため、メモリリークといっても影響は軽微とみられる。

- Fix bug

- Fix locale handling

- Fix deck navigation

- Fix doc

- Fix deck

- Fix bug

- Fix ui

- Fix context menu

- Fix ui

- Fix #7189

- Fix for lint

- Fix migration script
- Fix modal

- Fix bug

- Fix bug

- Fix assets

Fix #7314
Fix #7313

- Fix comment

- Fix watch

- Fix bug

- Fix: suppress disk stats error

- Fix(server): Use inner join

https://github.com/syuilo/misskey/issues/6813#issuecomment-803400023

- Fix(server): Use inner join

- Fix bug

- Fix bug

- Fix bug

https://github.com/syuilo/misskey/commit/48ea805999c6cb8e900aeaec6edaf68788bd51e0#commitcomment-48584326

- Fix

- Fix test

- Fix bug

- Fix type

- Fix bug

- Fix bug

- Fix bug

- Fix #7444

- Fix style

- Fix theme

- Fix bug

- Fix

- Fix style

- Fix #7454

- Fix #7466
- Fix bug

- Fix style

- Fix style

- Fix bug

- Fix bug

- Fix bug

- Fix style

- Fix bug

- Fix bug

- Fix: Safariでもモーダルのぼかし効果が効くようにした ([#7530](https://github.com/orhun/git-cliff/issues/7530))

https://github.com/misskey-dev/misskey/issues/7529
- Fix type

- Fix bug

- Fix bug

- Fix local emoji detection

https://github.com/misskey-dev/misskey/pull/7526#discussion_r641886612

- Fix typo

Resolve #7540

- Fix style

- Fix bug

- Fix

- Fix api response definition

- Fix bug

- Fix email notification bug

- Fix style

- Fix bug that docs not loading

- Fix chore error

- Fix(client): 更新時にテーマキャッシュをクリアするように

- Fix: truncate user information if it is too long ([#7629](https://github.com/orhun/git-cliff/issues/7629))

* truncate user information if it is too long

Some AP software allows for user names or summaries to be very long.
Misskey can not handle this and the profile page can not be opened and
no activities from such users can be seen.

Instead, the user name and summary are cut off after the maximum length
so misskey can still process the activities of the profile.

Co-authored-by: Toast <toast@toast.cafe>

* fix code style

Co-authored-by: Toast <toast@toast.cafe>
Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix typo

- Fix(server): ja-JPのような形式にDeepLが対応してない

- Fix(server): use insert instead of save

- Fix typo

- Fix(client): タッチ操作でウィンドウを閉じることができない問題を修正

- Fix(client): コントロールパネルでファイルを削除した際の表示を修正

Fix #7631

- Fix: mochaが動かないため拡張子なしに戻した

- Fix import

- Fix: import syslog-pro
- Fix: use correct query generate function ([#7657](https://github.com/orhun/git-cliff/issues/7657))

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix: meta.jsonをimportしないように

Fix #7671

- Fix(client): ノートの「削除して編集」をするとアンケートの選択肢が[object Object]になる問題を修正

Fix #7037

- Fix bug

- Fix(server): use csp to imporve security

- Fix: support DeepL pro account

Fix #7648

- Fix(client): fix button style

- Fix missing strings ([#7674](https://github.com/orhun/git-cliff/issues/7674))

* fix sort menu in federation panel

* add missing strings in report menu

* change i18n key too
- Fix Dockerfile ([#7763](https://github.com/orhun/git-cliff/issues/7763))

* fix Dockerfile

* remove unnecessary change

* add misskey-assets in .dockerignore
- Fix(server): ノート翻訳時に公開範囲が考慮されていない問題を修正

- Fix: use master branch when build docker image
- Fix: add vanilla-tilt

- Fix(server): fix #7786

- Fix: アンテナの既読 ([#7803](https://github.com/orhun/git-cliff/issues/7803))

from: https://gitlab.com/xianon/misskey/-/commit/a89742319caea378f9cdd70c8ebd83bdf2178ff6
- Fix: アンテナが既読にならないのを修正 ([#7809](https://github.com/orhun/git-cliff/issues/7809))


- Fix(client): タイムラインでリストとかなかったの修正

- Fix style

- Fix(client): fix #7774

- Fix inboxQueue import ([#7829](https://github.com/orhun/git-cliff/issues/7829))


- Fix(client): fix tabs of page header behaviour

- Fix(client): 絵文字一覧ページのタグ一覧をとりあえず無効に

重いため

- Fix(client): MFM関数構文のサジェストで括弧を無視するように

- Fix: truncate image descriptions ([#7699](https://github.com/orhun/git-cliff/issues/7699))

* move truncate function to separate file to reuse it

* truncate image descriptions

* show image description limit in UI

* correctly treat null

Co-authored-by: nullobsi <me@nullob.si>

* make truncate Unicode-aware

The strings that truncate returns should now be valid Unicode.

PostgreSQL also counts Unicode Code Points instead of bytes so this
should be correct.

* move truncate to internal, validate in API

Truncating could also be done in src/services/drive/add-file.ts or
src/services/drive/upload-from-url.ts but those would also affect
local images. But local images should result in a hard error if the
image comment is too long.

* avoid overwriting

Co-authored-by: nullobsi <me@nullob.si>
- Fix bug

- Fix(client): ユーザーページのタブが機能していない問題を修正

Fix #7853

- Fix bug

- Fix bug

- Fix bug

- Fix bug

- Fix(api): fix file type regex
- Fix(api): (0 , ms_1.default) is not a function

- Fix(client): ピン留めユーザーの設定項目がない問題を修正

- Fix ui

- Fix title

- Fix(api): 管理者およびモデレーターをブロックできてしまう問題を修正

- Fix(client): Deck UIにおいて、重ねたカラムの片方を畳んだ状態で右に出すと表示が壊れる問題を修正

Fix #7867

- Fix(client): テーマの管理が行えない問題を修正

- Fix(api): アプリケーション通知が取得できない問題を修正

Fix #6702

- Fix bug

#7874

- Fix(activitypub): not reacted な Undo.Like がinboxに滞留するのを修正

https: //github.com/mei23/misskey/commit/1cfb5e09a44819b82333df26409ec9d9657bdcfc
Co-Authored-By: MeiMei <30769358+mei23@users.noreply.github.com>

- Fix typo

- Fix chart rendering

- Fix(client): ウィジェットを追加できない問題を修正

Fix #7905

- Fix(client): ユーザーページのナビゲーションが失敗する問題を修正

- Fix test

- Fix e2e test
- Fix e2e test

- Fix e2e test

- Fix: Fix #7895 ([#7937](https://github.com/orhun/git-cliff/issues/7937))

* Fix #7895

* CHANGELOG
- Fix: 削除したノートやユーザーがリモートから参照されると復活することがあるのを修正 ([#7918](https://github.com/orhun/git-cliff/issues/7918))

* Fix #7557

* CHANGELOG

* Fix user

* CHANGELOG

* Tune CHANGELOG

* Tune CHANGELOG

* resolver

* Remove check

* Remove import

* CHANGELOG

* Tune

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix(client): ページ編集時のドロップダウンメニューなどが動作しない問題を修正

- Fix(client): コントロールパネルのカスタム絵文字タブが切り替わらないように見える問題を修正

- Fix missing i18n string ([#7945](https://github.com/orhun/git-cliff/issues/7945))


- Fix html conversion issue with code blocks ([#7943](https://github.com/orhun/git-cliff/issues/7943))


- Fix(client): Add missing localization string ([#7944](https://github.com/orhun/git-cliff/issues/7944))

* 欠けるi18nストリングの追加

* Update ja-JP.yml

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix

- Fix lint errors

- Fix test

- Fix e2e test

- Fix bug

- Fix errors

- Fix errors

- Fix: mention local users in replies ([#7975](https://github.com/orhun/git-cliff/issues/7975))

* mention local users in replies

* fix merge
- Fix(client): reaction viewer layout ([#7942](https://github.com/orhun/git-cliff/issues/7942))

The profile picture and name should be grouped together as they belong, and
it should be clear which picture belongs to which name.
- Fix for lint

- Fix(client): improve error handling

- Fix(client): fix tooltip style

- Fix(client):fix search all users ([#7993](https://github.com/orhun/git-cliff/issues/7993))


- Fix

- Fix(client): fix plugin activate and uninstall ([#7991](https://github.com/orhun/git-cliff/issues/7991))

* fix(client): fix plugin activate and uninstall

* Fix(client): fix package activates
- Fix(client): better error handling of file upload

- Fix(client): ログインにおいてパスワードが誤っている際のエラーメッセージが正しく表示されない問題を修正

- Fix(client): リアクションツールチップ、Renoteツールチップのユーザーの並び順を修正

- Fix: toolsが動かないのを修正 ([#8008](https://github.com/orhun/git-cliff/issues/8008))

* Move tools

* Fix DB
- Fix: notification.vueのIntersectionObserverまわりを修正 ([#8010](https://github.com/orhun/git-cliff/issues/8010))

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* Update packages/client/src/components/notification.vue

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* disconnect

* oops

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
- Fix(client): モバイルでタップしたときにツールチップが表示される問題を修正

- Fix: LTLやGTLが無効になっている場合でもUI上にタブが表示される問題を修正 ([#8026](https://github.com/orhun/git-cliff/issues/8026))

* wip

* add changelog

* 変換ミス修正
- Fix mentions in replies ([#8030](https://github.com/orhun/git-cliff/issues/8030))


- Fix: 画像ファイルの縦横サイズの取得で Exif Orientation を考慮する ([#8014](https://github.com/orhun/git-cliff/issues/8014))

* 画像ファイルの縦横サイズの取得で Exif Orientation を考慮する

* test: Add rotate.jpg test

* Webpublic 画像を返す時のみ Exif Orientation を考慮して縦横サイズを返す

* test: Support orientation
- Fix(server): Fix #8032

- Fix(client): pagesで関数を定義できない問題を修正

- Fix(client): tweak style

- Fix(client): fix range slider rendering

- Fix(client): タッチ機能付きディスプレイを使っていてマウス操作をしている場合に一部機能が動作しない問題を修正

- Fix(client): better hover detection

- Fix lint

- Fix: integration links ([#8036](https://github.com/orhun/git-cliff/issues/8036))


- Fix(client): クリップの設定を編集できない問題を修正

Fix #8046

- Fix(client): メニューなどがウィンドウの裏に隠れる問題を修正

- Fix(client): fix z-index bug

- Fix: YAMLファイルへのバックスペース文字混入対策

- Fix(client): オートコンプリートがダイアログの裏に隠れる問題を修正

- Fix(client): 一部のコンポーネントが裏に隠れるのを修正

- Fix(client): fix zindex issues

Fix #8060

- Fix(client): fix zindex issue
- Fix(client): tweak style

- Fix(client): fix zindex issue

- Fix(client): fix zindex issue

Fix #8064
Fix #8063

- Fix(client): fix zindex issue

- Fix(client/deck): カラムの増減がページをリロードするまで正しく反映されない問題を修正

Fix #8065

- Fix(client): カスタム絵文字一覧ページの負荷が高いのを修正

- Fix(client): fix zindex issue

Fix #8086

- Fix(client): ドロワーメニューでセーフエリアを考慮するように

- Fix(client): fix sidebar style

Fix #8049

- Fix html blockquote conversion ([#8069](https://github.com/orhun/git-cliff/issues/8069))


- Fix(client): fix sidebar style

- Fix(test): ignore ResizeObserver error

- Fix(server): エクスポートした絵文字の拡張子がfalseになることがあるのを修正

- Fix pizzax ([#8099](https://github.com/orhun/git-cliff/issues/8099))


- Fix

https://github.com/misskey-dev/misskey/commit/d53795184cd0ee326b0da58b267e3460f948703c#r62707827

- Fix

- Fix

- Fix

- Fix #8158

- Fix: proxyでsvgをpngに変換するように ([#8106](https://github.com/orhun/git-cliff/issues/8106))

* wip

* revert send-drive-file change

* fix

* Update packages/backend/src/server/proxy/proxy-media.ts

Co-authored-by: MeiMei <30769358+mei23@users.noreply.github.com>

Co-authored-by: MeiMei <30769358+mei23@users.noreply.github.com>
- Fix: code url in documentation ([#8117](https://github.com/orhun/git-cliff/issues/8117))

It seems this was not changed while refactoring the modules apart.
- Fix([#8133](https://github.com/orhun/git-cliff/issues/8133)): hCaptcha の reCAPTCHA 互換挙動を無効化する ([#8135](https://github.com/orhun/git-cliff/issues/8135))

* fix([#8133](https://github.com/orhun/git-cliff/issues/8133)): hCaptcha の reCAPTCHA 互換挙動を無効化する

* Update packages/client/src/components/captcha.vue

* fix: hCaptcha host

Co-authored-by: tamaina <tamaina@hotmail.co.jp>
- Fix(client): タイムラインのkeep-aliveが効かなくなっているのを修正

- Fix: アップロードエラー時の処理を修正 ([#8182](https://github.com/orhun/git-cliff/issues/8182))

* アップロードのエラー応答で詰むのを修正

* CHANGELOG
- Fix: change keypress to keydown ([#8192](https://github.com/orhun/git-cliff/issues/8192))


- Fix(client): チャットが見れない

Fix #8203

- Fix(client): 投稿のNSFW画像を表示したあとにリアクションが更新されると画像が非表示になる問題を修正

Fix #8208

- Fix(client): 「クリップ」ページが開かない問題を修正

- Fix(client): トレンドウィジェットが動作しないのを修正

- Fix

- Fix(client): リアクション設定で絵文字ピッカーが開かないのを修正

- Fix(client): DMページでメンションが含まれる問題を修正

Fix #8211

- Fix(client): 投稿フォームのハッシュタグ保持フィールドが動作しない問題を修正

Fix #8212

- Fix federation widged ([#8221](https://github.com/orhun/git-cliff/issues/8221))

The variables accidentally shadowed the variables that contain the ref's
to be rendered into the template.
- Fix federation widget
- Fix eslint rule

- Fix: ensure that specified users does not get duplicates ([#8233](https://github.com/orhun/git-cliff/issues/8233))

* ensure that specified users does not get duplicates

* Update packages/client/src/components/post-form.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix: Fix Sideview ([#8235](https://github.com/orhun/git-cliff/issues/8235))

* Fix #7890

* a-

* 3度目の正直

* fix

* :v:

* update CHANGELOG

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix(client): ツールチップの表示位置が正しくない問題を修正

- Fix: ストリーミングからのAPIリクエストが出来ないのを修正 ([#8244](https://github.com/orhun/git-cliff/issues/8244))

* Update call.ts

* あれ
- Fix(client): fix compare-versions import

- Fix: タイムライン種別を切り替えると「新しいノートがあります」の表示が残留してしまうのを修正 ([#8250](https://github.com/orhun/git-cliff/issues/8250))

Fix #6831
- Fix chart clean
- Fix: NodeInfo のユーザー数と投稿数の内容を見直す ([#8255](https://github.com/orhun/git-cliff/issues/8255))

* NodeInfoのアクティブユーザーの取得方法を変更する

* NodeInfoの投稿数の出力内容を見直す
- Fix

- Fix: v-sizeディレクティブの動作を修正 ([#8249](https://github.com/orhun/git-cliff/issues/8249))

* Fix size directive behavior not activated

* calc

* wip

* cache computed classes

* fix Vue3では使えなくなった

* 不要なIntersection Observerを削除

* comment
- Fix: instance ticker ([#8260](https://github.com/orhun/git-cliff/issues/8260))

* add type and default values

* remove unnecessary string operation
- Fix(server): system queueが動いていないのを修正

Fix #8272

- Fix typo

- Fix(client): 環境に依っては返信する際のカーソル位置が正しくない問題を修正

- Fix typo

- Fix(server): チャートのresyncでエラーが出る問題を修正

Fix #8274

- Fix(server): チャートのcleanでエラーが出る可能性がある問題を修正

- Fix test
- Fix: save followers/following visibility ([#8276](https://github.com/orhun/git-cliff/issues/8276))


- Fix(client): コントロールパネルのユーザー、ファイルにて、インスタンスの表示範囲切り替えが機能しない問題を修正

Fix #8252

- Fix: add instance favicon where it's missing ([#8270](https://github.com/orhun/git-cliff/issues/8270))


- Fix test
- Fix: truncate user drive chart

- Fix: regular expressions in word mutes ([#8254](https://github.com/orhun/git-cliff/issues/8254))

* fix: handle regex exceptions for word mutes

* add i18n strings

Co-authored-by: rinsuki <428rinsuki+git@gmail.com>

* stricter input validation in backend

* add migration for hard mutes

* fix

* use correct regex library in migration

* use query builder to avoid SQL injection

Co-authored-by: Robin B <robflop98@outlook.com>
Co-authored-by: rinsuki <428rinsuki+git@gmail.com>
- Fix(client): word mute cannot save

- Fix(client): ノートの参照を断ち切るように

Fix #8201
Close #8237

- Fix(client): ノート詳細が開けないのを直したり

Fix #8305

- Fix(client): tweak ui

#8311

- Fix(client): フッターでセーフエリアを考慮するように

- Fix(client): 一部環境でサイドバーの投稿ボタンが表示されない問題を修正

- Fix(client): nextTickの中でonUnmounted呼び出しても効かない可能性がある

- Fix(server): stats APIで内部エラーが発生する問題を修正

Fix #8308

- Fix(client): リアクションピッカーの高さが低くなったまま戻らないことがあるのを修正

Fix #8071

- Fix: also recognize "shortcut icon" favicon ([#8220](https://github.com/orhun/git-cliff/issues/8220))

* also recognize "shortcut icon" favicon

Not using querySelector for this because it uses jsdom which might be slower.
Reversing the order because WHATWG says the last appropriate link should be used.

* also fetchIconUrl

* br

* improve readability

* fix

* フォールバックにhrefの評価を含める

* fix val name

* 将来的な拡張を考えたコードにした

Co-authored-by: tamaina <tamaina@hotmail.co.jp>
Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix: better language settings

Fix #8359
Fix #7968

- Fix

- Fix esm

- Fix migrations

Fix #8363

- Fix: use import assertion

- Fix esm

- Fix esm

- Fix esm

- Fix esm

- Fix esm

- Fix esm

- Fix(meta): Adjust path to contribution guidelines ([#8367](https://github.com/orhun/git-cliff/issues/8367))


- Fix(client): ユーザー名オートコンプリートが正しく動作しない問題を修正

- Fix esm

- Fix federation chart pubsub

- Fix query error

- Fix(client): register_note_view_interruptor()が動かないのを修正

Fix #8318

- Fix

- Fix: iPhone X以降(?)でページの内容が全て表示しきれないのを修正 ([#8375](https://github.com/orhun/git-cliff/issues/8375))

* add safe-area-inset-bottom to spacer

* fix

* :v:

* fix
- Fix federation chart

- Fix scroll ([#8382](https://github.com/orhun/git-cliff/issues/8382))


- Fix(server): ulidを使用していると動作しない問題を修正

- Fix(server): dummy image is not served correctly

Fix #8393

- Fix(server): HTMLが正しくレンダリングされない問題を修正

Fix #8392

- Fix API console ([#8416](https://github.com/orhun/git-cliff/issues/8416))

Adjusted the server to send the API description based on the new
API type declarations introduced previously.
- Fix(client): fix popup menu direction calclation

- Fix null in query

- Fix: Handle decodeURIComponent error ([#8411](https://github.com/orhun/git-cliff/issues/8411))


- Fix query

- Fix of client

- Fix(server): add missing import

- Fix(server): admin/meta is not working

Fix #8455

- Fix(federation): avoid duplicate activity delivery ([#8429](https://github.com/orhun/git-cliff/issues/8429))

* prefer shared inbox over individual inbox

* no new shared inbox for direct recipes

* fix type error
- Fix syntax error

- Fix(api): admin/update-meta was not working

- Fix theme-color apply ([#8464](https://github.com/orhun/git-cliff/issues/8464))


- Fix: validation ([#8456](https://github.com/orhun/git-cliff/issues/8456)) ([#8461](https://github.com/orhun/git-cliff/issues/8461))

* Revert "revert 484e023c0"

This reverts commit c03b70c949923b830a6d0361d1aa4d5f5614b7b7.

* also allow pure renote

* fix checks for pure renote
- Fix e2e test

- Fix types

- Fix type

- Fix type

- Fix(api): parameter validation of users/show was wrong

- Fix ogp rendering and refactor

- Fix: アンテナ、クリップ、リストの表示を速くする ([#8518](https://github.com/orhun/git-cliff/issues/8518))

* アンテナノートを取得するクエリがタイムアウトしないように速くする

* テーブル名を直接指定しないようにする

* クリップの取得を速くする

* リストの取得を速くする
- Fix: Fix settings page ([#8508](https://github.com/orhun/git-cliff/issues/8508))

* Fix settings page

* nanka iroiro

* clean up

* clean up

* インデックスに戻ってもタイトルが残ってしまうのを修正
- Fix ogp rendering and refactor

- Fix: アンテナ、クリップ、リストの表示を速くする ([#8518](https://github.com/orhun/git-cliff/issues/8518))

* アンテナノートを取得するクエリがタイムアウトしないように速くする

* テーブル名を直接指定しないようにする

* クリップの取得を速くする

* リストの取得を速くする
- Fix: Promises -> Promise ([#8545](https://github.com/orhun/git-cliff/issues/8545))


- Fix(client): fix lint issues in autocomplete ([#8548](https://github.com/orhun/git-cliff/issues/8548))


- Fix: Add rel attribute to host-meta ([#8583](https://github.com/orhun/git-cliff/issues/8583))

* Add rel attribute to host-meta

* CHANGELOG
- Fix _misskey_content of quote renotes ([#8533](https://github.com/orhun/git-cliff/issues/8533))


- Fix(client): fix missing import of defineAsyncComponent in os.ts

- Fix(client): fix duplicate token request dialog in plugin install ([#8612](https://github.com/orhun/git-cliff/issues/8612))


- Fix (client): fix mention icon height ([#8615](https://github.com/orhun/git-cliff/issues/8615))


- Fix(client): fix lint issues in scripts ([#8621](https://github.com/orhun/git-cliff/issues/8621))


- Fix(client): add setup attribute to notification page ([#8648](https://github.com/orhun/git-cliff/issues/8648))


- Fix: keep file order ([#8659](https://github.com/orhun/git-cliff/issues/8659))


- Fix: ユーザー検索で、クエリがusernameの条件を満たす場合はusernameもLIKE検索するように ([#8644](https://github.com/orhun/git-cliff/issues/8644))

* Fix #8643

* 部分一致にする
- Fix(client): additional background for acrylic popups if unsupported

- Fix(client): remove unexpected token ([#8672](https://github.com/orhun/git-cliff/issues/8672))


- Fix(server): prevent crash when processing certain PNGs

Fix #8605

- Fix: postgres type error

Fix a bug introduced in #8659. Solution was already tested there.

- Fix: ノートのインスタンス情報の文字に縁を付けて見やすくする ([#8697](https://github.com/orhun/git-cliff/issues/8697))

* ノートのインスタンス情報の背景色が反映されないことがあるのを修正する

* ノートのインスタンス情報の文字に縁を付けて見やすくする

* Revert "ノートのインスタンス情報の背景色が反映されないことがあるのを修正する"

This reverts commit de920dfc537d1f2c68804d0d6930520f2b3cbce7.

* ノートのインスタンス情報の文字の影の数を増やしてさらに見やすくする
- Fix: Unable to generate video thumbnails ([#8696](https://github.com/orhun/git-cliff/issues/8696))

* fix: Unable to generate video thumbnails

* CHANGELOG
- Fix(client): fix lint issues in Deck UI components ([#8681](https://github.com/orhun/git-cliff/issues/8681))


- Fix: ノート詳細ページの新しいノートを表示する機能の動作が正しくなるように修正する ([#8607](https://github.com/orhun/git-cliff/issues/8607))

* ノート詳細で新しいノートの表示が正しくないのを修正する

* ノート詳細から別のノート詳細を表示した時に前後の表示をリセットする
- Fix(activitypub): add authorization checks ([#8534](https://github.com/orhun/git-cliff/issues/8534))

* fix spelling

* fix(activitypub): add authorization checks
- Fix(client): make emoji stand out more on reaction button

Fix #8520
Close #8521

Co-Authored-By: Johann150 <20990607+Johann150@users.noreply.github.com>

- Fix(client): fix undefined data value on 2FA settings ([#8725](https://github.com/orhun/git-cliff/issues/8725))


- Fix(client): wrong scoping breaks 2FA
- Fix: wrong type for isVisibleForMe

- Fix: server metrics widget

- Fix: activity widget used wrong variable name

- Fix: assume remote users are following each other ([#8734](https://github.com/orhun/git-cliff/issues/8734))

Misskey does not know if two remote users are following each other.
Because ActivityPub actions would otherwise fail on followers only
notes, we have to assume that two remote users are following each other
when an interaction about a remote note occurs.
- Fix lints ([#8737](https://github.com/orhun/git-cliff/issues/8737))

* fix: emits use ev instead of e

* fix: errors use err instead of e

* fix: replace use of data where possible

* fix: events use evt instead of e

* fix: use strict equals

* fix: use emoji instead of e

* fix: vue lints
- Fix(docs): correct information for drive upload ([#8736](https://github.com/orhun/git-cliff/issues/8736))


- Fix: validate text is not empty

fix #8747
- Fix(client): Vite related boot mechanism revision ([#8753](https://github.com/orhun/git-cliff/issues/8753))

* preload app css

* remove salt

* APP_FETCH_FAILED error

* set max-age to 15s
- Fix(client): fix popout url ([#8494](https://github.com/orhun/git-cliff/issues/8494))


- Fix: add missing import

fix #8756

- Fix(client): import shared ESLint config in client package ([#8761](https://github.com/orhun/git-cliff/issues/8761))


- Fix: always remove completed tasks ([#8771](https://github.com/orhun/git-cliff/issues/8771))


- Fix(mfm): remove duplicate br tag/newline ([#8616](https://github.com/orhun/git-cliff/issues/8616))


- Fix(lint): indentation

- Fix: server metrics widget

- Fix(dev): no labels for l10n_develop
- Fix(client): correctly handle MiAuth URLs with query string ([#8772](https://github.com/orhun/git-cliff/issues/8772))


- Fix(test): reset redis in e2e test

#7986

- Fix: correctly render empty note text ([#8746](https://github.com/orhun/git-cliff/issues/8746))

Ensure that the _misskey_content attribute will always exist. Because
the API endpoint does not require the existence of the `text` field,
that field may be `undefined`. By using `?? null` it can be ensured
that the value is at least `null`.

Furthermore, the rendered HTML of a note with empty text will also be
the empty string. From git blame it seems that this behaviour was added
because of a Mastodon bug that might have previously existed. Hoever,
this seems to be no longer the case as I can find mastodon posts that
have empty content.

The code could be made a bit more succinct by using the null coercion
operator.
- Fix: ensure resolver does not fetch local resources via HTTP(S) ([#8733](https://github.com/orhun/git-cliff/issues/8733))

* refactor: parseUri types and checks

The type has been refined to better represent what it actually is. Uses of
parseUri are now also checking the parsed object type before resolving.

* cannot resolve URLs with fragments

* also take remaining part of URL into account

Needed for parsing the follows URIs.

* Resolver uses DbResolver for local

* remove unnecessary use of DbResolver

Using DbResolver would mean that the URL is parsed and handled again.
This duplicated processing can be avoided by querying the database directly.

* fix missing property name
- Fix: add id for activitypub follows ([#8689](https://github.com/orhun/git-cliff/issues/8689))

* add id for activitypub follows

* fix lint

* fix: follower must be local, followee must be remote

Misskey will only use ActivityPub follow requests for users that are local
and are requesting to follow a remote user. This check is to ensure that
this endpoint can not be used by other services or instances.

* fix: missing import

* render block with id

* fix comment
- Fix test

- Fix bug

- Fix

- Fix http-signature

- Fix

- Fix

- Fix lockfile

- Fix(test): make chart tests working

- Fix: try to prevent autocomplete for emoji search ([#8798](https://github.com/orhun/git-cliff/issues/8798))


- Fix: use autocomplete=new-password ([#8797](https://github.com/orhun/git-cliff/issues/8797))


- Fix(client): render quote renote CWs as MFM ([#8792](https://github.com/orhun/git-cliff/issues/8792))

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix(test): use cypress-io/github-action@v4

- Fix(client): オブジェクトストレージを使用していると画像のクロップができない

- Fix: some fixes of multiple notification read ([#8819](https://github.com/orhun/git-cliff/issues/8819))

* fix: limit multiple notification read

* fix

* fix
- Fix(client): デッキでウィジェットの情報が保存されない問題を修正

Fix #8818

- Fix: missing file name parameter ([#8820](https://github.com/orhun/git-cliff/issues/8820))


- Fix: remove unused parameter

- Fix(docs): use correct description property

- Fix: add limit to i/notifications ([#8836](https://github.com/orhun/git-cliff/issues/8836))

* fix: add limit to i/notifications

* ms

* remove ms
- Fix: tmpdir cleanup removes contained files ([#8826](https://github.com/orhun/git-cliff/issues/8826))


- Fix: GenerateVideoThumbnail ([#8825](https://github.com/orhun/git-cliff/issues/8825))

* fix: GenerateVideoThumbnail

* CHANGELOG

* fix cleanup

* Revert "fix cleanup"

This reverts commit d54cf8262ac01a3deb6b8dd7689ec144d4d09ea8.
- Fix: correctly render note text

Fix a regression from #8787 that was previously fixed in #8440.

- Fix: render empty note content correctly

Instead of coercing to `null`, coercing to an empty string should simplify handling.

- Fix typo

- Fix client

- Fix: block button in federation panel ([#8855](https://github.com/orhun/git-cliff/issues/8855))


- Fix(server): faviconUrl of federated instance is missing

- Fix(client): moderators cannot view instance-info page

- Fix #8861

- Fix(nirax): Normalize path ([#8877](https://github.com/orhun/git-cliff/issues/8877))


- Fix(client): ask to log in for poll vote ([#8883](https://github.com/orhun/git-cliff/issues/8883))


- Fix lints

- Fix(client): ログアウトできない問題を修正

- Fix(client): アカウント作成フォームでエラーが出る問題を修正

- Fix bug

- Fix: always respect instance mutes ([#8854](https://github.com/orhun/git-cliff/issues/8854))

* fix: muted user query also checks instances

This way it can be ensured that the instance mute is used everywhere it
is required without checking the whole codebase again. Muted users and
muted instances should be used together anyways.

* fix lint
- Fix(client): only enable hotkeys for logged in users ([#8793](https://github.com/orhun/git-cliff/issues/8793))

* fix(client): only enable hotkeys for logged in users

* fix(client): keep theme and search hotkeys for logged out users
- Fix notification-setting-window.vue

- Fix(client): remove needless requestLog call

- Fix #8894

- Fix: mocha テストが動かないのを修正 v2 ([#8892](https://github.com/orhun/git-cliff/issues/8892))

* on push

* Fix mute test

* fix note test

* api

* inc timeout

* uploadUrl

* Revert "on push"

This reverts commit 778a58df61ff9a22421f8ec5dcce96b364eab38d.

* lint

* waitFire

* Wrap connectStream

* return
- Fix(api): add missing themeColor property of instance

- Fix(client): fix chart tooltip rendering

- Fix(api): fix instance schema

- Fix(client): 非モデレーターがインスタンス情報ページを表示できない問題を修正

- Fix 'assignment to const' error

- Fix client router catchall

fixes #8903

- Fix(server): cannot show users

- Fix typo

Co-authored-by: mei23 <m@m544.net>

- Fix(client): use unique class names for root to prevent conflicts of style

- Fix(client): fix typo

- Fix(client): フォロワー一覧がフォローににゃっているんだにゃあ

- Fix(client): style tweak for ios

- Fix(client): fix wrong import

- Fix(client): fix wrong import

- Fix typo

- Fix(client): contextmenu of deck not working

- Fix: streamingテストおそい ([#8912](https://github.com/orhun/git-cliff/issues/8912))


- Fix: spellcheck is boolean not string

- Fix: replace use of window

- Fix(lint): semicolong spacing

- Fix lint padded-blocks

- Fix lint no-fallthrough

- Fix lint vue/require-valid-default-prop

- Fix lint: use let instead of const for $ref

Fixes lint no-const-assign.

- Fix lint no-undef

- Fix lint no-prototype-builtins

- Fix lint @typescript-eslint/ban-types

- Fix:typo 「有効する必要…」→「有効にする必要…」 ([#8936](https://github.com/orhun/git-cliff/issues/8936))


- Fix(client): user search of explore not working

- Fix: pagination uses API correctly ([#8925](https://github.com/orhun/git-cliff/issues/8925))


- Fix(client): テーマを作成するとクライアントが起動しなくなる

- Fix prismjs import

fixes #8944

- Prevent default for good enter

- Fix test

- Fix: QueryFailedError when logging user's IPs ([#8973](https://github.com/orhun/git-cliff/issues/8973))

* fix QueryFailedError when logging user's IPs

* use `orIgnore` to fix
- Fix(client): fix style of mention

- Fix(client): fix url encoded string handling of nirax

Fix #8878

- Fix(sw, notification): Don't issue an event if there is no affect ([#8979](https://github.com/orhun/git-cliff/issues/8979))

* test

* ]v]
- Fix: add `es2017` build target ([#8931](https://github.com/orhun/git-cliff/issues/8931))

* remove top level awaits

* add es2017 target

* refactor: use setup and ref sugar
- Fix(client): hide bot protection warning with disabled registrations ([#8794](https://github.com/orhun/git-cliff/issues/8794))

* fix(client): hide bot protection warning with disabled registrations

* Apply review suggestion from @Johann150

Co-authored-by: Johann150 <johann@qwertqwefsday.eu>

Co-authored-by: Johann150 <johann@qwertqwefsday.eu>
Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Fix

- Fix

- Fix

- Fix

- Fix

- Fix

- Fix(client): revert es2017

- Fix(server): fix bind of method

Fix #9006
- Fix(client): デッキUI時に ページで表示 ボタンが機能しない問題を修正

Fix #9010

- Fix(client): fix deck style

- Fix(client): use icon for local if available ([#9012](https://github.com/orhun/git-cliff/issues/9012))


- Fix(client): fix window default prop

- Fix

- Fixed checksum

- Fix reply limit

- Fix(server): make sure `getFileInfo` doesn't fail if `detectSensitivity` ever fails ([#9020](https://github.com/orhun/git-cliff/issues/9020))


- Fix(client): tweak mfm-cheat-sheet

- Fix(client): 「インスタンスからのお知らせを受け取る」の設定を変更できない問題を修正

Fix #8474


### Documentation

- Document.domainをチェックする際に、hostのかわりにhostnameを使うように

- Docs(readme): add Greenkeeper badge
- Docs to run in production mode ([#4347](https://github.com/orhun/git-cliff/issues/4347))

* run in production mode from systemd

* NODE_ENV=production npm run build

* npm start

- Docs

- Doc

- Docker buildでyarn.lockを考慮してなかったのを修正 ([#6330](https://github.com/orhun/git-cliff/issues/6330))


- Doc: add features/word-mute ([#7672](https://github.com/orhun/git-cliff/issues/7672))


- Doc: recursive ([#7893](https://github.com/orhun/git-cliff/issues/7893))


- Docs(README): update image link ([#8383](https://github.com/orhun/git-cliff/issues/8383))



### Features

- Add safety guard to serializers & fix importing uncorrect serializer

- Add 'format' script to use autofix w/ tslint

- Add-file-to-drive - Promise百烈拳とメモリ削減

- Add-file-to-drive - gmに渡す引数を正しくする

- Add-file-to-drive - hashがstreamを受ける時、hashもまたstreamなのだ

- Add-file-to-drive - バッファ受け付けを削除

- Add-file-to-drive - 見通しを良くする

- Add-file-to-drive - 責務の分割とテンポラリファイルを削除するように

- Add mobile.tags.mk-user-timeline.load-more translation

- Added french

- Add feedback link

- Add yarn.lock to gitignore

- Add lock file

- Feature mute on mobile([#2354](https://github.com/orhun/git-cliff/issues/2354))

- Add an endpoint users/lists/update ([#2585](https://github.com/orhun/git-cliff/issues/2585))

* add an endpoint users/lists/update

* add meta params

* fix packing

- Adds ko-KR な to にゃ ([#3820](https://github.com/orhun/git-cliff/issues/3820))

* adds ko-KR な to にゃ
- this only take considers pre-composed "Hangul Syllables",
not composable area "Hangul Jamo" which are not used commonly
- 56 is '냐' - '나'

* replace magic number as suggested

- ✨🌎✨ A federated blogging platform ✨🚀✨

- Add missing image ([#5967](https://github.com/orhun/git-cliff/issues/5967))

fix for explore banner
- Feat(streaming): Add emoji added event

- Feat(client): Implement AiScript scratchpad

- Feat(client): Improve pages aiscript

- Feat(pages): Add arc method

- Feat(pages): Disable AiScript step limitation to improve usability

- Feat(pages): Add rect method

- Feat(pages): Improve chart

- Feat(pages): Improve chart

- Feat(aiscript): Better env vars

- Feat(client): Implement default upload folder setting

Resolve #5985

- Feat(server): Log postgresql version when boot

- Feat(server): Improve boot process

- Feat(client): Make possible to customize sidebar

Resolve #6285

- Feat(client): Reimplement Misskey Rooms

- Feat(client): Implement threaded replies

Resolve #2113
Resolve #5819

- Feat(client): ローカルのみボタンを公開範囲ボタンの横に移動

- Feat(client): :yen:

- Feat(client): 翻訳をIndexedDBに保存・プッシュ通知を翻訳 ([#6396](https://github.com/orhun/git-cliff/issues/6396))

* wip

* tabun ok

* better msg

* oops

* fix lint

* Update gulpfile.ts

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* Update src/client/scripts/set-i18n-contexts.ts

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* refactor

Co-authored-by: acid-chicken <root@acid-chicken.com>

* ✨

* wip

* fix lint

* たぶんおk

* fix flush

* Translate Notification

* remove console.log

* fix

* add notifications

* remove san

* wip

* ok

* :v:

* Update src/prelude/array.ts

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* wip

* i18n refactor

* Update init.ts

* :v:

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
Co-authored-by: syuilo <syuilotan@yahoo.co.jp>
- Feat(client): 自動でもっと見るオプション ([#6403](https://github.com/orhun/git-cliff/issues/6403))

* wip

* ugokanai

* wip

* implement setting subscribing

* fix lint

* :v:

* Update notifications.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Feat(client): Convert text mfm node to text (v)dom node instead of span tag ([#6399](https://github.com/orhun/git-cliff/issues/6399))

* Convert text mfm node to text (v)dom node
instead of span tag

* Update mfm.ts

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Feat(client): 投稿フォームのボタンの説明を表示するように ([#6408](https://github.com/orhun/git-cliff/issues/6408))

* Add title attr with buttons on the post form

* fix

* tooltip

* missing ;

* remove title attr

* fix bug

* Update reactions-viewer.details.vue

* help wip

* ok!

* i18n

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Feat: Observe notification read and fix #6406 ([#6407](https://github.com/orhun/git-cliff/issues/6407))

* Resolve https://github.com/syuilo/misskey/pull/6406#issuecomment-633203670

* Improve typing

* Observe notification read

* capture readAllNotifications

* fix

* fix

* Refactor

* Update src/client/components/notification.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

* Update src/client/components/notification.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

* missing ;

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Feat(theme): Add mentionMe property

- Feat(client): Do not wrap widgets

- Feat(client): ウィジェットを左にも置けるように

- Feat(client): ウィジェットを画面スクロールに連動させるオプション

- Feat(client): Add sound :musical_note:

- Feat(client): ミューテーション監視をやめてページリロードするように

- Feat(client): 無限にダイアログを出すように

Resolve #6525

- Feat(client): Remove ResizeObserver polyfill

- Feat(client): blur effect for modal

- Feat(client): Add sounds :musical_note:

- Feat(client): Deckでマウスホイールを使って横スクロールできるように

- Feat(client): 設定画面を整理

- Feat: トークン手動発行機能

- Feat(client): AiScriptプラグインからAPIアクセスできるように

- Feat: Blurhash integration

Resolve #6559

- Feat(client): Federation widget

Resolve #6544

- Feat(client): Implement federation widget chart

- Feat(server): Fetch icon url of an instance ([#6591](https://github.com/orhun/git-cliff/issues/6591))

* feat(server): Fetch icon url of an instance

Resolve #6589

* chore: Rename the function
- Feat(client): Display instance icon

- Feat(client): プラグインを無効にできるように

- Feat(client): AiScript: ノート書き換えAPI

- Feat(client): AiScript: Plugin:open_url function

- Feat(client): Plugin:register_note_post_interruptor API

- Feat(client): プラグインの設定にdescriptionを表示できるように

- Feat(client): プラグインのIDを不要に

- Add note

- Add doc

- Add note

- Add note

- Feat: video play inline (using video tag) ([#7242](https://github.com/orhun/git-cliff/issues/7242))


- Add test

- Add note

- Add note

- Add note

- Add animation

- Feat(client): Misskey更新時にダイアログを表示するように

- Add sound

- Feat(client): ジョブキューウィジェットに警報音を鳴らす設定を追加

- Feat: ノートの翻訳機能

Resolve #5213

- Feat: Implement api sw/unregister ([#7611](https://github.com/orhun/git-cliff/issues/7611))

* Implement api sw/unregister

* remove all mode

* add changelog

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Add setting to keep content warning ([#7682](https://github.com/orhun/git-cliff/issues/7682))


- Feat: リモートからユーザー削除が飛んできたら削除するように ([#7768](https://github.com/orhun/git-cliff/issues/7768))

* Delete Actor

* Update src/remote/activitypub/kernel/delete/actor.ts

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Add sponsors section

- Add resolver check for blocked instance ([#7777](https://github.com/orhun/git-cliff/issues/7777))

* add resolver check for blocked instance

* lint

* Update note.ts
- Feat: 凍結された場合のダイアログを実装 ([#7811](https://github.com/orhun/git-cliff/issues/7811))

* feat: 凍結された場合のダイアログを実装

* Update CHANGELOG.md

* Update basic.js

* improve error handling

* cypressなんもわからん

* Update basic.js
- Feat(server): 管理者用アカウント削除API実装

動作確認済み
Resolve #7735

- Feat: MFM Sparkle animation ([#7813](https://github.com/orhun/git-cliff/issues/7813))

* Add sparkle mfm animation ✨

* Cleanup sparkle effect

+ spaces -> tabs and other codestyle
+ use proper image
+ listen for resizes
+ use font-size to determine particle size (for fun with x2/3/4 stacking)
- Feat(client): MFM関数構文のサジェストを実装

- Add todo
- Feat: アカウント作成にメールアドレス必須にするオプション ([#7856](https://github.com/orhun/git-cliff/issues/7856))

* feat: アカウント作成にメールアドレス必須にするオプション

* ui

* fix bug

* fix bug

* fix bug

* :art:
- Feat: 未読の通知のみ表示する機能

- Feat(client): 通知ページで通知の種類によるフィルタ

- Feat(client): add new theme

- Feat(client): add some theme functions

- Feat: ノートプレビューを追加 ([#7596](https://github.com/orhun/git-cliff/issues/7596))

* add note preview

* use if

* add draftedNote property

* custom emojis work

* Only show CW on preview when enabled

* move button to top

* fix css style
- Feat(api): add users/groups/leave

Resolve #7775

- Feat: ユーザーのリアクション一覧を見れるように

- Feat: ミュートとブロックのインポート

Resolve #7885

- Feat(client): メンションにユーザーのアバターを表示するように

Resolve #350

- Feat(client): Improve image viewer

Resolve #7545
Resolve #6811
Close #7808

- Feat: thread mute ([#7930](https://github.com/orhun/git-cliff/issues/7930))

* feat: thread mute

* chore: fix comment

* fix test

* fix

* refactor
- Feat: クライアントでログインするアカウントidを指定するクエリ(loginId=:userId) ([#7929](https://github.com/orhun/git-cliff/issues/7929))

* feat: ログインするアカウントのIDをクエリ文字列で指定する機能

* await?

* rename
- Add some locales

Resolve #7940

- Feat: make possible to configure following/followers visibility ([#7959](https://github.com/orhun/git-cliff/issues/7959))

* feat: make possible to configure following/followers visibility

* add test

* ap

* add ap test

* set Cache-Control

* hide following/followers count
- Feat: improve email validation

- Feat: インスタンスプロフィールレンダリング

Resolve #7788

- Feat(client): 通知のリアクションアイコンをホバーで拡大できるように

- Add install/build scripts

- Add clean script

- Feat: 通報があったときに管理者へEメールで通知されるように

Resolve #7025

- Add alias to improve compatibility

- Feat(client): アカウント削除に確認ダイアログを出すように

- Feat(client): collapse sub note automatically

- Feat(client): keep line breaks of translated text to improve readability

- Feat(client): show confirm dialog when vote

- Feat(client): Renoteなノート詳細ページから元のノートページに遷移できるように

- Add todo

- Feat: Undo Accept ([#7980](https://github.com/orhun/git-cliff/issues/7980))

* allow breaking of follow

* send undo

* delete by using reject follow
- Add note

- Feat: user-level instance mute ([#7712](https://github.com/orhun/git-cliff/issues/7712))

* Update ja-JP.yml

* Added settable config for muted instances

* added psql query for removal of muted notes

* Added filtering and trimming for instance mutes

* cleaned up filtering of bad instance mutes and added a refresh at the end for the list on the client

* Added notification & streaming timeline muting

* Updated changelog

* Added missing semicolon

* Apply japanese string suggestions from robflop

Co-authored-by: Robin B. <robflop98@outlook.com>

* Changed Ja-JP instance mute title string to one suggested by sousuke

Co-authored-by: sousuke0422 <sousuke20xx@gmail.com>

* Update ja-JP instanceMuteDescription based on sousuke's suggestion

Co-authored-by: sousuke0422 <sousuke20xx@gmail.com>

* added notification mute

* added notification and note children muting

* Fixed a bug where local notifications were getting filtered on cold start

* Fixed instance mute imports

* Fixed not saving/loading instance mutes

* removed en-US translations for instance mute

* moved instance mute migration to js

* changed settings index back to spaces

* removed destructuring assignment from notification stream in instance mute check call

Co-authored-by: tamaina <tamaina@hotmail.co.jp>

* added .note accessor for checking note data instead of notification data

* changed note to use Packed<'Note'> instead of any and removed usage of snake case

Co-authored-by: tamaina <tamaina@hotmail.co.jp>

* changed notification mute check to check specifically for notification host

* changed to using single quotes

* moved @click to the end for the linter

* revert unnecessary changes

* restored newlines

* whitespace removal

Co-authored-by: syuilo <syuilotan@yahoo.co.jp>
Co-authored-by: Robin B. <robflop98@outlook.com>
Co-authored-by: sousuke0422 <sousuke20xx@gmail.com>
Co-authored-by: puffaboo <emilis@jigglypuff.club>
Co-authored-by: tamaina <tamaina@hotmail.co.jp>
- Feat: improve follow export

- Feat: カスタム絵文字エクスポート

- Feat(client): improve toast component and show welcome message

- Feat(client): svg sparkle effect

Resolve #8088

- Feat: multiple emojis editing

- Feat: emojis import

- Feat(server): store mime type of webpublic

- Feat(server): add more metadata for emoji export

- Feat: increase files limit for note

#8062

- Feat(client): make possible to switch account instantly in post form

- Add todo

- Feat(client): 連合インスタンスページからインスタンス情報再取得を行えるように

Resolve #8231

- Add eslint rule

- Feat: Option to show replies in timeline ([#7685](https://github.com/orhun/git-cliff/issues/7685)) ([#8202](https://github.com/orhun/git-cliff/issues/8202))

* Add an option for timeline replies. Credit to Emilis (puffaboo)

* update db on request
- Feat(client): 自インスタンス情報ページでチャートを見れるように

- Feat(client): デバイスの種類を手動指定できるように

- Feat: notes/instance/perUserNotesチャートに添付ファイル付きノートの数を追加

- Feat: improve federation chart

- Feat: introduce intersection calculation of charts

- Feat(client): update fontawesome v6 and self-hosting

Resolve #7475

- Feat: インスタンスのテーマカラーを設定できるように

- Feat(client): make size of reaction picker configuable

- Add sk-SK lang to locales/index.js ([#8325](https://github.com/orhun/git-cliff/issues/8325))


- Feat: add pub & sub item for federation chart

- Feat: instance default theme

- Feat(client): indicate dev build

- Feat: 時限ミュート

#7677

- Feat: アンケート終了通知

Resolve #4664

- Feat: add active to federation chart

- Feat: use instance icon for splash screen

- Feat: introduce bull dashboard

- Feat: Webhook ([#8457](https://github.com/orhun/git-cliff/issues/8457))

* feat: introduce webhook

* wip

* wip

* wip

* Update CHANGELOG.md
- Add x,y parameters to rotate MFM

- Add perspective

- Feat: Improve Push Notification ([#7667](https://github.com/orhun/git-cliff/issues/7667))

* clean up

* ev => data

* refactor

* clean up

* add type

* antenna

* channel

* fix

* add Packed type

* add PackedRef

* fix lint

* add emoji schema

* add reversiGame

* add reversiMatching

* remove signin schema (use Signin entity)

* add schemas refs, fix Packed type

* wip PackedHoge => Packed<'Hoge'>

* add Packed type

* note-reaction

* user

* user-group

* user-list

* note

* app, messaging-message

* notification

* drive-file

* drive-folder

* following

* muting

* blocking

* hashtag

* page

* app (with modifying schema)

* import user?

* channel

* antenna

* clip

* gallery-post

* emoji

* Packed

* reversi-matching

* update stream.ts

* https://github.com/misskey-dev/misskey/pull/7769#issuecomment-917542339

* fix lint

* clean up?

* add app

* fix

* nanka iroiro

* wip

* wip

* fix lint

* fix loginId

* fix

* refactor

* refactor

* remove follow action

* clean up

* Revert "remove follow action"

This reverts commit defbb416480905af2150d1c92f10d8e1d1288c0a.

* Revert "clean up"

This reverts commit f94919cb9cff41e274044fc69c56ad36a33974f2.

* remove fetch specification

* renoteの条件追加

* apiFetch => cli

* bypass fetch?

* fix

* refactor: use path alias

* temp: add submodule

* remove submodule

* enhane: unison-reloadに指定したパスに移動できるように

* null

* null

* feat: ログインするアカウントのIDをクエリ文字列で指定する機能

* null

* await?

* rename

* rename

* Update read.ts

* merge

* get-note-summary

* fix

* swパッケージに

* add missing packages

* fix getNoteSummary

* add webpack-cli

* :v:

* remove plugins

* sw-inject分離したがテストしてない

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* fix

* :v:

* clean up config

* typesを戻した

* Update packages/client/src/components/notification.vue

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* disconnect

* oops

* Failed to load the script unexpectedly回避
sw.jsとlib.tsを分離してみた

* truncate notification

* Update packages/client/src/ui/_common_/common.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

* clean up

* clean up

* キャッシュ対策

* Truncate push notification message

* クライアントがあったらストリームに接続しているということなので通知しない判定の位置を修正

* components/drive-file-thumbnail.vue

* components/drive-select-dialog.vue

* components/drive-window.vue

* merge

* fix

* Service Workerのビルドにesbuildを使うようにする

* return createEmptyNotification()

* fix

* i18n.ts

* update

* :v:

* remove ts-loader

* fix

* fix

* enhance: Service Workerを常に登録するように

* pollEnded

* URLをsw.jsに戻す

* clean up

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Feat: make captcha required when signin to improve security

- Feat(dev): okteto integration

- Feat(dev): introduce Pull Request Labeler

- Feat(dev): highlight editing of wrong locales

Highlight PRs that edit locales other than the ja-JP one so the author may see and fix it themselves.
- Feat(tests): add e2e tests for widgets ([#8735](https://github.com/orhun/git-cliff/issues/8735))

* test(e2e): add baseline for widget tests

* chore(repo): enable test running in branch

* fix(e2e): set viewport for widget tests

* fix(client): add widget identifier classes to widgets

* test(e2e): add memo widget test

* fix(tests): force select value

* fix(tests): force button press for widget addition

* fix(tests): invoke select value differently

* fix(tests): adjust widget submit

* fix(tests): don't explicitly navigate for widget test

* fix(tests): click label to hide select popup

* fix(tests): just click modal background

* fix(tests): adjust modal background selector

* fix(tests): click all modal backgrounds

* feat(e2e): add test for adding timeline widget

* fix(client): add more widget identifier classes

* feat(tests): add method abstraction for test cases

* fix(tests): force-click overlays

* fix(tests): force widget button press

* fix(tests): remove timeout from final widget check

* feat(tests): add widget removal test case

* fix(client): use mk instead of msky as class prefix

* fix(tests): check widgets for existence rather than visibility

* chore(meta): don't run tests for specific feature branch
- Add @rollup/pluginutils

- Add packageExtensions for chartjs_date-fns

Co-authored-by: acid-chicken <root@acid-chicken.com>

- Feat: option to collapse long notes ([#8561](https://github.com/orhun/git-cliff/issues/8561))

* feat: option to collapse long notes

Closes #8559

* do not collapse if cw exists

* use '閉じる' to close / show less.

* make it sticky

* Change style of the Show less button
- Add packageExtensions

- Feat: image cropping ([#8808](https://github.com/orhun/git-cliff/issues/8808))

* wip

* wip

* wip
- Feat: Add Badge Image to Push Notification ([#8012](https://github.com/orhun/git-cliff/issues/8012))

* fix

* nanka iroiro

* wip

* wip

* fix lint

* fix loginId

* fix

* refactor

* refactor

* remove follow action

* clean up

* Revert "remove follow action"

This reverts commit defbb416480905af2150d1c92f10d8e1d1288c0a.

* Revert "clean up"

This reverts commit f94919cb9cff41e274044fc69c56ad36a33974f2.

* remove fetch specification

* renoteの条件追加

* apiFetch => cli

* bypass fetch?

* fix

* refactor: use path alias

* temp: add submodule

* remove submodule

* enhane: unison-reloadに指定したパスに移動できるように

* null

* null

* feat: ログインするアカウントのIDをクエリ文字列で指定する機能

* null

* await?

* rename

* rename

* Update read.ts

* merge

* get-note-summary

* fix

* swパッケージに

* add missing packages

* fix getNoteSummary

* add webpack-cli

* :v:

* remove plugins

* sw-inject分離したがテストしてない

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* fix

* :v:

* clean up config

* typesを戻した

* backend/src/web/index.ts

* notification-badges

* add scripts

* change create-notification.ts

* Update packages/client/src/components/notification.vue

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* disconnect

* oops

* Failed to load the script unexpectedly回避
sw.jsとlib.tsを分離してみた

* truncate notification

* Update packages/client/src/ui/_common_/common.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

* clean up

* clean up

* refactor

* キャッシュ対策

* Truncate push notification message

* fix

* クライアントがあったらストリームに接続しているということなので通知しない判定の位置を修正

* components/drive-file-thumbnail.vue

* components/drive-select-dialog.vue

* components/drive-window.vue

* merge

* fix

* Service Workerのビルドにesbuildを使うようにする

* return createEmptyNotification()

* fix

* fix

* i18n.ts

* update

* :v:

* remove ts-loader

* fix

* fix

* enhance: Service Workerを常に登録するように

* pollEnded

* pollEnded

* URLをsw.jsに戻す

* clean up

* fix lint

* changelog

* alpha-test

* also with twemoji

* add isMimeImage function

* catch

* Colour => Color

* char2file => char2filePath

* Update autocomplete.vue

* remove clone?

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Feat: 管理者が特定ユーザーのアップロードしたファイル一覧を見れるように

- Feat: allow GET for some endpoints

Resolve #8263

- Feat: make possible to delete an account by admin

Resolve #8830

- Feat(api): add federation/stats endpoint

- Feat(client): add instances doughnuts charts for dashboard

- Feat(client): add tag cloud component

- Feat(client): add instance-cloud widget

- Feat(client): add rss-marquee widget

- Feat(client): poll highlights in explore page

- Feat: Log user ips ([#8872](https://github.com/orhun/git-cliff/issues/8872))

* wip

* store ip and headers

* Update admin-file.vue

* require admin for view ip/headers

* IP (recent) 消した

* admin必須

* opt in

* clean ips periodically

* respect logging setting in drive/files/create
- Feature(client): Timeline page for non-login users
- Feat(server): add fetch-rss api to reduce dependency of external apis

- Feat: moderation note

- Feat(client): status bar (experimental)

- Feat: styled error screen ([#8930](https://github.com/orhun/git-cliff/issues/8930))

* Styled error screen

* Make details margin auto

* Update boot.css

* Replace fontawesome with tabler svg

* Remove hr

* Add new style to flush screen

* Rename to `error.css`
- Feat(client): メニューからページをリロードできるように

- Feat: auto nsfw detection ([#8840](https://github.com/orhun/git-cliff/issues/8840))

* feat: auto nsfw detection

* :v:

* Update ja-JP.yml

* Update ja-JP.yml

* ポルノ判定のしきい値を高めに

* エラーハンドリングちゃんとした

* Update ja-JP.yml

* 感度設定を強化

* refactor

* feat: add video support for auto nsfw detection

* rename: image -> media

* .js

* fix: add missing error handling

* fix: use valid pathname instead of using filename due to invalid usage

* perf(nsfw-detection): decode frames

* disable detection of video for some reasons

* perf(nsfw-detection): streamify detection process for video

* disable disallowUploadWhenPredictedAsPorn option

* fix(nsfw-detection): improve reliability

* fix(nsfw-detection): use Math.ceil instead of Math.round

* perf(nsfw-detection): delete tmp frames after used

* fix(nsfw-detection): FSWatcher does not emit ready event

* perf(nsfw-detection): skip black frames

* refactor: strip exists check

* Update package.json

* めっちゃ変えた

* lint

* Update COPYING

* オプションで動画解析できるように

* Update yarn.lock

* Update CHANGELOG.md

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
- Feat: support <plain> syntax for mfm

- Feat(client): registry editor

- Add OAuth 2.0 Bearer Token authentication


### Miscellaneous Tasks

- Update warn message

- Update log message

- Chore(package): update dependencies

https://greenkeeper.io/

- Chore(package): update @types/body-parser to version 1.16.2

https://greenkeeper.io/

- Chore(package): update gulp-mocha to version 4.2.0

https://greenkeeper.io/

- Chore(package): update @types/webpack to version 2.2.13

https://greenkeeper.io/

- Chore(package): update tslint to version 5.0.0

https://greenkeeper.io/

- Chore(package): update css-loader to version 0.28.0

https://greenkeeper.io/

- Chore(package): update @types/webpack to version 2.2.14

https://greenkeeper.io/

- Chore(package): update @types/body-parser to version 1.16.3

https://greenkeeper.io/

- Chore(package): update gulp-mocha to version 4.3.0

https://greenkeeper.io/

- Chore(package): update webpack to version 2.3.3

https://greenkeeper.io/

- Chore(package): update @types/mongodb to version 2.1.42

https://greenkeeper.io/

- Chore(package): update @types/mongodb to version 2.1.43

https://greenkeeper.io/

- Chore(package): update @types/chai to version 3.5.0

https://greenkeeper.io/

- Chore(package): update gulp-tslint to version 8.0.0

https://greenkeeper.io/

- Chore(package): update tslint to version 5.1.0

https://greenkeeper.io/

- Chore(package): update webpack to version 2.4.1

Closes #413

https://greenkeeper.io/

- Chore(package): update @types/chai to version 3.5.1

https://greenkeeper.io/

- Chore(package): update @types/js-yaml to version 3.5.30

https://greenkeeper.io/

- Chore(package): update mocha to version 3.3.0

https://greenkeeper.io/

- Chore(package): update @types/webpack to version 2.2.15

https://greenkeeper.io/

- Chore(package): update @types/mongodb to version 2.2.0

https://greenkeeper.io/

- Chore(package): update gulp-mocha to version 4.3.1

https://greenkeeper.io/

- Chore(package): update @types/inquirer to version 0.0.34

https://greenkeeper.io/

- Chore(package): update @types/mocha to version 2.2.41

https://greenkeeper.io/

- Chore(package): update @types/gulp-typescript to version 2.13.0

https://greenkeeper.io/

- Chore(package): update @types/chai to version 3.5.2

https://greenkeeper.io/

- Chore(package): update swagger-jsdoc to version 1.9.3

https://greenkeeper.io/

- Chore(package): update @types/mongodb to version 2.2.2

Closes #440

https://greenkeeper.io/

- Chore(package): update css-loader to version 0.28.1

https://greenkeeper.io/

- Chore(package): update swagger-jsdoc to version 1.9.4
- Chore(package): update tslint to version 5.2.0
- Chore(package): update webpack to version 2.5.0
- Chore(package): update @types/request to version 0.0.43
- Chore(package): update webpack to version 2.5.1
- Chore(package): update mocha to version 3.4.1
- Chore(package): update @types/gulp to version 4.0.3
- Chore(package): update gulp-uglify to version 3.0.0
- Chore(package): update css-loader to version 0.28.2
- Chore(package): update webpack to version 2.6.0
- Chore(package): update tslint to version 5.3.0
- Chore(package): update tslint to version 5.3.2
- Chore(package): update gulp-tslint to version 8.1.0
- Chore(package): update mocha to version 3.4.2
- Chore(package): update gulp-typescript to version 3.1.7
- Chore(package): update webpack to version 2.6.1
- Chore(package): update css-loader to version 0.28.3
- Chore(package): update uglify-es to version 3.0.13
- Chore(package): update css-loader to version 0.28.4
- Chore(package): update gulp-imagemin to version 3.3.0
- Chore(package): update uglify-es to version 3.0.14
- Chore(package): update @types/chai to version 4.0.0
- Chore(package): update @types/node to version 7.0.23
- Chore(package): update uglify-es to version 3.0.15
- Chore(package): update @types/node to version 7.0.24
- Chore(package): update @types/redis to version 2.6.0
- Chore(package): update @types/multer to version 0.0.34
- Chore(package): update @types/uuid to version 3.0.0
- Chore(package): update @types/webpack-stream to version 3.2.7
- Chore(package): update @types/gm to version 1.17.31
- Chore(package): update @types/node to version 7.0.27

Closes #523
- Chore(package): update style-loader to version 0.18.2
- Chore(package): update gulp-tslint to version 8.1.1
- Chore(package): update chai to version 4.0.2
- Chore(package): update @types/mongodb to version 2.2.3
- Chore(package): update @types/gulp to version 4.0.4
- Chore(package): update @types/node to version 7.0.28
- Chore(package): update tslint to version 5.4.3
- Chore(package): update @types/node to version 7.0.29
- Chore(package): update @types/mongodb to version 2.2.4
- Chore(package): update @types/node to version 7.0.31
- Chore(package): update uglify-es to version 3.0.17
- Chore(package): update @types/express to version 4.0.36
- Chore(package): update @types/multer to version 1.3.1
- Chore(package): update @types/request to version 0.0.44
- Chore(package): update @types/mongodb to version 2.2.6
- Chore(package): update @types/webpack to version 2.2.16
- Chore(package): update uglify-es to version 3.0.18
- Chore(package): update @types/multer to version 1.3.2
- Chore(package): update gulp-replace to version 0.6.0
- Chore(package): update gulp-replace to version 0.6.1
- Chore(package): update uglify-es to version 3.0.19
- Chore(package): update @types/body-parser to version 1.16.4
- Chore(package): update @types/node to version 8.0.2

Closes #567
- Chore(package): update @types/chai to version 4.0.1
- Chore(package): update @types/webpack to version 3.0.0
- Chore(package): update swagger-jsdoc to version 1.9.5
- Chore(package): update uglify-es to version 3.0.20
- Chore(package): update @types/node to version 8.0.3
- Chore(package): update @types/elasticsearch to version 5.0.14
- Chore(package): update @types/node to version 8.0.4
- Chore(package): update @types/request to version 0.0.45
- Chore(package): update @types/node to version 8.0.5
- Chore(package): update @types/webpack to version 3.0.1
- Chore(package): update @types/websocket to version 0.0.34
- Chore(package): update uglify-es to version 3.0.21
- Chore(package): update @types/node to version 8.0.6
- Chore(package): update uglify-es to version 3.0.22
- Chore(package): update @types/mongodb to version 2.2.7
- Chore(package): update @types/node to version 8.0.7
- Chore(package): update uglify-es to version 3.0.23
- Chore(package): update tslint to version 5.5.0
- Chore(package): update @types/node to version 8.0.8
- Chore(package): update webpack to version 3.1.0
- Chore(package): update gulp-typescript to version 3.2.0
- Chore(package): update @types/node to version 8.0.9
- Chore(package): update @types/webpack to version 3.0.2
- Chore(package): update uglify-es to version 3.0.24

Closes #602
- Chore(package): update @types/js-yaml to version 3.9.0
- Chore(package): update @types/webpack to version 3.0.4

Closes #616
- Chore(package): update swagger-jsdoc to version 1.9.6
- Chore(package): update chai to version 4.1.0
- Chore(package): update @types/chai-http to version 3.0.0
- Chore(package): update webpack to version 3.3.0

Closes #620
- Chore(package): update gulp-typescript to version 3.2.1
- Chore(package): update @types/uuid to version 3.4.0
- Chore(package): update @types/node to version 8.0.14

Closes #615
- Chore(package): update @types/request to version 2.0.0

Closes #622
- Chore(package): update uglify-es-webpack-plugin to version 0.0.3
- Chore(package): update @types/webpack to version 3.0.5
- Chore(package): update swagger-jsdoc to version 1.9.7
- Chore(package): update @types/riot to version 3.6.0
- Chore(package): update uglify-es-webpack-plugin to version 0.10.0
- Chore(package): update webpack to version 3.4.1

Closes #645
- Chore(package): update @types/node to version 8.0.17

Closes #637
- Chore(package): update @types/mongodb to version 2.2.8
- Chore(package): update mocha to version 3.5.0
- Chore(package): update @types/chai to version 4.0.2
- Chore(package): update @types/gm to version 1.17.32
- Chore(package): update @types/mongodb to version 2.2.9
- Chore(package): update @types/node to version 8.0.19

Closes #656
- Chore(package): update @types/debug to version 0.0.30
- Chore(package): update chai to version 4.1.1
- Chore(package): update tslint to version 5.6.0
- Chore(package): update gulp-tslint to version 8.1.2
- Chore(package): update @types/node to version 8.0.20
- Chore(package): update webpack to version 3.5.2

Closes #668
- Chore(package): update @types/rimraf to version 2.0.0
- Chore(package): update @types/webpack to version 3.0.7

Closes #665
- Chore(package): update @types/chai-http to version 3.0.1 ([#661](https://github.com/orhun/git-cliff/issues/661))


- Chore(package): update webpack to version 3.5.3
- Chore(package): update @types/webpack to version 3.0.8
- Chore(package): update @types/chai-http to version 3.0.2
- Chore(package): update @types/chai to version 4.0.3
- Chore(package): update webpack to version 3.5.4
- Chore(package): update @types/request to version 2.0.1
- Chore(package): update @types/webpack to version 3.0.9
- Chore(package): update @types/js-yaml to version 3.9.1
- Chore(package): update webpack to version 3.5.5
- Chore(package): update css-loader to version 0.28.5
- Chore(package): update @types/node to version 8.0.24

Closes #689
- Chore(package): update @types/mongodb to version 2.2.10
- Chore(package): update @types/bcryptjs to version 2.4.1
- Chore(package): update @types/body-parser to version 1.16.5
- Chore(package): update @types/chai to version 4.0.4
- Chore(package): update @types/compression to version 0.0.34
- Chore(package): update @types/deep-equal to version 1.0.1
- Chore(package): update @types/event-stream to version 3.3.32
- Chore(package): update @types/express to version 4.0.37
- Chore(package): update @types/mocha to version 2.2.42
- Chore(package): update @types/monk to version 1.0.6
- Chore(package): update @types/ms to version 0.7.30
- Chore(package): update @types/request to version 2.0.2
- Chore(package): update @types/rimraf to version 2.0.2

Closes #697
- Chore(package): update @types/serve-favicon to version 2.2.29
- Chore(package): update @types/uuid to version 3.4.1
- Chore(package): update gulp-typescript to version 3.2.2
- Chore(package): update @types/webpack to version 3.0.10
- Chore(package): update @types/node to version 8.0.25
- Chore(package): update @types/request to version 2.0.3
- Chore(package): update tslint to version 5.7.0
- Chore(package): update @types/mongodb to version 2.2.11
- Chore(package): update @types/node to version 8.0.26
- Chore(package): update css-loader to version 0.28.7

Closes #750
- Chore(package): update chai to version 4.1.2
- Chore(package): update @types/chai-http to version 3.0.3
- Chore(package): update @types/uuid to version 3.4.2
- Chore(package): update webpack to version 3.5.6
- Chore(package): update @types/node to version 8.0.27
- Chore(package): update @types/mocha to version 2.2.43
- Chore(package): update @types/node to version 8.0.28
- Chore(package): update mocha to version 3.5.2

Closes #777
- Chore(package): update mocha to version 3.5.3
- Chore(package): update webpack to version 3.6.0
- Chore(package): update @types/morgan to version 1.7.33
- Chore(package): update @types/webpack to version 3.0.11
- Chore(package): update @types/node to version 8.0.29
- Chore(package): update @types/node to version 8.0.30
- Chore(package): update @types/webpack to version 3.0.12
- Chore(package): update @types/node to version 8.0.31
- Chore(package): update @types/elasticsearch to version 5.0.17

Closes #698
- Chore(package): update style-loader to version 0.19.0
- Chore(package): update @types/mongodb to version 2.2.12
- Chore(package): update @types/node to version 8.0.32
- Chore(package): update @types/webpack to version 3.0.13
- Chore(package): update @types/request to version 2.0.4
- Chore(package): update mocha to version 4.0.1

Closes #810
- Chore(package): update gulp-imagemin to version 3.4.0
- Chore(package): update @types/mongodb to version 2.2.13
- Chore(package): update @types/node to version 8.0.33
- Chore(package): update webpack to version 3.7.0
- Chore(package): update webpack to version 3.7.1
- Chore(package): update @types/gm to version 1.17.33
- Chore(package): update webpack to version 3.8.1

Closes #831
- Chore(package): update @types/uuid to version 3.4.3
- Chore(package): update tslint to version 5.8.0
- Chore(package): update gulp-typescript to version 3.2.3
- Chore(package): update uglifyjs-webpack-plugin to version 1.0.1

Closes #841
- Chore(package): update @types/gulp to version 4.0.5
- Chore(package): update @types/gulp-uglify to version 3.0.3

Closes #664
- Chore(package): update @types/mongodb to version 2.2.15

Closes #836
- Chore(package): update @types/node to version 8.0.47

Closes #822
- Chore(package): update @types/riot to version 3.6.1
- Chore(package): update @types/webpack to version 3.0.14
- Chore(package): update @types/webpack-stream to version 3.2.8
- Chore(package): update @types/request to version 2.0.7

Closes #827
- Chore(package): update @types/gulp-util to version 3.0.33

Closes #846
- Chore(package): update @types/chalk to version 2.2.0
- Chore(package): update @types/mocha to version 2.2.44
- Chore(package): update @types/body-parser to version 1.16.7

Closes #843
- Chore(package): update @types/express to version 4.0.39

Closes #844
- Chore(package): update @types/morgan to version 1.7.35

Closes #847
- Chore(package): update @types/multer to version 1.3.5

Closes #725
- Chore(package): update @types/redis to version 2.8.1

Closes #829
- Chore(package): update awesome-typescript-loader to version 3.3.0
- Update @prezzemolo/rap to 0.1.1

- Update @prezzemolo/rap to 0.1.2

- Update test for GridFS

- Chore(package): update @types/webpack to version 3.8.0
- Chore(package): update @types/node to version 8.0.49

Closes #878
- Chore(package): update uglify-es to version 3.1.8

Closes #602
- Chore(package): update @types/node to version 8.0.53

Closes #885
- Chore(package): update awesome-typescript-loader to version 3.4.0
- Chore(package): update uglifyjs-webpack-plugin to version 1.1.0
- Update license tip
- Chore(package): update dependencies
- Chore: Update backers

- UpdatePersonで再割り当てを考慮する

- UpdatePersonを試行した時点でもlastFetchedAtを更新する ([#4510](https://github.com/orhun/git-cliff/issues/4510))


- Update token generation

- UpdateHashtagを並列で行わないように ([#5284](https://github.com/orhun/git-cliff/issues/5284))


- Chore: Update commands

- Chore: Update dependencies :rocket:

- Chore(client): :art:

- Chore(client): :art:

- Chore: update deps

- Chore: Update dep

- Chore(client): :art:

- Chore(client): :art:

- Chore: Update dep

- Chore: Update deps

- Chore: :art:

- Chore: Update dep

- Chore: Update deps

- Chore: Update dep

- Chore(docker): Use postgresql 12

- Chore(docker): Use node 14

- Chore(server): Add TODO

- Chore: Use kebab-case for file names

- Chore: Update dependencies :rocket:

- Chore: Update deps :rocket:

- Chore: Update typescript to 3.9

- Chore: Use node 14.2

- Chore: Use actions/checkout@v2 ([#6328](https://github.com/orhun/git-cliff/issues/6328))


- Chore: Update deps :rocket:

- Chore(lint): Update rule

- Chore(lint): Add semicolon rule

- Chore(lint): Add missing semicolon

- Chore(client): :art:

- Chore(lint): Add missing semicolons

- Chore(lint): Add missing semicolon

- Chore(locale): Add doll-ai translation

- Chore(deps): Update dependencies :rocket:

- Chore(deps): Update dependencies :rocket:

- Chore(src/docs): Fix miauth check url

Fix #6418
- Chore(client):🎨 Make font-size of note-preview em ([#6414](https://github.com/orhun/git-cliff/issues/6414))


- Chore(client): :art:

- Chore(client): Improve emoji picker usability

- Chore: Update webpack

- Chore(deps): Update dependencies :rocket:

- Chore(client): :art:

- Chore(cleint): vclean up code

- Chore: Update dependencies :rocket:

- Chore: Add TODO

- Chore: Add note

- Chore: Add note

- Chore

- Chore(client): Show ? when softwareName is unknown

- Chore: Remove debug code

- Chore: Remove debug code

- Chore: Update dependencies :rocket:

- Chore: Clean up

- Chore(client): Design tweaks

- Chore(client): Design tweaks

- Chore(client): Design tweaks

- Chore(client): Design tweaks

- Chore(client): fix style

- Chore(client): Fix bug

- Chore(client): Design tweaks

- Chore(client): Design tweak

- Chore(client): Design tweaks

- Chore(client): Fix style

- Chore: better error text

- Chore: β

- Update deps

- Chore: improve reaction picker behaviour

- Chore: improve reaction picker behaviour

- Chore: improve reaction picker behaviour

- Update page editor ([#7317](https://github.com/orhun/git-cliff/issues/7317))

* fix buttons visibility
* fix title of page editor
- Update mfm.js ([#7435](https://github.com/orhun/git-cliff/issues/7435))

* use mfm.js 0.14.0

* use mfm.extract

* use mfm.extract

* use mfm.extract
- Update mfm-js

- Update dependencies

- Update commander

- Update secret message
- Update MFM ([#7456](https://github.com/orhun/git-cliff/issues/7456))


- Update mfm.js ([#7468](https://github.com/orhun/git-cliff/issues/7468))


- Chore

- Update mfm.js ([#7476](https://github.com/orhun/git-cliff/issues/7476))


- Update vue

- Chore: Remove vips from Dockerfile ([#7633](https://github.com/orhun/git-cliff/issues/7633))


- Chore: yarn.lockがおかしかったらCIでコケるように ([#7634](https://github.com/orhun/git-cliff/issues/7634))


- Update vue

- Update deps

- Update contribution guides

- Chore: APIドキュメントの修正 ([#7771](https://github.com/orhun/git-cliff/issues/7771))

* packedNotificationSchemaを更新

* read:gallery, write:gallery, read:gallery-likes, write:gallery-likesに翻訳を追加

* fix

* add header, choice, invitation
- Chore: .configをdockerイメージに入れないように ([#7625](https://github.com/orhun/git-cliff/issues/7625))

* .configをdockerイメージに入れないように

* Update docker-compose.yml

Co-authored-by: tamaina <tamaina@hotmail.co.jp>

Co-authored-by: MeiMei <30769358+mei23@users.noreply.github.com>
Co-authored-by: tamaina <tamaina@hotmail.co.jp>
- Update deps

- Chore, perf: Reduce redis memory ([#7816](https://github.com/orhun/git-cliff/issues/7816))

* Reduce redis memory

* CHANGELOG

* a
- Update contribution guide

- Update deps

- Chore: clean up

- Chore: clean up

- Chore: fix bug

- Update dependencies

- Chore: fix error

- Chore: fix bug

- Chore: https://github.com/misskey-dev/misskey/commit/ba6959b8c1c4faafccdeb0f76eb26fc29e02af2d のリモート対応

- Chore: fix spacer component

- Update deps

- Chore: delete unnecessary twemoji submodule dir

- Update deps

- Chore: clean up

- Chore(client): Fix #7923

Close #7924

- Update deps

- Update ms to 3.0.0

- Update linr

- Update banner image

- Update deps

- Chore: remove ms-vscode.typescript-javascript-grammar ([#8061](https://github.com/orhun/git-cliff/issues/8061))


- Update deps

- Chore(client): tweak style

- Update deps

- Update deps

- Update deps

- Update deps

- Update local copy of file when describing ([#8131](https://github.com/orhun/git-cliff/issues/8131))


- Update dep

- Chore(client): add tooltip

- Chore(client): add #misskey button

- Update vue

- Chore: fix instant form handling

- Chore(client): improve chart rendering

- Update misskey-js

- Update eslint rule

- Chore(deps-dev): bump cypress from 9.3.1 to 9.4.1 ([#8239](https://github.com/orhun/git-cliff/issues/8239))

Bumps [cypress](https://github.com/cypress-io/cypress) from 9.3.1 to 9.4.1.
- [Release notes](https://github.com/cypress-io/cypress/releases)
- [Changelog](https://github.com/cypress-io/cypress/blob/develop/.releaserc.base.js)
- [Commits](https://github.com/cypress-io/cypress/compare/v9.3.1...v9.4.1)

---
updated-dependencies:
- dependency-name: cypress
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Update deps

- Chore: remove unused code

- Chore: better label

- Chore: tweak chart labels

- Chore(client): check textarea exists

- Chore(deps): bump axios from 0.21.1 to 0.21.4 in /packages/client ([#8286](https://github.com/orhun/git-cliff/issues/8286))

Bumps [axios](https://github.com/axios/axios) from 0.21.1 to 0.21.4.
- [Release notes](https://github.com/axios/axios/releases)
- [Changelog](https://github.com/axios/axios/blob/master/CHANGELOG.md)
- [Commits](https://github.com/axios/axios/compare/v0.21.1...v0.21.4)

---
updated-dependencies:
- dependency-name: axios
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump path-parse from 1.0.6 to 1.0.7 in /packages/client ([#8288](https://github.com/orhun/git-cliff/issues/8288))

Bumps [path-parse](https://github.com/jbgutierrez/path-parse) from 1.0.6 to 1.0.7.
- [Release notes](https://github.com/jbgutierrez/path-parse/releases)
- [Commits](https://github.com/jbgutierrez/path-parse/commits/v1.0.7)

---
updated-dependencies:
- dependency-name: path-parse
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump glob-parent from 5.1.1 to 5.1.2 in /packages/client ([#8289](https://github.com/orhun/git-cliff/issues/8289))

Bumps [glob-parent](https://github.com/gulpjs/glob-parent) from 5.1.1 to 5.1.2.
- [Release notes](https://github.com/gulpjs/glob-parent/releases)
- [Changelog](https://github.com/gulpjs/glob-parent/blob/main/CHANGELOG.md)
- [Commits](https://github.com/gulpjs/glob-parent/compare/v5.1.1...v5.1.2)

---
updated-dependencies:
- dependency-name: glob-parent
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump simple-get from 4.0.0 to 4.0.1 in /packages/backend ([#8292](https://github.com/orhun/git-cliff/issues/8292))

Bumps [simple-get](https://github.com/feross/simple-get) from 4.0.0 to 4.0.1.
- [Release notes](https://github.com/feross/simple-get/releases)
- [Commits](https://github.com/feross/simple-get/compare/v4.0.0...v4.0.1)

---
updated-dependencies:
- dependency-name: simple-get
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump node-fetch from 2.6.1 to 2.6.7 in /packages/client ([#8291](https://github.com/orhun/git-cliff/issues/8291))

Bumps [node-fetch](https://github.com/node-fetch/node-fetch) from 2.6.1 to 2.6.7.
- [Release notes](https://github.com/node-fetch/node-fetch/releases)
- [Commits](https://github.com/node-fetch/node-fetch/compare/v2.6.1...v2.6.7)

---
updated-dependencies:
- dependency-name: node-fetch
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump node-fetch from 2.6.1 to 2.6.7 in /packages/backend ([#8293](https://github.com/orhun/git-cliff/issues/8293))

Bumps [node-fetch](https://github.com/node-fetch/node-fetch) from 2.6.1 to 2.6.7.
- [Release notes](https://github.com/node-fetch/node-fetch/releases)
- [Commits](https://github.com/node-fetch/node-fetch/compare/v2.6.1...v2.6.7)

---
updated-dependencies:
- dependency-name: node-fetch
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump browserslist from 4.16.3 to 4.19.1 in /packages/client ([#8290](https://github.com/orhun/git-cliff/issues/8290))

Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.16.3 to 4.19.1.
- [Release notes](https://github.com/browserslist/browserslist/releases)
- [Changelog](https://github.com/browserslist/browserslist/blob/main/CHANGELOG.md)
- [Commits](https://github.com/browserslist/browserslist/compare/4.16.3...4.19.1)

---
updated-dependencies:
- dependency-name: browserslist
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(client): tweak chart

- Chore(deps): bump tar from 6.0.5 to 6.1.11 in /packages/backend ([#8294](https://github.com/orhun/git-cliff/issues/8294))

Bumps [tar](https://github.com/npm/node-tar) from 6.0.5 to 6.1.11.
- [Release notes](https://github.com/npm/node-tar/releases)
- [Changelog](https://github.com/npm/node-tar/blob/main/CHANGELOG.md)
- [Commits](https://github.com/npm/node-tar/compare/v6.0.5...v6.1.11)

---
updated-dependencies:
- dependency-name: tar
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump path-parse from 1.0.6 to 1.0.7 in /packages/backend ([#8301](https://github.com/orhun/git-cliff/issues/8301))

Bumps [path-parse](https://github.com/jbgutierrez/path-parse) from 1.0.6 to 1.0.7.
- [Release notes](https://github.com/jbgutierrez/path-parse/releases)
- [Commits](https://github.com/jbgutierrez/path-parse/commits/v1.0.7)

---
updated-dependencies:
- dependency-name: path-parse
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump normalize-url from 4.5.0 to 4.5.1 in /packages/backend ([#8302](https://github.com/orhun/git-cliff/issues/8302))

Bumps [normalize-url](https://github.com/sindresorhus/normalize-url) from 4.5.0 to 4.5.1.
- [Release notes](https://github.com/sindresorhus/normalize-url/releases)
- [Commits](https://github.com/sindresorhus/normalize-url/commits)

---
updated-dependencies:
- dependency-name: normalize-url
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump glob-parent from 5.1.1 to 5.1.2 in /packages/backend ([#8303](https://github.com/orhun/git-cliff/issues/8303))

Bumps [glob-parent](https://github.com/gulpjs/glob-parent) from 5.1.1 to 5.1.2.
- [Release notes](https://github.com/gulpjs/glob-parent/releases)
- [Changelog](https://github.com/gulpjs/glob-parent/blob/main/CHANGELOG.md)
- [Commits](https://github.com/gulpjs/glob-parent/compare/v5.1.1...v5.1.2)

---
updated-dependencies:
- dependency-name: glob-parent
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Update deps

- Update deps

- Chore(client): hide error report setting

Close #8327

- Update deps

- Update deps

- Update deps

- Chore: add note

- Update deps

- Chore(deps): bump minimist from 1.2.5 to 1.2.6 in /packages/backend ([#8447](https://github.com/orhun/git-cliff/issues/8447))

Bumps [minimist](https://github.com/substack/minimist) from 1.2.5 to 1.2.6.
- [Release notes](https://github.com/substack/minimist/releases)
- [Commits](https://github.com/substack/minimist/compare/1.2.5...1.2.6)

---
updated-dependencies:
- dependency-name: minimist
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Update deps

- Chore(deps): bump minimist from 1.2.5 to 1.2.6 in /packages/client ([#8446](https://github.com/orhun/git-cliff/issues/8446))

Bumps [minimist](https://github.com/substack/minimist) from 1.2.5 to 1.2.6.
- [Release notes](https://github.com/substack/minimist/releases)
- [Commits](https://github.com/substack/minimist/compare/1.2.5...1.2.6)

---
updated-dependencies:
- dependency-name: minimist
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump minimist from 1.2.5 to 1.2.6 ([#8445](https://github.com/orhun/git-cliff/issues/8445))

Bumps [minimist](https://github.com/substack/minimist) from 1.2.5 to 1.2.6.
- [Release notes](https://github.com/substack/minimist/releases)
- [Commits](https://github.com/substack/minimist/compare/1.2.5...1.2.6)

---
updated-dependencies:
- dependency-name: minimist
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump follow-redirects in /packages/backend ([#8314](https://github.com/orhun/git-cliff/issues/8314))

Bumps [follow-redirects](https://github.com/follow-redirects/follow-redirects) from 1.14.7 to 1.14.8.
- [Release notes](https://github.com/follow-redirects/follow-redirects/releases)
- [Commits](https://github.com/follow-redirects/follow-redirects/compare/v1.14.7...v1.14.8)

---
updated-dependencies:
- dependency-name: follow-redirects
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump follow-redirects from 1.14.1 to 1.14.8 ([#8313](https://github.com/orhun/git-cliff/issues/8313))

Bumps [follow-redirects](https://github.com/follow-redirects/follow-redirects) from 1.14.1 to 1.14.8.
- [Release notes](https://github.com/follow-redirects/follow-redirects/releases)
- [Commits](https://github.com/follow-redirects/follow-redirects/compare/v1.14.1...v1.14.8)

---
updated-dependencies:
- dependency-name: follow-redirects
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Update deps

- Chore: fix paths

- Chore: fix lint

- Chore: fix lint on windows

- Chore(deps): bump axios from 0.21.1 to 0.21.4 ([#8471](https://github.com/orhun/git-cliff/issues/8471))

Bumps [axios](https://github.com/axios/axios) from 0.21.1 to 0.21.4.
- [Release notes](https://github.com/axios/axios/releases)
- [Changelog](https://github.com/axios/axios/blob/master/CHANGELOG.md)
- [Commits](https://github.com/axios/axios/compare/v0.21.1...v0.21.4)

---
updated-dependencies:
- dependency-name: axios
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Update deps

- Chore: add import/order rule for eslint

- Update deps

- Update node to 18

- Chore(deps): bump moment from 2.24.0 to 2.29.3 in /packages/backend ([#8531](https://github.com/orhun/git-cliff/issues/8531))

Bumps [moment](https://github.com/moment/moment) from 2.24.0 to 2.29.3.
- [Release notes](https://github.com/moment/moment/releases)
- [Changelog](https://github.com/moment/moment/blob/2.29.3/CHANGELOG.md)
- [Commits](https://github.com/moment/moment/compare/2.24.0...2.29.3)

---
updated-dependencies:
- dependency-name: moment
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(lint): fix type definitions for jsrsasign ([#8528](https://github.com/orhun/git-cliff/issues/8528))

* fix type definitions for jsrsasign

The @types/jsrsasign is not available in exactly the same version as the jsrsa
package misskey uses, so i used an earlier patch version of the same package.

* update yarn.lock
- Chore: fix lint command for windows

- Update changelog

add user facing changes to changelog

- Chore(deps): Update github actions to use the same version as defined in .node-version ([#8563](https://github.com/orhun/git-cliff/issues/8563))


- Chore(deps): bump ejs from 3.1.6 to 3.1.7 in /packages/backend ([#8560](https://github.com/orhun/git-cliff/issues/8560))

Bumps [ejs](https://github.com/mde/ejs) from 3.1.6 to 3.1.7.
- [Release notes](https://github.com/mde/ejs/releases)
- [Changelog](https://github.com/mde/ejs/blob/main/CHANGELOG.md)
- [Commits](https://github.com/mde/ejs/compare/v3.1.6...v3.1.7)

---
updated-dependencies:
- dependency-name: ejs
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump postcss from 8.2.8 to 8.4.13 in /packages/client ([#8588](https://github.com/orhun/git-cliff/issues/8588))

Bumps [postcss](https://github.com/postcss/postcss) from 8.2.8 to 8.4.13.
- [Release notes](https://github.com/postcss/postcss/releases)
- [Changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
- [Commits](https://github.com/postcss/postcss/compare/8.2.8...8.4.13)

---
updated-dependencies:
- dependency-name: postcss
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore: synchronize code and database schema ([#8577](https://github.com/orhun/git-cliff/issues/8577))

* chore: remove default null

null is always the default value if a table column is nullable, and typeorm's
@Column only accepts strings for default.

* chore: synchronize code with database schema

* chore: sync generated migrations with code
- Update deps

- Chore: update changelog

- Chore(dev): use .yaml for prevent okteto error

- Chore(deps): bump path-parse from 1.0.6 to 1.0.7 ([#8705](https://github.com/orhun/git-cliff/issues/8705))

Bumps [path-parse](https://github.com/jbgutierrez/path-parse) from 1.0.6 to 1.0.7.
- [Release notes](https://github.com/jbgutierrez/path-parse/releases)
- [Commits](https://github.com/jbgutierrez/path-parse/commits/v1.0.7)

---
updated-dependencies:
- dependency-name: path-parse
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump async from 3.2.0 to 3.2.3 in /packages/backend ([#8706](https://github.com/orhun/git-cliff/issues/8706))

Bumps [async](https://github.com/caolan/async) from 3.2.0 to 3.2.3.
- [Release notes](https://github.com/caolan/async/releases)
- [Changelog](https://github.com/caolan/async/blob/master/CHANGELOG.md)
- [Commits](https://github.com/caolan/async/compare/v3.2.0...v3.2.3)

---
updated-dependencies:
- dependency-name: async
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(client): tweak loading spinner design

- Chore(client): tweak loading spinner design

- Chore(deps): bump async from 3.2.1 to 3.2.3 in /packages/client ([#8707](https://github.com/orhun/git-cliff/issues/8707))

Bumps [async](https://github.com/caolan/async) from 3.2.1 to 3.2.3.
- [Release notes](https://github.com/caolan/async/releases)
- [Changelog](https://github.com/caolan/async/blob/master/CHANGELOG.md)
- [Commits](https://github.com/caolan/async/compare/v3.2.1...v3.2.3)

---
updated-dependencies:
- dependency-name: async
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump async from 3.2.1 to 3.2.3 ([#8501](https://github.com/orhun/git-cliff/issues/8501))

Bumps [async](https://github.com/caolan/async) from 3.2.1 to 3.2.3.
- [Release notes](https://github.com/caolan/async/releases)
- [Changelog](https://github.com/caolan/async/blob/master/CHANGELOG.md)
- [Commits](https://github.com/caolan/async/compare/v3.2.1...v3.2.3)

---
updated-dependencies:
- dependency-name: async
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump copy-props from 2.0.4 to 2.0.5 ([#8709](https://github.com/orhun/git-cliff/issues/8709))

Bumps [copy-props](https://github.com/gulpjs/copy-props) from 2.0.4 to 2.0.5.
- [Release notes](https://github.com/gulpjs/copy-props/releases)
- [Changelog](https://github.com/gulpjs/copy-props/blob/master/CHANGELOG.md)
- [Commits](https://github.com/gulpjs/copy-props/compare/2.0.4...2.0.5)

---
updated-dependencies:
- dependency-name: copy-props
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(meta): add pixeldesu to patron list ([#8714](https://github.com/orhun/git-cliff/issues/8714))


- Chore(deps): bump hosted-git-info from 2.8.8 to 2.8.9 ([#8708](https://github.com/orhun/git-cliff/issues/8708))

Bumps [hosted-git-info](https://github.com/npm/hosted-git-info) from 2.8.8 to 2.8.9.
- [Release notes](https://github.com/npm/hosted-git-info/releases)
- [Changelog](https://github.com/npm/hosted-git-info/blob/v2.8.9/CHANGELOG.md)
- [Commits](https://github.com/npm/hosted-git-info/compare/v2.8.8...v2.8.9)

---
updated-dependencies:
- dependency-name: hosted-git-info
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(dev): tweak text
- Update deps

- Chore: remove unused imports

- Chore: remove packages/sw/webpack.config.js

- Chore: fix import tinycolor

- Chore(meta): label Pull Requests containing tests ([#8768](https://github.com/orhun/git-cliff/issues/8768))


- Update summaly

- Chore(client): fix menu item style

- Chore: lint fixes

- Chore(dev): update okteto workflow

- Chore(dev): update okteto workflow

- Chore: fix some lints automatically ([#8788](https://github.com/orhun/git-cliff/issues/8788))

* chore: fix some lints automatically

Fixed lints that were automatically fixable with `eslint --fix`.

* fix type

* workaround for empty interface lint
- Chore: tweak logo

- Update deps

- Update cypress

- Update cypress
- Update cypress
- Update cypress

- Chore: synchronize visibility checks ([#8687](https://github.com/orhun/git-cliff/issues/8687))

* reuse single meId parameter

* unify code style

Use template string to avoid having to use escaped quote marks.

* fix: follower only notes are visible to mentioned users

This synchronizes the visibility rules with the Notes.isVisibleForMe
method from packages/backend/src/models/repositories/note.ts

* add comment
- Chore(client): tweak range control design

- Chore: add comments

- Update changelog
- Chore(dev): improve eslint config

- Chore(client): tweak client design

- Chore(client): tweak ui

- Chore(client): tweak ui

- Chore(client): tweak mini-chart rendering

- Chore(client): improve usability

- Chore(client): tweak ui

- Chore(client): tweak MkKeyValue component

- Chore(deps): bump undici from 5.4.0 to 5.5.1 in /packages/backend ([#8842](https://github.com/orhun/git-cliff/issues/8842))

Bumps [undici](https://github.com/nodejs/undici) from 5.4.0 to 5.5.1.
- [Release notes](https://github.com/nodejs/undici/releases)
- [Commits](https://github.com/nodejs/undici/compare/v5.4.0...v5.5.1)

---
updated-dependencies:
- dependency-name: undici
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump jpeg-js from 0.4.1 to 0.4.4 in /packages/backend ([#8843](https://github.com/orhun/git-cliff/issues/8843))

Bumps [jpeg-js](https://github.com/eugeneware/jpeg-js) from 0.4.1 to 0.4.4.
- [Release notes](https://github.com/eugeneware/jpeg-js/releases)
- [Commits](https://github.com/eugeneware/jpeg-js/compare/v0.4.1...v0.4.4)

---
updated-dependencies:
- dependency-name: jpeg-js
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(deps): bump jsrsasign from 10.5.24 to 10.5.25 in /packages/backend ([#8889](https://github.com/orhun/git-cliff/issues/8889))

Bumps [jsrsasign](https://github.com/kjur/jsrsasign) from 10.5.24 to 10.5.25.
- [Release notes](https://github.com/kjur/jsrsasign/releases)
- [Changelog](https://github.com/kjur/jsrsasign/blob/master/ChangeLog.txt)
- [Commits](https://github.com/kjur/jsrsasign/compare/10.5.24...10.5.25)

---
updated-dependencies:
- dependency-name: jsrsasign
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(client): tweak ui

- Chore(client): tweak client

- Chore(client): tweak client

- Chore(client): fix type

- Chore(client): tweak ui :art:

- Chore(client): tweak ui :art:

- Chore(client): tweak client

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): fix type def

- Update lockfile

- Chore(client): refactor and style tweaks

- Chore(client): tweak style

- Chore(client): fix #8858

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak client

- Chore(client): fix type def

- Chore(client): tweak client

- Chore(client): tweak ui

- Chore(client): tweak ui

- Update vite

- Chore(client): tweak ui

- Chore(client): tweak ui

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): tweak rss-marquee

- Update deps

- Chore(client): fix pie rendering

- Chore(client): tweak ui

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): tweak ui

- Chore(client): tweak ui

- Update eslint rules

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): rename marquee -> ticker

- Chore(client): tweak style

- Update changelog

- Update vite

- Update CHANGELOG.md

- Chore: fix client lint errors ([#8934](https://github.com/orhun/git-cliff/issues/8934))

* Fix client lint

* Hide no-v-html

* Ignore banned type

* Update page-editor.vue
- Chore(client): tweak ui

- Chore(client): tweak deck

- Chore(client): tweak deck

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): fix type

- Chore(client): rendering performance tweak a bit

- Chore(client): tweak ui

- Chore(client): remove unused class

- Chore(client): rendering performance tweak a bit

- Chore(client): rendering performance tweak a bit

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): tweak ui

- Chore(server): tweak api for admin

- Update deps

- Chore(deps): bump moment from 2.29.3 to 2.29.4 in /packages/backend ([#8958](https://github.com/orhun/git-cliff/issues/8958))

Bumps [moment](https://github.com/moment/moment) from 2.29.3 to 2.29.4.
- [Release notes](https://github.com/moment/moment/releases)
- [Changelog](https://github.com/moment/moment/blob/develop/CHANGELOG.md)
- [Commits](https://github.com/moment/moment/compare/2.29.3...2.29.4)

---
updated-dependencies:
- dependency-name: moment
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <support@github.com>

Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
- Chore(server): tweak api for admin

- Chore(client): tweak ui

- Chore(client): tweak ui

- Update summaly

- Chore(dev): remove duplicated lint rule

- Chore(client): tweak style

- Chore: fix lint errors ([#8981](https://github.com/orhun/git-cliff/issues/8981))


- Update mfm-js 0.23.0-canary.1

- Chore(client): tweak ui

- Chore(client): fix mention style

- Chore(client): fix type def

- Chore(client): tweak explore page

- Chore(client): fix routing

- Chore(dev): add note

- Update vite

- Update deps

- Chore(client): trust ios

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore: use tab

- Chore(client): improve usability

- Chore(client): tweak ui

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): tweak style

- Chore(client): tweak ui

- Chore(client): tweak deck ui

- Chore(client): tweak style

- Chore(client): tweak user-info routing

- Chore: improve ad style ([#8995](https://github.com/orhun/git-cliff/issues/8995))

* Improve ad style

* :art:

* `ad` -> `info`
- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak style

- Chore(client): tweak deck ui

- Chore(client): tweak style

- Update vite

- Chore(client): tweak style

- Update vite

- Update openapi spec generator

Properly document GET API endpoints.
Added Bearer token authentication.


### Performance

- Perf(client): Lazy load themes

- Perf(client): Use v-once for static contents

- Perf(server): Add isSensitive index to improve query performance

- Perf: use overflow: clip instead of hidden

- Perf: reduce query

- Perf: myReaction の取得をまとめて行うように

Related #6813

- Perf(server): Improver performance

- Perf: Reduce database query

- Perf(server): Reduce database query

- Perf(server): Reduce database query

Related: #6813

- Perf(server): Improve following/followers API performance

Related #6813

- Perf: 各ストリーミング接続ごとにポーリングしないように

- Perf(server): Reduce database query

- Perf(server): Reduce database query

- Perf(server): Reduce database query

- Perf(server): Reduce database query

- Perf(server): Reduce database query

- Perf(server): Cache user keypair

- Perf(server): Cache user instance actor

- Perf(server): Redis接続をストリーミング接続ごとに作らず、プロセス全体で共有するように

- Perf(client): use function for render slot to improve performance

See: https://forum.vuejs.org/t/how-to-avoid-non-function-value-encountered-for-default-slot-warning/107039

- Perf(server): Optimize db indexes of chart tables

- Perf: Improve network request performance ([#7636](https://github.com/orhun/git-cliff/issues/7636))

* perf: Improve fetch

* CHANGELOG

* lifo
- Perf: Tune AP job queue timings ([#7635](https://github.com/orhun/git-cliff/issues/7635))

* perf: Tune AP job queue timings

* CHANGELOG

* chore: add reference

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Perf: delete-account処理を軽くする ([#7958](https://github.com/orhun/git-cliff/issues/7958))

* Revert "#7892"

This reverts commit 71d9c2a53d116a61f4c9b21ff98712a0000412b8.

* アカウント削除処理でノート削除を重複して行なわないようにする

* ドライブファイル削除時に参照しているノートを削除しないようにする

* 不要となったコードを削除する
- Perf(server): reduce memory usage of redis
- Perf(server): reduce db query

- Perf(server): reduce db query

- Perf(server): reduce db query

- Perf(server): cache nodeinfo to reduce db query

- Perf(server): reduce db query

- Perf(server): reduce db query

- Perf(server): disable some antenna features to improve performance

- Perf(server): refactor and performance improvements

- Perf(server): improve deliver performance

- Perf(server): reduce db query when get notifications

- Perf(server): use cached user info in getUserFromApId

- Perf: fix caching ([#8660](https://github.com/orhun/git-cliff/issues/8660))

The cache implementation did previously not store the results of the
computation and was thus not a cache at all. This can cause a significant
number of database queries each time someone with a large number of
followers does something that causes an activity to be federated.
- Perf(client): remove needless reactivity

- Perf(client): improve range control performance

- Perf: allow get for notes/reactions

- Perf(client): trying improve perf of emoji-picker


### Refactor

- Refactor

- Refactor

- Enhance(server): Log error message when internal error occured

- Refactor: Use ===

- Enhance(client): Use icon instead of text

- Enhance(pages): Improve hcart

- Refactor(client): :sparkles:

- Refactor(client): :sparkles:

- Enhance(server): Resolve #6286

- Refactor
- Refactor(client): Export default reaction setting and use it

- Refactor(client): Reorder property

- Refactor(client): Use getters to avoid watch vuex

- Refactor(client): Remove deprecated property

- Refactor(server): Improve readability

- Refactor(client): Use ===

- Refactor(client): Clean up component

- Refactor(client): Use unique class name

- Refactor(client): Use unique class name

- Refactor(client): Add note
- Refactor: use Object.fromEntries() instead of in-house implementation ([#6401](https://github.com/orhun/git-cliff/issues/6401))

* refactor: use Object.fromEntries()
instead of in-house implementation

* Remove extra type assertions
- Refactor

- Refactor

- Refactor

- Refactor

- Refactor(client): Use v-t for i18n

- Refactor(client): Do not mutate prop directly

Related #6595

- Refactor(client): Use v-model for note component, freeze object

Related: #6595

- Refactor: Rename function

- Refactor: Rename function

- Enhance(client): Use tab component for page list

- Refactor

- Refactor(client): Fix order of component property

- Refactor
- Refactor

- Enhance(api): アクセストークンを作成する際、createdAtをlastUsedAtを揃えるようにして、未使用かどうかを判定できるように

- Refactor: Extract well-known services

- Enhance(client): ミュートされたノート数を表示するようにしたり

- Enhance(client): Improve admin page

- Enhance(client): Better element visible detection

- Enhance(client): サーバーから切断されたときにダイアログで警告を表示できるように

- Refactor

- Refactor: resolve #7139

- Refactoring

- Refactor modal

- Refactor assets

- Refactor: use TS_NODE_PROJECT instead of TS_NODE_COMPILER_OPTIONS

- Refactor

- Refactor

- Refactor: Use Set

- Refactoring

- Refactor: extract functions

- Refactor

- Refactor(build): gulpを経由しないでTypeScriptのビルドを行うように

path aliasをサーバーサイドでも使ったりしたいため

- Refactor: Tweak path alias of client

- Refactor: Use path alias

- Refactor(client): Use symbol

- Refactor mfm extract ([#7434](https://github.com/orhun/git-cliff/issues/7434))

* refactor extractCustomEmojisFromMfm()

* refactor extract-hashtags

* refactor extract-mentions

* refactor extract-hashtags

* refactor extract-url-from-mfm

* refactor extract-mentions
- Refactor

- Refactor

- Refactoring

- Refactor init ([#7464](https://github.com/orhun/git-cliff/issues/7464))


- Refactor

- Refactor type

- Refactoring

- Refactor

- Refactor

- Refactor

- Enhance(client): Improve stability of version comparison

- Enhance(server): Improve user block ([#7640](https://github.com/orhun/git-cliff/issues/7640))

* enhance(server): Improve user block

* Update CHANGELOG.md

* ユーザーリスト対応

* 相手から見れなくなるように

* Update 1629004542760-chart-reindex.ts

https://github.com/misskey-dev/misskey/commit/2365761ba5445f26c8b66b3b20ef4be44e70d549#commitcomment-54919821

* update test

* add test

* add todos

* Update 1629004542760-chart-reindex.ts
- Refactor

- Refactor: refactoring imports

将来ESMに移行しやすいように
Related: #7658

なんかmochaが起動しなくなってるけど理由不明
すぐ直したい

- Refactor: use path alias to improve readability

- Refactor: localStorageのaccountsはindexedDBで保持するように ([#7609](https://github.com/orhun/git-cliff/issues/7609))

* accountsストアはindexedDBで保持するように

* fix lint

* fix indexeddb available detection

* remove debugging code

* fix lint

* resolve https://github.com/misskey-dev/misskey/pull/7609/files/ba756204b77ce6e1189b8443e9641f2d02119621#diff-f565878e8202f0037b830c780b7c0932dc1bb5fd3d05ede14d72d10efbc3740c
Firefoxでの動作を改善

* fix lint

* fix lint

* add changelog
- Enhance(client): Improve emoji autocomplete behaviour

cherry picked from https://github.com/kat-atat/misskey/commit/4b2c215e25a0bae47f4375b296d1f5d07a179f88

- Enhance(server): Use job queue for account delete ([#7668](https://github.com/orhun/git-cliff/issues/7668))

* enhance(server): Use job queue for account delete

Fix #5336

* ジョブをひとつに

* remove done call

* clean up

* add User.isDeleted

* コミット忘れ

* Update 1629512953000-user-is-deleted.ts

* show dialog

* lint

* Update 1629512953000-user-is-deleted.ts
- Enhance: Improve account deletion experience

- Enhance(client): ユーザー名についてのヒントを追加

- Refactor

- Refactoring

- Refactor: Expand schema ([#7772](https://github.com/orhun/git-cliff/issues/7772))

* packedNotificationSchemaを更新

* read:gallery, write:gallery, read:gallery-likes, write:gallery-likesに翻訳を追加

* fix

* add header, choice, invitation

* test

* fix

* yatta

* remove no longer needed "as PackedUser/PackedNote"

* clean up

* add simple-schema

* fix lint

* define items in full Schema

* revert https://github.com/misskey-dev/misskey/pull/7772#discussion_r706627736

* user packとnote packの型不整合を修正
- Enhance(server): アカウントが凍結されたときのエラーを判定しやすく

- Refactor

- Enhance: ノートヘッダーにflex-shrinkを設定し、Acctを優先的に縮小して見栄えをよくするように ([#7752](https://github.com/orhun/git-cliff/issues/7752))

* MAKE NOTE HEADER FLEX AGAIN

* span => div

* remove submodules
- Enhance(client): リスト、アンテナタイムラインを個別ページとして分割

- Enhance(client): 非ログイン自は更新ダイアログを出さないように

Resolve #7756

- Refactor: PackedHoge型をPacked<'Hoge'>型に書き換える ([#7792](https://github.com/orhun/git-cliff/issues/7792))

* packedNotificationSchemaを更新

* read:gallery, write:gallery, read:gallery-likes, write:gallery-likesに翻訳を追加

* fix

* add header, choice, invitation

* test

* fix

* yatta

* remove no longer needed "as PackedUser/PackedNote"

* clean up

* add simple-schema

* fix lint

* define items in full Schema

* revert https://github.com/misskey-dev/misskey/pull/7772#discussion_r706627736

* user packとnote packの型不整合を修正

* add prelude/types.ts

* emoji

* signin

* game

* matching

* fix

* add emoji schema

* add reversiGame

* add reversiMatching

* remove signin schema (use Signin entity)

* add Packed type

* note-reaction

* user

* user-group

* user-list

* note

* app, messaging-message

* notification

* drive-file

* drive-folder

* following

* muting

* blocking

* hashtag

* page

* app (with modifying schema)

* import user?

* channel

* antenna

* clip

* gallery-post

* emoji

* Packed

* reversi-matching

* add changelog

* add changelog

* revert fix
- Enhance(client): アップデートが利用可能な場合エラー表示およびダイアログ表示しないように

- Enhance(client): アニメーションを減らす設定をメニューのアニメーションにも適用するように

Resolve #7826

- Refactor: fix types

- Refactor components

- Refactor: prelude/urlでquerystringを使用しないように

Resolve #7854

- Enhance: ページロードエラーページにリロードボタンを追加 ([#7835](https://github.com/orhun/git-cliff/issues/7835))

* wip

* modify page load error page

* add changelog

* サーバーが死んでるエラーを追加

* add MkLoading
- Enhance(api): ap系のエンドポイントをログイン必須化+レートリミット追加

他のサーバーにリクエストを送信するという性質上、攻撃の踏み台にされることがあるため

- Refactor: use path alias

- Refactor(client): コンポーネント名が紛らわしくなるのでpreview->simpleにリネーム

- Refactor(client): ダミーコンポーネントを使ってノートプレビューするように

- Enhance(client): アニメーションを減らす設定の適用範囲を拡充

- Refactor

- Enhance: ユーザー検索の精度を強化

- Refactor: use insert

- Enhance: shareページでより多くの情報を渡せるように ([#7606](https://github.com/orhun/git-cliff/issues/7606))

* shareでより多くの情報を渡せるように

* from chat ui post-form, remove instant and add share

* fix await eating array, make document

* add changelog

* https://github.com/misskey-dev/misskey/pull/7606/files/3581bf9a060742dc59bf7fb8ea7316809cc60522#r692265037

* reply, renoteにも型定義

* :art:

* 閉じなければ100ms後タイムラインに
- Refactor: publishHogeStreamとStreamのEventEmitterに型定義する ([#7769](https://github.com/orhun/git-cliff/issues/7769))

* wip

* wip

* wip

* :v:

* add main stream

* packedNotificationSchemaを更新

* read:gallery, write:gallery, read:gallery-likes, write:gallery-likesに翻訳を追加

* fix

* ok

* add header, choice, invitation

* add header, choice, invitation

* test

* fix

* fix

* yatta

* remove no longer needed "as PackedUser/PackedNote"

* clean up

* add simple-schema

* fix lint

* fix lint

* wip

* wip!

* wip

* fix

* wip

* wip

* :v:

* 送信側に型エラーがないことを3回確認した

* :v:

* wip

* update typescript

* define items in full Schema

* edit comment

* edit comment

* edit comment

* Update src/prelude/types.ts

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* https://github.com/misskey-dev/misskey/pull/7769#discussion_r703058458

* user packとnote packの型不整合を修正

* revert https://github.com/misskey-dev/misskey/pull/7772#discussion_r706627736

* revert https://github.com/misskey-dev/misskey/pull/7772#discussion_r706627736

* user packとnote packの型不整合を修正

* add prelude/types.ts

* emoji

* signin

* game

* matching

* clean up

* ev => data

* refactor

* clean up

* add type

* antenna

* channel

* fix

* add Packed type

* add PackedRef

* fix lint

* add emoji schema

* add reversiGame

* add reversiMatching

* remove signin schema (use Signin entity)

* add schemas refs, fix Packed type

* wip PackedHoge => Packed<'Hoge'>

* add Packed type

* note-reaction

* user

* user-group

* user-list

* note

* app, messaging-message

* notification

* drive-file

* drive-folder

* following

* muting

* blocking

* hashtag

* page

* app (with modifying schema)

* import user?

* channel

* antenna

* clip

* gallery-post

* emoji

* Packed

* reversi-matching

* update stream.ts

* https://github.com/misskey-dev/misskey/pull/7769#issuecomment-917542339

* fix lint

* clean up?

* add changelog

* add changelog

* add changelog

* fix: アンテナが既読にならないのを修正

* revert fix

* https://github.com/misskey-dev/misskey/pull/7769#discussion_r711474875

* spec => payload

* edit commetn

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
- Refactor clinet

- Refactor clinet

- Refactor client

- Enhance: Provide Twemoji SVGs from Misskey server ([#2](https://github.com/orhun/git-cliff/issues/2)) ([#7897](https://github.com/orhun/git-cliff/issues/7897))

* Selfhosting Twemoji

* ちっ

* うざっ

* あ

* add test

Co-authored-by: mei23 <m@m544.net>
- Refactor

- Refactor: Introduce list of MFM Functions ([#7882](https://github.com/orhun/git-cliff/issues/7882))

* introduce list of MFM Functions

* add note
- Refactoring

Resolve #7779

- Refactor

- Refactoring: グローバルコンポーネントを認識するように

- Refactor

- Refactoring

- Enhance: show renoters ([#7954](https://github.com/orhun/git-cliff/issues/7954))

* refactor: deduplicate renote button into component

For now the renoters tooltip just uses the reaction viewer component
with a fixed emoji symbol instead.

* chore: remove unnecessary CSS

* fix: forgot to rename variable

* enhance: use own tooltip instead of reaction viewer

* clean up style

* fix additional renoters number

* rename file to better represent content
- Refactor(client): use composition api for tooltip logic

- Refactor(client): improve readability

- Refactor(client): refactor dialog functions to improve type inference

- Enhance(client): make possible to close image dialog with click

Related #8023

- Refactoring

https: //github.com/misskey-dev/misskey/pull/7901
Co-Authored-By: MeiMei <30769358+mei23@users.noreply.github.com>

- Refactor(client): refactor ui components

- Enhance(client): improve usability

- Enhance(client): improve usability

- Refactor(client): :sparkles:

- Refactor(client): :sparkles:

- Refactor

- Enhance(backend): improve chart engine

- Enhance(client): make possible to leave a group

- Enhance(client): improve modal menu for mobile

- Enhance(client): リアクションピッカーの表示方法を選択できるように

- Refactor(client): improve $i type

- Enhance(client): メールアドレスの認証にクリック必須に

- Enhance(client): tweak channel pages

- Refactor(client): refactor

- Enhance(client): tweak ui

- Enhance(client): improve note preview

Fix #8029

- Refactor

- Enhance(client): :art:

- Enhance(server): better content type detection

- Refactor

- Enhance(client): :art:

- Enhance(client): :sparkles:

- Enhance(client): :sparkles:

- Enhance: pizzaxでstreamingのuser storage updateイベントを監視して更新 ([#8095](https://github.com/orhun/git-cliff/issues/8095))

* wip

* wip?

* ?

* streamingのuser storage updateイベントを監視して更新

* 必要な時以外はストレージを更新しない

* fix?

* wip

* fix

* fix
- Enhance(client): tweak ui

- Enhance(client): tweak ui

- Refactor(server): use insert instead of save

- Refactor(server): use insert instead of save

- Enhance: 許可されていないファイルタイプでは、オブジェクトストレージのファイル名に拡張子を付与しないように ([#8108](https://github.com/orhun/git-cliff/issues/8108))

* 許可されていないファイルタイプでは、オブジェクトストレージのファイル名に拡張子を付与しないように

* add comment
- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor: Widgetのcomposition api移行 ([#8125](https://github.com/orhun/git-cliff/issues/8125))

* wip

* wip

* wip

* wip

* wip

* wip

* fix
- Refactor: Composition APIへ移行 ([#8121](https://github.com/orhun/git-cliff/issues/8121))

* components/abuse-report-window.vue

* use <script setup>

* :v:

* components/analog-clock.vue

* wip components/autocomplete.vue

* :v:

* :v:

* fix

* wip components/captcha.vue

* clean up

* components/channel-follow-button

* components/channel-preview.vue

* components/core-core.vue

* components/code.vue

* wip components/date-separated-list.vue

* fix

* fix autocomplete.vue

* :v:

* remove global property

* use <script setup>

* components/dialog.vue

* clena up

* fix dialog.vue

* Resolve https://github.com/misskey-dev/misskey/pull/8121#discussion_r781250966
- Refactor

- Refactor

- Refactor(client): specify global scope

- Refactor: disallow some variable names

- Refactor: more common name

- Refactor

- Refactor: APIエンドポイントファイルの定義を良い感じにする ([#8154](https://github.com/orhun/git-cliff/issues/8154))

* Fix API Schema Error

* Delete SimpleSchema/SimpleObj
and Move schemas to dedicated files

* Userのスキーマを分割してみる

* define packMany type

* add ,

* Ensure enum schema and Make "as const" put once

* test?

* Revert "test?"

This reverts commit 97dc9bfa70851bfb7d1cf38e883f8df20fb78b79.

* Revert "Fix API Schema Error"

This reverts commit 21b6176d974ed8e3eb73723ad21a105c5d297323.

* :v:

* clean up

* test?

* wip

* wip

* better schema def

* :v:

* fix

* add minLength property

* wip

* wip

* wip

* anyOf/oneOf/allOfに対応？ ~ relation.ts

* refactor!

* Define MinimumSchema

* wip

* wip

* anyOf/oneOf/allOfが動作するようにUnionSchemaTypeを修正

* anyOf/oneOf/allOfが動作するようにUnionSchemaTypeを修正

* Update packages/backend/src/misc/schema.ts

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* fix

* array oneOfをより正確な型に

* array oneOfをより正確な型に

* wip

* :v:

* なんかもういろいろ

* remove

* very good schema

* api schema

* wip

* refactor: awaitAllの型定義を変えてみる

* fix

* specify types in awaitAll

* specify types in awaitAll

* :v:

* wip

* ...

* :v:

* AllowDateはやめておく

* 不必要なoptional: false, nullable: falseを廃止

* Packedが展開されないように

* 続packed

* wip

* define note type

* wip

* UserDetailedをMeDetailedかUserDetailedNotMeかを区別できるように

* wip

* wip

* wip specify user type of other schemas

* ok

* convertSchemaToOpenApiSchemaを改修

* convertSchemaToOpenApiSchemaを改修

* Fix

* fix

* :v:

* wip

* 分割代入ではなくallOfで定義するように

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
- Refactor: Composition APIへ移行 ([#8138](https://github.com/orhun/git-cliff/issues/8138))

* components/drive-file-thumbnail.vue

* components/drive-select-dialog.vue

* components/drive-window.vue

* wip

* wip drive.file.vue, drive.vue

* fix prop

* wip(

* components/drive.folder.vue

* maybe ok

* :v:

* fix variable

* FIX FOLDER VARIABLE

* components/emoji-picker-dialog.vue

* Hate `$emit`

* hate global property

* components/emoji-picker-window.vue

* components/emoji-picker.section.vue

* fix

* fixx

* wip components/emoji-picker.vue

* fix

* defineExpose

* ユニコード絵文字の型をもっといい感じに

* components/featured-photos.vue

* components/follow-button.vue

* forgot-password.vue

* forgot-password.vue

* :art:

* fix
- Refactor

- Refactor

- Refactor(server): use insert instead of save

- Refactor(server): use named export

- Enhance: Forward report ([#8001](https://github.com/orhun/git-cliff/issues/8001))

* implement sending AP Flag object

Optionally allow a user to select to forward a report about a remote
user to the other instance. This is added in a backwards-compatible way.

* add locale string

* forward report only for moderators

* add switch to moderator UI to forward report

* fix report note url

* return forwarded status from API

apparently forgot to carry this over from my testing environment

* object in Flag activity has to be an array

For correct interoperability with Pleroma the "object" property of the Flag
activity has to be an array.

This array will in the future also hold the link to respective notes, so it
makes sense to correct this on our side.

* Update get-note-menu.ts

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Enhance: e2eテストをできるだけ改良してみた ([#8159](https://github.com/orhun/git-cliff/issues/8159))

* update docker image?

* 続

* serial run delete from "${table}" cascade

* use cypress official github action

* refuse install by cypress action

* clean up

* use wait?

* use more wait?

* Revert "use more wait?"

This reverts commit 18d0fcae9c7d8f98a4cafb4a846a031ece57350c.

* Revert "use wait?"

This reverts commit 5aa8feec9cdc3e2f79e566249f0a0eff6c0df6a0.

* fix

* test

* test

* log?

* 握りつぶしてみる

* clean up

* env?

* clean up?

* disable video

* add comment

* remove test

* 成功?

* test browser

* nodeインストール無効化

* node16.13.0-chrome95-ff94

* node.js復活

* ？

* ちょっと戻してみる

* chrome?

* cross browser test2

* --shm-size=2g

* artifact?

* misskey.local?

* firefoxはあきらめる

* not headless?

* oops

* fix

* ??

* test1

* if?

* fail-fast: false

* headless: false

* easy error ignoreing describe

* エラーの解消
とちょっとリファクター

* add browser name to artifact

* Install mplayer for FireFox

* no wait?

* タイムアウトを甘くしてみる

* firefoxをあきらめる(n回目)

* remove timeout setting

* wait復活

* Update basic.js

* Update index.js

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Refactor

- Enhance: convert svg to png of custom emojis

- Refactor, enhance: ドライブ引数のオブジェクト化, 追加時のcomment指定 ([#8180](https://github.com/orhun/git-cliff/issues/8180))

* refactor: ドライブの引数をオブジェクト化する Resolve #8177

* Resolve #8181

* fix

* archivePath
- Refactor(backend): use insert instead of save

- Enhance: Improve poll-editor UI + composition port ([#8186](https://github.com/orhun/git-cliff/issues/8186))

* Poll editor UI changes

Use a horizontal layout when possible, wrap to vertical when constrained

* Port poll-editor to composition API

* Fix poll-editor `get` time calcs

* fix

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Refactor

- Refactor: fix type

- Refactor(backend): fix type

- Refactor(backend): fix type

- Enhance: MediaListでは、サーバーで許可された形式しか表示しないように ([#8113](https://github.com/orhun/git-cliff/issues/8113))

* wip

* fix
- Refactor(client): use composition api

- Refactor(client): use composition api

- Refactor(client): i18n.locale -> i18n.ts

- Refactor(client): better semantics

- Refactor(client): use setup sugar

- Refactor

- Refactor(client): use composition api

- Refactor(client): use setup sugar

- Enhance: メニュー関連をComposition API化、switchアイテム追加 ([#8215](https://github.com/orhun/git-cliff/issues/8215))

* メニューをComposition API化、switchアイテム追加
クライアントサイド画像圧縮の準備

* メニュー型定義を分離 (TypeScriptの型支援が効かないので)

* disabled

* make keepOriginal to follow setting value

* fix

* fix

* Fix

* clean up
- Refactor: APIで非JSON入力の型変換はendpointに渡す前に行うように ([#8229](https://github.com/orhun/git-cliff/issues/8229))

* Resolve #8228

* fix
- Enhance(client): Chartjsのツールチップを自前に

- Refactor

- Refactor

- Refactor

- Refactor: use toISOString

- Refactor

- Refactor

- Refactor

- Refactor

- Refactor

- Refactor

- Refactor: use date-fns

- Refactor

- Refactor

- Enhance(client): improve chart rendering

- Enhance(client): improve tooltip position calclation

- Enhance: improve federation chart

- Enhance(client): tweak chart

- Enhance(server): add indexes for following host

- Enhance(client): リアクションピッカーの幅、高さ制限を緩和

- Enhance(client): tweak padding

- Refactor: fix types

- Refactor: fix types

- Refactor: fix types

- Refactor: add InstanceRepository

- Refactor: better getChart result type

- Refactor: use ajv instead of cafy ([#8324](https://github.com/orhun/git-cliff/issues/8324))

* wip

* wip

* Update abuse-user-reports.ts

* Update files.ts

* Update list-remote.ts

* Update list.ts

* Update show-users.ts

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* Update update.ts

* Update search.ts

* Update reactions.ts

* Update search.ts

* wip

* wip

* wip

* wip

* Update update.ts

* Update relation.ts

* Update available.ts

* wip

* wip

* wip

* Update packages/backend/src/server/api/define.ts

Co-authored-by: Johann150 <johann.galle@protonmail.com>

* Update define.ts

* Update define.ts

* typo

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* wip

* Update update.ts

* wip

* Update signup.ts

* Update call.ts

* minimum for limit

* type

* remove needless annotation

* wip

* Update signup.ts

* wip

* wip

* fix

* Update create.ts

Co-authored-by: Johann150 <johann.galle@protonmail.com>
- Refactor: fix type

- Refactor: fix type

- Enhance(client): improve launch pad usability

- Refactor(client): use setup

- Refactor

- Refactor: Use ESM ([#8358](https://github.com/orhun/git-cliff/issues/8358))

* wip

* wip

* fix

* clean up

* Update tsconfig.json

* Update activitypub.ts

* wip
- Refactor

- Refactor

- Enhance(chart): better federation pub/sub calculation

- Refactor: separate meta api for admin or not

- Refactor

- Enhance(client): アカウント情報の取得に失敗したとき強制ログアウトではなく警告を表示するように

- Refactor

- Refactor: migrate to typeorm 3.0 ([#8443](https://github.com/orhun/git-cliff/issues/8443))

* wip

* wip

* wip

* Update following.ts

* wip

* wip

* wip

* Update resolve-user.ts

* maxQueryExecutionTime

* wip

* wip
- Refactor and performance improvements

- Refactor

- Refactor

- Refactor

- Enhance(doc): required input fields ([#8456](https://github.com/orhun/git-cliff/issues/8456))

* remove empty file

If the endpoint is to be implemented later, the file can be added back,
but for now it is confusing to have an empty file.

* enhance(doc): document defaults

Default for `isPublic` is based on the database schema default value.
Defaults for `local` and `withFiles` are based on the behaviour of the endpoint.

* enhance(doc): explain nullable emoji category

* fix: make nullable if default is null

* enhance(doc): explain mute attribute expiresAt

* fix: define required fields

- `notes/create`: the default for `text` has been removed because ajv can not handle
  `default` inside of `anyOf`, see
  https://ajv.js.org/guide/modifying-data.html#assigning-defaults
  and the default value cannot be `null` if text is `nullable: false` in the `anyOf`
  first alternative.
- `notes/create`: The `mediaIds` property has been marked as deprecated because it
  has the same behaviour as using `fileIds`, but the implementation tries to handlè
  `fileIds` first.
- The result schema for `admin/emoji/list` has been altered because the `host`
  property will always be `null` as it is filtered this way in the database query.
  See packages/backend/src/server/api/endpoints/admin/emoji/list.ts line 67.

* enhance(doc): explain nullable hostname

* update changelog

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Enhance: タッチパッド・タッチスクリーンでのデッキの操作性を向上 ([#8450](https://github.com/orhun/git-cliff/issues/8450))

* enhance experience of deck with touchpad

* test: 単純にdeltaYを加算してみる

* clean up

* ios bug fix?

* :v:

* use overflow-y

* Safari does not supports clip
- Refactor actions

- Enhance(webhook): add userId to payload

- Refactor

- Refactor

- Enhance(client): show loading icon on splash screen

Close #8481

- Refactor: move typings to devDependencies ([#8500](https://github.com/orhun/git-cliff/issues/8500))


- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor: fix type

- Refactor

- Refactor

Resolve #8467

- Refactor

- Refactor: use structuredClone for deep clone

- Refactor(meta): split package lints into separate workflows ([#8530](https://github.com/orhun/git-cliff/issues/8530))


- Enhance: only render public notes in HTML template ([#8527](https://github.com/orhun/git-cliff/issues/8527))

* only render public notes in HTML template

* fix missing import
- Refactor: use composition API ([#8541](https://github.com/orhun/git-cliff/issues/8541))


- Enhance: ドライブに画像ファイルをアップロードするときオリジナル画像を破棄してwebpublicのみ保持するオプション ([#8216](https://github.com/orhun/git-cliff/issues/8216))

* wip

* Update packages/client/src/os.ts

Co-authored-by: tamaina <tamaina@hotmail.co.jp>

* メニューをComposition API化、switchアイテム追加
クライアントサイド画像圧縮の準備

* メニュー型定義を分離 (TypeScriptの型支援が効かないので)

* disabled

* make keepOriginal to follow setting value

* :v:

* fix

* fix

* :v:

* WEBP

* aaa

* :v:

* webp

* lazy load browser-image-resizer

* rename

* rename 2

* Fix

* clean up

* add comment

* clean up

* jpeg, pngにもどす

* fix

* fix name

* webpでなくする ただしサムネやプレビューはwebpのまま (テスト)

* 動画サムネイルはjpegに

* エラーハンドリング

* :v:

* v2.2.1-misskey-beta.2

* browser-image-resizer#v2.2.1-misskey.1

* :v:

* fix alert

* update browser-image-resizer to v2.2.1-misskey.2

* lockfile

Co-authored-by: mei23 <m@m544.net>
Co-authored-by: MeiMei <30769358+mei23@users.noreply.github.com>
- Refactor(client): refactor api-console to use Composition API ([#8566](https://github.com/orhun/git-cliff/issues/8566))


- Refactor(client): refactor scratchpad to use Composition API ([#8565](https://github.com/orhun/git-cliff/issues/8565))


- Refactor(client): refactor import-export to use Composition API ([#8579](https://github.com/orhun/git-cliff/issues/8579))


- Refactor: use Vite to build instead of webpack ([#8575](https://github.com/orhun/git-cliff/issues/8575))

* update stream.ts

* https://github.com/misskey-dev/misskey/pull/7769#issuecomment-917542339

* fix lint

* clean up?

* add app

* fix

* nanka iroiro

* wip

* wip

* fix lint

* fix loginId

* fix

* refactor

* refactor

* remove follow action

* clean up

* Revert "remove follow action"

This reverts commit defbb416480905af2150d1c92f10d8e1d1288c0a.

* Revert "clean up"

This reverts commit f94919cb9cff41e274044fc69c56ad36a33974f2.

* remove fetch specification

* renoteの条件追加

* apiFetch => cli

* bypass fetch?

* fix

* refactor: use path alias

* temp: add submodule

* remove submodule

* enhane: unison-reloadに指定したパスに移動できるように

* null

* null

* feat: ログインするアカウントのIDをクエリ文字列で指定する機能

* null

* await?

* rename

* rename

* Update read.ts

* merge

* get-note-summary

* fix

* swパッケージに

* add missing packages

* fix getNoteSummary

* add webpack-cli

* :v:

* remove plugins

* sw-inject分離したがテストしてない

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* fix notification.vue

* remove a blank line

* disconnect intersection observer

* disconnect2

* fix

* :v:

* clean up config

* typesを戻した

* Update packages/client/src/components/notification.vue

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

* disconnect

* oops

* Failed to load the script unexpectedly回避
sw.jsとlib.tsを分離してみた

* truncate notification

* Update packages/client/src/ui/_common_/common.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>

* clean up

* clean up

* キャッシュ対策

* Truncate push notification message

* クライアントがあったらストリームに接続しているということなので通知しない判定の位置を修正

* components/drive-file-thumbnail.vue

* components/drive-select-dialog.vue

* components/drive-window.vue

* merge

* fix

* Service Workerのビルドにesbuildを使うようにする

* return createEmptyNotification()

* fix

* i18n.ts

* update

* :v:

* remove ts-loader

* fix

* fix

* enhance: Service Workerを常に登録するように

* pollEnded

* URLをsw.jsに戻す

* clean up

* wip

* wip

* wip

* wip

* wip

* wip

* :v:

* use import

* fix

* install rollup

* use defineAsyncComponent.

* fix emojilist

* wip use defineAsyncComponent

* popup(import -> popup(defineAsyncComponent(() => import

* draggable?

* fix init import

* clean up

* fix router

* add comment

* :v:

* :v:

* :v:

* remove webpack

* update vite

* fix boot sequence

* Revert "fix boot sequence"

This reverts commit e893dbf37aed83bf9f12e427d98c78a7065b4a39.

* revert boot import

* never make two app div

* ;

* remove console.log

* change clientEntry sequence

* fix

* Revert "fix"

This reverts commit 12741b3d89950a31dbb1bb81477ddb27b0e9951a.

* fix

* add comment https://github.com/misskey-dev/misskey/pull/8575#issuecomment-1114239210

* add log

* add comment

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Refactor(client): refactor settings/accounts to use Composition API ([#8604](https://github.com/orhun/git-cliff/issues/8604))


- Refactor(client): refactor settings/theme to use Composition API ([#8595](https://github.com/orhun/git-cliff/issues/8595))


- Refactor(client): refactor settings/security to use Composition API ([#8592](https://github.com/orhun/git-cliff/issues/8592))


- Refactor(client): refactor settings/plugin/install to use Composition API ([#8591](https://github.com/orhun/git-cliff/issues/8591))


- Refactor(client): refactor settings/plugin to use Composition API ([#8590](https://github.com/orhun/git-cliff/issues/8590))


- Refactor(client): refactor settings/drive to use Composition API ([#8573](https://github.com/orhun/git-cliff/issues/8573))


- Refactor(client): refactor settings/apps to use Composition API ([#8570](https://github.com/orhun/git-cliff/issues/8570))


- Refactor(client): refactor settings/api to use Composition API ([#8569](https://github.com/orhun/git-cliff/issues/8569))


- Refactor(client): refactor 2FA settings to Composition API ([#8599](https://github.com/orhun/git-cliff/issues/8599))


- Refactor(client): refactor settings/deck to use Composition API ([#8598](https://github.com/orhun/git-cliff/issues/8598))


- Refactor(client): refactor settings/word-mute to use Composition API ([#8597](https://github.com/orhun/git-cliff/issues/8597))


- Refactor(client): refactor settings/theme/manage to use Composition API ([#8596](https://github.com/orhun/git-cliff/issues/8596))


- Enhance: Display TOTP Register URL

Close #7261

Co-Authored-By: tamaina <tamaina@hotmail.co.jp>

- Refactor(client): refactor admin/ads to use Composition API ([#8649](https://github.com/orhun/git-cliff/issues/8649))


- Refactor(client): refactor admin/announcements to use Composition API ([#8650](https://github.com/orhun/git-cliff/issues/8650))


- Refactor(client): refactor my-antennas/index to use Composition API ([#8679](https://github.com/orhun/git-cliff/issues/8679))


- Refactor(client): refactor admin/proxy-account to use Composition API ([#8675](https://github.com/orhun/git-cliff/issues/8675))


- Refactor(client): refactor admin/object-storage to use Composition API ([#8666](https://github.com/orhun/git-cliff/issues/8666))


- Refactor(client): refactor admin/instance-block to use Composition API ([#8663](https://github.com/orhun/git-cliff/issues/8663))


- Enhance: Perform port diagnosis at startup only when Listen fails ([#8698](https://github.com/orhun/git-cliff/issues/8698))

* Change port check

* Comment: disableClustering

* CHANGELOG

* Smart message
- Enhance: uniform theme color ([#8702](https://github.com/orhun/git-cliff/issues/8702))

* enhance: make theme color format uniform

All newly fetched instance theme colors will be uniformely formatted
as hashtag followed by 6 hexadecimal digits.

Colors are checked for validity and invalid colors are not handled.

* better input validation for own theme color

* migration to unify theme color formats

Fixes theme colors of other instances as well as the local instance.

* add changelog entry

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Refactor(client): refactor admin/settings to use Composition API ([#8678](https://github.com/orhun/git-cliff/issues/8678))


- Enhance(MFM): limit large MFM ([#8540](https://github.com/orhun/git-cliff/issues/8540))

* add CSS classes for zoom MFM

* limit nesting of x2, x3, x4 MFM

* simplify CSS calculation

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>

Co-authored-by: Acid Chicken (硫酸鶏) <root@acid-chicken.com>
- Enhance: page image component with alt text ([#8634](https://github.com/orhun/git-cliff/issues/8634))

* refactor to composition API

* use existing image component

This improves user experience because alt text is displayed correctly.

* fix: correct image src

* fix: defineProps

* fix
- Refactor

- Refactor(client): refactor admin/other-settings to use Composition API ([#8667](https://github.com/orhun/git-cliff/issues/8667))


- Refactor: temporary files ([#8713](https://github.com/orhun/git-cliff/issues/8713))

* simplify temporary files for thumbnails

Because only a single file will be written to the directory, creating a
separate directory seems unnecessary. If only a temporary file is created,
the code from `createTemp` can be reused here as well.

* refactor: deduplicate code for temporary files/directories

To follow the DRY principle, the same code should not be duplicated
across different files. Instead an already existing function is used.

Because temporary directories are also create in multiple locations,
a function for this is also newly added to reduce duplication.

* fix: clean up identicon temp files

The temporary files for identicons are not reused and can be deleted
after they are fully read. This condition is met when the stream is closed
and so the file can be cleaned up using the events API of the stream.

* fix: ensure cleanup is called when download fails

* fix: ensure cleanup is called in error conditions

This covers import/export queue jobs and is mostly just wrapping all
code in a try...finally statement where the finally runs the cleanup.

* fix: use correct type instead of `any`
- Refactor: use ===

- Enhance: clearly link documentation

fix #8744
- Enhance: replace signin CAPTCHA with rate limit ([#8740](https://github.com/orhun/git-cliff/issues/8740))

* enhance: rate limit works without signed in user

* fix: make limit key required for limiter

As before the fallback limiter key will be set from the endpoint name.

* enhance: use limiter for signin

* Revert "CAPTCHA求めるのは2fa認証が無効になっているときだけにした"

This reverts commit 02a43a310f6ad0cc9e9beccc26e51ab5b339e15f.

* Revert "feat: make captcha required when signin to improve security"

This reverts commit b21b0580058c14532ff3f4033e2a9147643bfca6.

* fix undefined reference

* fix: better error message

* enhance: only handle prefix of IPv6
- Refactor: use css module at components/global/loading.vue ([#8750](https://github.com/orhun/git-cliff/issues/8750))

* refactor: use css module at components/global/loading.vue

* rename class name to "root"
- Refactor: improve code quality ([#8751](https://github.com/orhun/git-cliff/issues/8751))

* remove unnecessary if

`Array.prototype.some` already returns a boolean so an if to return
true or false is completely unnecessary in this case.

* perf: use count instead of find

When using `count` instead of `findOneBy`, the data is not
unnecessarily loaded.

* remove duplicate null check

The variable is checked for null in the lines above and the function
returns if so. Therefore, it can not be null at this point.

* simplify `getJsonSchema`

Because the assigned value is `null` and the used keys are only
shallow, use of `nestedProperty.set` seems inappropriate. Because the
value is not read, the initial for loop can be replaced by a `for..in`
loop.

Since all keys will be assigned `null`, the condition of the ternary
expression in the nested function will always be true. Therefore the
recursion case will never happen. With this the nested function can be
eliminated.

* remove duplicate condition

The code above already checks `dragging` and returns if it is truthy.
Checking it again later is therefore unnecessary.

To make this more obvious the `return` is removed in favour of using
an if...else construct.

* remove impossible "unknown" time

The `ago` variable will always be a number and all non-negative numbers
are already covered by other cases, the negative case is handled with
`future` so there is no case when `unkown` could be achieved.
- Enhance(dev): ask for log snippets
- Refactor: use awaitAll to reduce duplication ([#8791](https://github.com/orhun/git-cliff/issues/8791))

* refactor: use awaitAll to reduce duplication

* fix lint

* fix typo
- Enhance: improve documentation for `/users/` endpoints ([#8790](https://github.com/orhun/git-cliff/issues/8790))

* docs: category & description for reset password

* docs: category & description for testing

* docs: descriptions for groups endpoints

* docs: descriptions for drive file endpoints

* docs: descriptions for sw endpoints

* docs: descriptions for user list endpoints

* docs: descriptions & result type for gallery posts

* docs: descriptions & result type for user endpoints

* docs: add return type for stats
- Refactor: follow button ([#8789](https://github.com/orhun/git-cliff/issues/8789))

* fix: display cancelling follow request

* remove unnecessary branch

The executed code is the same as in the else branch so this special
condition is unnecessary.

* remove code duplication

Use the same callback as later for updating these variables.

* use $ref sugar

* remove unused import

Co-authored-by: blackskye-sx <saul.newman@gmail.com>
- Enhance(federation): use ActivityPub defined property in favour of proprietary property. ([#8787](https://github.com/orhun/git-cliff/issues/8787))

* add activitypub `source` property

* parse MFM from new `source` attribute
- Enhance(server): モデレーターであってもレートリミットを有効に

- Enhance(client): improve files page of control panel

- Enhance(client): improve file moderation ui

- Enhance: Improve player detection in URL preview ([#8849](https://github.com/orhun/git-cliff/issues/8849))

* enhance: Improve player detection in URL preview

* CHANGELOG
- Refactor: チャットルームをComposition API化 ([#8850](https://github.com/orhun/git-cliff/issues/8850))

* pick form

* pick message

* pick room

* fix lint

* fix scroll?

* fix scroll.ts

* fix directives/sticky-container

* update global/sticky-container.vue

* fix, :art:

* test.1
- Refactor(client): Refine routing ([#8846](https://github.com/orhun/git-cliff/issues/8846))


- Refactor(client): use composition api

- Enhance(client): show warning in control panel when there is an unresolved abuse report

- Refactor(client): refactor header tab handling

- Refactor(client): use composition api

- Enhance(client): tweak ui

- Enhance: word mute checks CW ([#8873](https://github.com/orhun/git-cliff/issues/8873))


- Refactor: simplify ap/show with DbResolver ([#8838](https://github.com/orhun/git-cliff/issues/8838))

Using the existing code in DbResolver we can avoid separate code for
parsing the URIs in this endpoint.

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Refactor(client): use composition api

- Enhance: Redisをioredisに統一してIPv6サポート ([#8869](https://github.com/orhun/git-cliff/issues/8869))

* Use ioredis, Supports IPv6 host

https://github.com/misskey-dev/misskey/issues/8862

* Fix import

* order

* a

* i

* fix

* flushdb

* family

* CHANGELOG

* redis_version

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Refactor: remove unused import

- Refactor: notification setting window composition API ([#8860](https://github.com/orhun/git-cliff/issues/8860))

* refactor: notification setting window composition API

* fix lint vue/require-valid-default-prop

* fix type
- Refactor(client): extract tooltip logic of chart

- Enhance(client): improve control panel

- Enhance(client): tweak control panel dashboard

- Refactor(client): extract interval logic to a composable function

あと`onUnmounted`を`onMounted`内で呼んでいたりしたのを修正したりとか

- Enhance(client): Enhance boot error display ([#8879](https://github.com/orhun/git-cliff/issues/8879))

* Change boot error message

* fix

* :v:

* fix
- Refactor: remove duplicate code ([#8895](https://github.com/orhun/git-cliff/issues/8895))


- Refactor(client): use setup syntax

- Refactor(client): remove invalid computed

- Enhance(client): メニュー整理

Resolve #6389
Fix #8035

- Enhance(client): add users tab to instance-info

- Enhance(client): improve router

Fix #8902

- Refactor(client): use setup syntax

- Enhance(client): show confirm dialog when logout

- Enhance(client): ハイライトをみつけるに統合

- Enhance(client): cache pages in page-window

- Enhance(server): アンケートを新しい順にソート

- Refactor(client): refactoring

- Enhance(client): better marquee component

- Enhance(client): better sticky-container component

- Enhance(client): refine deck

Fix #7720

- Enhance(client): tweak deck

- Enhance(client): tweak statusbar

- Enhance(client): deckのウイジェットカラムが未設定の時に説明を表示するように

- Refactor: remove unnecessary computed

Fixes lint no-const-assign.

- Enhance(client): improve marquee

- Enhance(client): improve usability

- Refactor: use autofocus parameter

Using the `ref` seems to be broken but using the autofocus parameter
seems to fix it.

- Refactor: use overflow-y to determine scroll container

By using `overflow-y` instead of `overflow` using `endsWith` can be
avoided and represents the data we are actually interested in here
more accurately.

- 🎨

- Enhance(client): make widgets available on tablet again

- Enhance: Styled error screen ([#8946](https://github.com/orhun/git-cliff/issues/8946))

* Styled error screen

* Make details margin auto

* Update boot.css

* Replace fontawesome with tabler svg

* Remove hr

* Add new style to flush screen

* Rename to `error.css`

* Fix

* Update base.pug

* Finally fix!

* Wrap details in `<code>`

* Add style to flush

* Fix

* BIOS -> Repair tool

* Fix

* Typo

* Adjust style

* Adjust text

* Flush -> Clear

* Revert flush changes

* Responsive

* Also hide splash
- Enhance: show recipients of notes with specified visibility ([#8949](https://github.com/orhun/git-cliff/issues/8949))

* enhance: reusable visibility component

* rename renote tooltip component

The tooltip that is used for renotes can be used in other cases as well.

* add tooltip for specified recipients

* add changelog entry

* Update visibility.vue

Co-authored-by: syuilo <Syuilotan@yahoo.co.jp>
- Enhance(server): tweak identicon generation

- Enhance: make active email validation configurable

- Enhance(sw): If receiving a push notification issued more than a day, ignore it. ([#8980](https://github.com/orhun/git-cliff/issues/8980))

* enhance(sw): ignore old push notification

* :v:

* 半日

* !==

* 1日
- Enhance(client): update themes

- Enhance(client): improve widgets component

- Enhance: read theme color nodeinfo ([#8977](https://github.com/orhun/git-cliff/issues/8977))

* provide theme color in nodeinfo metadata

* read theme color from nodeinfo

Prefer to read the theme color from the nodeinfo since it is more
performant than performing selector search on a DOM.
- Refactor(client): rename menu(sidebar) -> navbar

- Refactor(client): remove useCssModule ([#8999](https://github.com/orhun/git-cliff/issues/8999))

* refactor(client): remove useCssModule()

* use MkStickyContainer

* Revert "use MkStickyContainer"

This reverts commit 639746786bb7e3342db9cbd3452854fc29aacf88.
- Enhance(client): RSSティッカーで表示順序をシャッフルできるように

- Refactor: signup component as composition api ([#8957](https://github.com/orhun/git-cliff/issues/8957))


- Refactor(client): use setup syntax

- Enhance(client): tweak ui

- Enhance(client): tweak ui

- Enhance(client): ウィンドウを最大化できるように

- Enhance(client): tweak ui

- Enhance(client): suspense

Fix #8817


### Styling

- Style: Fix linr


### Testing

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- Test

- 🚨

- Test - remove unneed async wrappings, drop GridFS drive_file correctly

- Test - fix insertDriveFile (use GridFS filename)

- Test: Add apple-touch-icon.png test

- Test: improve e2e test

- Test

- Test: e2eテストがCIで失敗していた問題をいくつか修正 ([#8642](https://github.com/orhun/git-cliff/issues/8642))

* test: indexeddbをテスト毎に初期化するように

* fix: metaが無いときにfetch-metaを同時に呼ぶと死ぬことがある問題を修正

* test: ログイン後のクライアント側処理を待たずにリロードされてログイン出来ないことがあったのを修正
- Test: `__dirname`はESModuleでは使えないので置き換えた ([#8626](https://github.com/orhun/git-cliff/issues/8626))


- Test: Nodeのカスタムローダーを直してテストが動くように ([#8625](https://github.com/orhun/git-cliff/issues/8625))

* test: Nodeのカスタムローダーを直してテストが動くように

* dev: mochaを呼ぶコマンドにNODE_ENV=testを追加

* Update packages/backend/test/loader.js

Co-authored-by: Johann150 <johann@qwertqwefsday.eu>

* chore: change export style in loader.js

Co-authored-by: Johann150 <johann@qwertqwefsday.eu>
- Test


<!-- generated by git-cliff -->
