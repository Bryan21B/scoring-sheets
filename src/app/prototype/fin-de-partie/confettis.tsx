"use client";

/**
 * PROTOTYPE JETABLE — confettis écrits à la main, issue #10.
 *
 * Volontairement **sans dépendance**. Le ticket demande quelle bibliothèque
 * prendre ; y répondre en installant `canvas-confetti` d'entrée reviendrait à
 * trancher avant d'avoir vu. Ces ~60 lignes suffisent à juger la *sensation* —
 * durée, densité, s'il faut une deuxième salve — et c'est la sensation qui
 * décide, pas l'API.
 *
 * Ce qu'une vraie bibliothèque apporterait en plus : les formes, la gravité
 * réglable, `prefers-reduced-motion`, et surtout de ne pas maintenir ça.
 */

import { useEffect, useRef } from "react";

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vitesseRotation: number;
  couleur: string;
  taille: number;
};

const COULEURS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

/**
 * Une salve de confettis en plein écran, tirée au montage.
 *
 * `actif` à `false` ne tire rien : c'est ce qui distingue la fin fraîche d'un
 * lien rouvert trois jours plus tard, où la fête serait déplacée.
 *
 * `intensite` multiplie le nombre de pièces — de quoi comparer une salve
 * discrète et une salve franche sans changer le code.
 *
 * Pour retirer une salve, donner une `key` différente au composant : c'est un
 * remontage, pas un effet à réveiller.
 */
export function Confettis({ actif, intensite = 1 }: { actif: boolean; intensite?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!actif) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    // Respecter le réglage système : une animation plein écran non désirée est une agression.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const largeur = canvas.offsetWidth;
    const hauteur = canvas.offsetHeight;
    canvas.width = largeur * 2;
    canvas.height = hauteur * 2;
    ctx.scale(2, 2);

    const nombre = Math.round(120 * intensite);
    const pieces: Piece[] = Array.from({ length: nombre }, () => ({
      x: largeur / 2 + (Math.random() - 0.5) * largeur * 0.6,
      y: hauteur * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 11 - 4,
      rotation: Math.random() * Math.PI,
      vitesseRotation: (Math.random() - 0.5) * 0.3,
      couleur: COULEURS[Math.floor(Math.random() * COULEURS.length)] ?? "#ef4444",
      taille: 5 + Math.random() * 6,
    }));

    let frame = 0;
    let animation = 0;
    function boucle() {
      if (ctx === null) {
        return;
      }
      frame += 1;
      ctx.clearRect(0, 0, largeur, hauteur);
      for (const piece of pieces) {
        piece.vy += 0.32;
        piece.vx *= 0.995;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.vitesseRotation;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.globalAlpha = Math.max(0, 1 - frame / 190);
        ctx.fillStyle = piece.couleur;
        ctx.fillRect(-piece.taille / 2, -piece.taille / 4, piece.taille, piece.taille / 2);
        ctx.restore();
      }
      if (frame < 190) {
        animation = requestAnimationFrame(boucle);
      } else {
        ctx.clearRect(0, 0, largeur, hauteur);
      }
    }
    animation = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(animation);
  }, [actif, intensite]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-30 h-full w-full" />
  );
}
