import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="font-semibold text-3xl tracking-tight">Scoring Sheets</h1>
      <p className="text-muted-foreground text-sm">
        Suivre les scores des parties de cartes entre amis : une feuille par partie, les manches
        saisies au fil de l&apos;eau, les totaux qui se tiennent à jour tout seuls.
      </p>
      <p className="text-muted-foreground text-sm">
        Le domaine n&apos;est pas encore modélisé. Il passe par un design doc dans{" "}
        <code className="font-mono">docs/specs/</code> avant d&apos;avoir des tables — voir{" "}
        <code className="font-mono">AGENTS.md</code> pour les conventions.
      </p>
      <div>
        <Button asChild>
          <a href="/health">Vérifier /health</a>
        </Button>
      </div>
    </main>
  );
}
