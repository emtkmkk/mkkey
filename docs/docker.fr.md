Guide Docker
================================================================

Ce guide explique comment installer et configurer Misskey avec Docker.

[Version japonaise également disponible - Japanese version also available - 日本語版もあります](./docker.ja.md)  
[Version anglaise également disponible - English version also available - 英語版もあります](./docker.en.md)

----------------------------------------------------------------

*1.* Télécharger Misskey
----------------------------------------------------------------
1. `git clone -b master git://github.com/syuilo/misskey.git` Clone le dépôt de Misskey sur la branche master.
2. `cd misskey` Naviguez dans le dossier du dépôt.
3. `git checkout $(git tag -l | grep -v 'rc[0-9]*$' | sort -V | tail -n 1)` Checkout sur le tag de la [dernière version](https://github.com/syuilo/misskey/releases/latest).

*2.* Configuration de Misskey
----------------------------------------------------------------
1. `cp .config/example.yml .config/default.yml` Copiez le fichier `.config/example.yml` et renommez-le `default.yml`.
2. `cp .config/mongo_initdb_example.js .config/mongo_initdb.js` Copie le fichier `.config/mongo_initdb_example.js` et le renomme en `mongo_initdb.js`.
3. Editez `default.yml` et `mongo_initdb.js`.

*3.* Configurer Docker
----------------------------------------------------------------
Editez `docker-compose.yml`.

*4.* Contruire Misskey
----------------------------------------------------------------
Contruire l'image Docker avec:

`docker-compose build`

*5.* C'est tout !
----------------------------------------------------------------
Parfait, Vous avez un environnement prêt pour démarrer Misskey.

### Lancer normalement
Utilisez la commande `docker-compose up -d`. GLHF!

### How to update your Misskey server to the latest version
1. `git fetch`
2. `git stash`
3. `git checkout $(git tag -l | grep -v 'rc[0-9]*$' | sort -V | tail -n 1)`
4. `git stash pop`
5. `docker-compose build`
6. Consultez le [ChangeLog](../CHANGELOG.md) pour avoir les éventuelles informations de migration
7. `docker-compose stop && docker-compose up -d`

### Comment exécuter des [commandes](manage.fr.md)
`docker-compose run --rm web node cli/mark-admin @example`

### Configuration d'ElasticSearch (pour la fonction de recherche)
*1.* Préparation de l'environnement
----------------------------------------------------------------
1. `mkdir elasticsearch && chown 1000:1000 elasticsearch` Permet de créer le dossier d'accueil de la base ElasticSearch aves les bons droits
2. `sysctl -w vm.max_map_count=262144` Augmente la valeur max du paramètre map_count du système (valeur minimum pour pouvoir lancer ES)

*2.* Après lancement du docker-compose, initialisation de la base ElasticSearch
----------------------------------------------------------------
1. `docker-compose -it web /bin/sh` Connexion dans le conteneur web
2. `apk add curl` Ajout du paquet curl
3. `curl -X PUT "es:9200/misskey" -H 'Content-Type: application/json' -d'{ "settings" : { "index" : { } }}'` Création de la base ES
4. `exit`

----------------------------------------------------------------

Si vous avez des questions ou des problèmes, n'hésitez pas à nous contacter !
