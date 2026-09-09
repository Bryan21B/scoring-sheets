# 0003 — Polling à trois secondes plutôt qu'un transport en push

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Recherche** : `docs/research/2026-08-31-transport-temps-reel.md`

## Contexte

Une manche saisie sur un téléphone doit apparaître sur les quatre autres sans
rechargement. En 2026, la réponse réflexe est un transport en push — SSE,
WebSocket, ou un service tiers — et c'est précisément pourquoi ce choix mérite
d'être consigné : quelqu'un le trouvera arriéré et voudra le « moderniser ».

Le cadre de dimensionnement décide tout : **cinq clients autour d'une table, une
dizaine d'utilisateurs, une soirée de trois heures, budget gratuit**. Ce n'est pas
un problème de débit, c'est un problème de coût fixe.

Trois faits mesurés lors de la recherche :

1. **Turso ne pousse rien.** Il n'existe aucune notification côté base.
2. **Deux instances Vercel ne partagent pas de mémoire.** Une boucle SSE
   interrogerait donc la base exactement comme le ferait un téléphone : SSE ne
   supprime pas le polling, **il le déplace** du téléphone vers la fonction.
3. **Sur Hobby, une connexion SSE meurt au bout de cinq minutes**, sans
   échappatoire par configuration. Sur trois heures, c'est 36 reconnexions par
   client et 180 pour la table, chacune réclamant une reprise d'état.

## Décision

**Polling client à trois secondes sur une estampille de version**, avec
`router.refresh()` conditionnel. L'écriture passe par une Server Action, avec
`useOptimistic` pour le retour immédiat au saisisseur.

Aucune pièce ajoutée : pas de compte, pas de secret, pas de SDK, pas de seconde
source de vérité.

Le coût mesuré est **deux ordres de grandeur sous les plafonds** : environ 18 000
invocations et 40 000 lignes lues par soirée, contre un million d'invocations et
500 millions de lignes par mois inclus.

## Conséquences

- **Le mode de défaillance est le bon.** Un téléphone verrouillé arrête de poller
  et reprend au réveil, sans qu'on écrive une ligne pour ça.
- **Il n'y a aucune présence.** Personne ne sait qui est connecté ni qui saisit.
  Un verrou d'édition et un avertissement « Léa modifie cette manche » sont
  **irréalisables**, pas seulement écartés — c'est ce qui a forcé la politique
  d'écriture concurrente à se jouer côté serveur, à l'écriture.
- **La fenêtre de collision est de trois secondes**, et un « dernier écrit gagne »
  y perdrait une saisie sans que personne ne le voie passer.
- **Une estampille de version par partie** entre au schéma. Elle sert au poll, et
  à rien d'autre : elle n'est **jamais** un jeton d'écriture.
- **`use cache` est interdit sur la lecture d'une partie.** Un cache partagé y
  sert du périmé aux autres joueurs, et son invalidation ne les atteint pas.
- **Le seul chiffre à surveiller est l'Active CPU de Vercel Hobby**, quatre heures
  par mois, non mesuré. Entre 26 et 80 soirées mensuelles selon le coût réel.

**Ne pas remplacer par SSE sans refaire ce raisonnement.** On paierait de la
mémoire provisionnée toute la soirée, plus une reconnexion forcée toutes les cinq
minutes, pour gagner au mieux deux secondes.

Si la latence devient un vrai besoin, le plan B est **Pusher Sandbox en signal de
réveil uniquement** : le message dit « la partie a bougé », le client relit par le
chemin déjà en place, et le polling reste en filet. C'est un ajout, pas une
réécriture.
