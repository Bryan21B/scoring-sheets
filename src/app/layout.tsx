import type { Metadata } from "next";
import { Azeret_Mono, Darker_Grotesque, Work_Sans } from "next/font/google";
import "./globals.css";

/**
 * Les trois polices du kit Memphis, chargées une fois pour toute l'app.
 *
 * `next/font` les auto-héberge au build : aucun appel à Google au runtime,
 * donc aucun saut de mise en page au premier rendu — ce qui compte sur un
 * écran posé au milieu de la table, où la première chose lue est un titre de
 * 52 px.
 *
 * Les graisses sont énumérées plutôt que toutes prises : chacune ajoute un
 * fichier à servir, et le kit n'en utilise que celles-là.
 */
const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Les titres, et eux seuls : 900 est la seule graisse que le kit leur donne. */
const darkerGrotesque = Darker_Grotesque({
  variable: "--font-darker-grotesque",
  subsets: ["latin"],
  weight: ["800", "900"],
});

/** Tous les nombres de l'app, et le code de partie qui se dicte. */
const azeretMono = Azeret_Mono({
  variable: "--font-azeret-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Scoring Sheets",
  description: "Suivre les scores des parties de cartes entre amis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${workSans.variable} ${darkerGrotesque.variable} ${azeretMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
