# Opération 40 · Benj & Félix 🏈

Le site pour organiser le voyage des 40 ans de Benj & Félix (juin–juillet 2027).

- **La roue du destin** : Dublin, Liverpool, Manchester ou Belfast. Elle tourne en continu.
- **Le tableau des scores** : les jours où tout le monde est « Dispo » ou « Peut-être », calculés en direct.
- **Mes dispos** : chacun choisit son maillot et colorie ses jours (sauvegarde instantanée).
- **Le planning de l'équipe** : toutes les dispos, jour par jour.

Site : https://weejo6.github.io/40ans-benj-felix/

## Fonctionnement

Site statique (HTML/CSS/JS, sans build) hébergé sur GitHub Pages. Les dispos sont stockées
dans une **Firebase Realtime Database**, ce qui permet à tout le monde de voir les changements en direct.

| Fichier | Rôle |
| --- | --- |
| `config.js` | Config Firebase, mois proposés, villes de la roue, données de départ |
| `store.js` | Lecture/écriture Firebase (ou localStorage en mode démo) |
| `app.js` | Interface : roue, scores, calendrier, planning |
| `database.rules.json` | Règles de sécurité à coller dans la console Firebase |

Sans `firebaseConfig` dans `config.js`, le site tourne en **mode démo** (dispos enregistrées
uniquement sur l'appareil).

## Brancher Firebase

1. https://console.firebase.google.com → **Créer un projet** (Google Analytics inutile).
2. **Créer › Realtime Database** → **Créer une base de données** → emplacement `europe-west1` → mode verrouillé.
3. Onglet **Règles** : coller le contenu de `database.rules.json` → **Publier**.
4. **⚙️ Paramètres du projet › Vos applications › `</>` Web** → enregistrer l'appli → copier `firebaseConfig`
   (avec `databaseURL`) dans `config.js`.

Au premier chargement, la base est remplie avec les dispos du calendrier d'origine (une seule fois).

## En local

Les modules ES ne marchent pas en `file://` : lancer un petit serveur, par exemple `npx serve .`.
