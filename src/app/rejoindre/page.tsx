import { redirect } from "next/navigation";
import { adresseDePartie, adresseDuCodeTape } from "@/lib/partie/adresse";
import { premierParametre } from "@/lib/partie/identite-url";

/**
 * Le code tapé à la main, mené à l'adresse du lien.
 *
 * Cette page n'affiche rien : elle **normalise puis renvoie**, ce qui fait des
 * deux chemins d'arrivée une seule chaîne — `oil123` dicté et `/p/011123`
 * cliqué finissent au même endroit, sur la même lecture, sous la même limite de
 * débit.
 *
 * Un code malformé part quand même sur `/p/<ce qui a été tapé>`, qui l'affiche
 * comme inconnu : « ce code n'existe pas » est la même réponse pour qui se
 * trompe d'une lettre et pour qui invente.
 */
export default async function Rejoindre(props: PageProps<"/rejoindre">): Promise<never> {
  const tape = premierParametre((await props.searchParams).code) ?? "";

  redirect(adresseDuCodeTape(tape) ?? adresseDePartie(encodeURIComponent(tape)));
}
