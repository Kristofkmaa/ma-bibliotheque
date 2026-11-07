# À faire plus tard

Les pièces de la maison tournent déjà sur le carrousel (le salon, la cuisine, le garage, la
chambre). Le garage et la chambre se visitent, mais leurs outils restent à coder. Voici ce qu'on
a prévu d'y mettre.

## Le garage — tout ce qui concerne la voiture

- **Les rappels du contrôle technique** : la date du dernier contrôle, le prochain (tous les 2 ans,
  le premier 4 ans après la mise en circulation), une alerte un mois avant, puis une semaine avant.
  La contre-visite si elle est demandée (2 mois pour la faire).
- **L'entretien** : vidange, révision, pneus (été / hiver, usure), plaquettes, courroie de
  distribution, batterie. À chaque fois : la date, le kilométrage, le garage, le prix, la facture.
  Rappels au kilométrage ou à la date (« vidange dans 2 000 km »).
- **Les papiers** : carte grise, assurance (échéance et rappel), permis, carnet d'entretien,
  factures — en photo ou en PDF, retrouvables d'un toucher.
- **Le suivi** : le kilométrage relevé de temps en temps, les pleins et la consommation, les
  dépenses de l'année.
- **Plusieurs véhicules** si besoin (une voiture, une moto, un vélo…).
- Dans la maquette : la voiture qu'on touche ouvre sa fiche ; le calendrier au mur montre le
  prochain rappel ; un voyant s'allume quand quelque chose approche.

## La chambre — le dressing

- **L'inventaire des vêtements** : photo, catégorie (hauts, bas, robes, vestes, chaussures,
  accessoires), couleur, saison, taille, marque.
- **Les tenues** : composer et garder les tenues qu'on aime, en idées pour le jour (selon la météo
  et la saison).
- **Le linge** : à laver, au sale, au pressing ; ce qu'on n'a pas porté depuis longtemps (à donner,
  à vendre).
- **Les saisons** : ce qui est rangé ailleurs (valises, sous le lit) et ce qui est dans le dressing.
- **Les envies** : une liste de ce qu'on aimerait acheter (comme la liste de courses de la cuisine).
- Dans la maquette : la penderie et les étagères montrent nos vrais vêtements (couleurs), on touche
  le dressing pour l'ouvrir ; le miroir propose la tenue du jour.

## La bibliothèque — des suggestions de livres

- Un chapitre « Pour toi » dans le livre : des idées de livres d'après ceux qu'on a aimés
  (J'aime, 4-5 étoiles, le top 5), jamais un livre qu'on a déjà.
- Chaque idée : la couverture, « parce que tu as aimé … », et deux boutons : Wishlist / Pas pour moi
  (les refusées ne reviennent plus).
- Les idées viendraient d'une IA (Claude, par un relais Vercel avec sa clé, comme Spoonacular),
  puis on retrouve chaque livre sur Google Books pour sa couverture et sa fiche ; sans clé, des
  idées plus simples : mêmes auteurs, mêmes genres (Google Books).
- Renouvelées une fois par semaine (gardées en mémoire, pour que ça ne coûte presque rien).

## La domotique — les lumières, les volets…

- Piloter la vraie maison depuis le site : éteindre les lumières, fermer les volets, par pièce
  ou tout d'un coup (« Bonne nuit »).
- Dans les maquettes : la lampe du salon allume la vraie lampe, les rideaux ferment les vrais
  volets ; chaque pièce du carrousel montre ses lumières.
- Ça dépend du matériel de la maison (à demander) : Home Assistant (le plus simple et le plus
  complet), Philips Hue, Somfy TaHoma (volets), Legrand / Netatmo, SmartThings, Tuya / Smart Life,
  Google Home ou Alexa (via Home Assistant). Le site passe par un relais Vercel qui garde les clés.
- Sécurité : seulement pour nous (connectés), jamais d'accès ouvert.
- Ce qu'on a (locataires) : des clims **Daikin** → l'API cloud Daikin Onecta (allumer, éteindre,
  mode, température, la température de la pièce), si les clims sont reliées à l'appli Onecta.
  Pour le reste, sans travaux : ampoules connectées, prises connectées, robots SwitchBot
  (volets, rideaux, boutons) avec leur hub, qui a une API cloud simple.

## Le carrousel

- Ajouter d'autres pièces : il suffit d'une nouvelle scène (voir `src/three/RoomScene.js`, une
  maquette de base) et d'une ligne dans le carrousel (`src/components/LivingRoom.jsx`).
