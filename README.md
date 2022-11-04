<div align="center">
<a href="https://stop.voring.me/">
	<img src="./.github/title_float.svg" alt="Calckey logo" style="border-radius:50%" width="400"/>
</a>

**🌎 **[Calckey](https://stop.voring.me/)** is an open source, decentralized social media platform that's free forever! 🚀**

</div>

<div>

<img src="https://pool.jortage.com/voringme/misskey/e7cd2a17-8b23-4e1e-b5cf-709480c623e2.png" align="right" height="320px"/>

# ✨ About Calckey

- Calckey is based off of Misskey, a powerful microblogging server on ActivityPub with features such as emoji reactions, a customizable web ui, rich chatting, and much more!
- Calckey adds many quality of life changes and bug fixes for users and instance admins alike.
- Read **[this document](./CALCKEY.md)** all for current and future differences.
- Notable differences:
  - Improved UI/UX (especially on mobile)
  - Improved notifications
  - Improved instance security
  - Recommended Instances timeline
  - OCR image captioning
  - New and improved Groups
  - Many more user and admin settings
  - [So much more!](./CALCKEY.md)

</div>

<div style="clear: both;"></div>

# 🥂 Links

- 💸 Liberapay: https://liberapay.com/ThatOneCalculator
- 💁 Matrix support room: https://matrix.to/#/#calckey:matrix.fedibird.com
- 📜 Instance list: https://calckey.fediverse.observer/list
- 📖 JoinFediverse Wiki: https://joinfediverse.wiki/What_is_Calckey%3F

# 🏂 Starting a new instance

You need at least 🐢 NodeJS v16.15.0 (v18.20.0 recommended!) and at least 🧶 Yarn v3.2!

# 🚚 Migrating from Misskey to Calckey

You need at least 🐢 NodeJS v16.15.0 (v19 recommended!) and at least 🧶 Yarn v3.2!

## 👀 Get folder ready

```sh
git clone https://codeberg.org/thatonecalculator/calckey.git
cd calckey/
# git checkout main # if you want only stable versions
cp ../misskey/.config/default.yml ./.config/default.yml # replace `../misskey/` with misskey path, replace `default.yml` with `docker.yml` if you use docker
# cp -r ../misskey/files . # if you don't use object storage
```

## 📩 Install dependencies

```sh
# nvm install 18.4.0 && nvm alias default 18.4.0 && nvm use 18.4.0
corepack enable
yarn set version berry
```

## 💅 Customize

- To add custom CSS for all users, edit `./custom/instance.css`.
- To add static assets (such as images for the splash screen), place them in the `./custom/` directory. They'll then be avaliable on `https://yourinstance.tld/static-assets/filename.ext`.

## 🚀 Build and launch!

### `git pull` and run these steps to update Calckey in the future!

```sh
# git pull
yarn install
NODE_ENV=production yarn run build && yarn run migrate
# Edit service to point to calckey folder and restart!
```

## 🐳 Docker

```sh
# git pull
docker compose build
# docker compose stop misskey
docker compose up -d
```
