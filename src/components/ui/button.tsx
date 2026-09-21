import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Le bouton du kit Memphis : **une pilule cerclée de 3 px, posée sur son ombre**.
 *
 * Trois choses le distinguent du bouton shadcn qu'il remplace, et les trois
 * viennent du kit — `docs/specs/2026-09-20-design-system-memphis.md` :
 *
 * - **Il s'enfonce à l'appui.** `translate(4px, 4px)` et l'ombre à zéro : le
 *   bouton descend exactement de la hauteur de son ombre, et le doigt le voit
 *   bouger sous lui. C'est le retour qu'un écran posé au milieu de la table
 *   peut donner.
 * - **Le texte sur un aplat est toujours de l'encre**, jamais du blanc. C'est
 *   ce qui tient 5:1 sur les quatre couleurs d'un coup, au lieu de devoir
 *   vérifier chaque paire — et c'est porté par `--primary-foreground`, qui vaut
 *   l'encre dans les deux modes.
 * - **Il est haut.** 52 px au repos, 56 px pour le geste principal : c'est une
 *   cible qu'on touche sans viser, entre deux verres.
 *
 * Le fichier reste un fichier shadcn — même API, mêmes noms de variantes,
 * mêmes jetons sémantiques — pour que `bunx shadcn add` reste jouable.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border-[3px] border-border font-semibold text-base whitespace-nowrap outline-none transition-[transform,box-shadow,background-color] duration-75 select-none focus-visible:shadow-[4px_4px_0_var(--ring)] disabled:pointer-events-none disabled:border-muted-foreground/50 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        /** Le geste de l'écran : framboise, ombrée, enfoncée à l'appui. */
        default:
          "bg-primary text-primary-foreground shadow-dure active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        /** Le second geste : la carte, même forme, même ombre. */
        outline:
          "bg-card text-card-foreground shadow-dure active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground shadow-dure active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
        /**
         * Le geste qu'on peut ne pas faire — « quitte la table ».
         *
         * Trait pointillé et **pas d'ombre** : il est cerclé comme le reste,
         * donc visible, mais il ne se soulève pas de la page. C'est ce qui le
         * met au second rang sans le griser.
         */
        ghost: "border-dashed bg-transparent hover:bg-muted",
        /**
         * La confirmation d'un geste lourd — « oui, abandonner ».
         *
         * L'encre pleine, sans ombre : un bouton noir ne s'annonce pas, il
         * arrête. Il n'apparaît qu'après qu'on a déjà demandé la chose.
         */
        destructive: "bg-foreground text-background hover:opacity-90",
        link: "border-transparent bg-transparent text-foreground underline underline-offset-4 hover:text-destructive",
      },
      size: {
        /** 46 px : le geste courant. */
        default: "min-h-[46px] gap-2 px-5 text-[15px]",
        xs: "min-h-9 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "min-h-9 gap-1.5 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        /** 56 px : le geste principal d'un écran, celui qu'on vise de loin. */
        lg: "min-h-14 gap-2 px-7 text-[17px]",
        icon: "size-[46px] px-0",
        "icon-xs": "size-9 px-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 px-0",
        "icon-lg": "size-14 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
