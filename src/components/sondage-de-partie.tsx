"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  doitRafraichir,
  INTERVALLE_DE_SONDAGE_MS,
  reponseDeSondageSchema,
} from "@/lib/partie/sondage";

/**
 * Le sondage de la partie : **une ligne indexée toutes les trois secondes**.
 *
 * C'est le transport, et il n'y en a pas d'autre : Turso ne pousse rien, et sur
 * l'hébergement visé une connexion SSE meurt toutes les cinq minutes — elle
 * déplacerait le sondage sur le serveur au lieu de le supprimer. Le
 * raisonnement complet, chiffré, est dans
 * `docs/adr/0003-polling-plutot-que-push.md`, et il est à refaire avant de
 * remplacer ce composant par quoi que ce soit.
 *
 * Il ne rend **rien**. Sa seule sortie est un `router.refresh()`, qui refait le
 * rendu serveur de la page sans recharger le document : la grille change sous
 * les yeux, le défilement ne bouge pas, et les champs en cours de frappe
 * ailleurs sur l'écran ne sont pas soufflés.
 *
 * `version` est l'estampille **du rendu qu'on a sous les yeux**. Elle entre dans
 * les dépendances de l'effet : après un rafraîchissement, la page redescend
 * avec la nouvelle, l'effet se relance sur elle, et le battement suivant
 * compare au bon repère plutôt qu'au premier chargement.
 *
 * L'estampille n'est **jamais un jeton d'écriture**. Ce composant ne la renvoie
 * nulle part ; le garde-fou de l'écriture concurrente porte sur la case.
 *
 * Un échec réseau ne fait rien : un téléphone en tunnel reprend au battement
 * suivant, et un écran d'erreur pour une lecture qu'on refait dans trois
 * secondes serait du bruit.
 */
export function SondageDePartie({ code, version }: { code: string; version: number }): null {
  const router = useRouter();

  useEffect(() => {
    let vivant = true;

    const sonder = async (): Promise<void> => {
      try {
        const reponse = await fetch(`/p/${code}/version`, { cache: "no-store" });

        if (!reponse.ok) {
          return;
        }

        const lue = reponseDeSondageSchema.safeParse(await reponse.json());

        if (vivant && lue.success && doitRafraichir(version, lue.data.version)) {
          router.refresh();
        }
      } catch {
        // Réseau coupé, onglet en train de partir : le battement suivant reprendra.
      }
    };

    const battement = setInterval(() => {
      void sonder();
    }, INTERVALLE_DE_SONDAGE_MS);

    return () => {
      vivant = false;
      clearInterval(battement);
    };
  }, [code, version, router]);

  return null;
}
