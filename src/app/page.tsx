import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="font-semibold text-3xl tracking-tight">bryan-cookie-starter</h1>
      <p className="text-muted-foreground text-sm">
        Next.js · TypeScript strict · Drizzle/SQLite · Zod · Tailwind + shadcn/ui · Biome · Vitest ·
        Playwright.
      </p>
      <p className="text-muted-foreground text-sm">
        Remplace cette page. <code className="font-mono">SETUP.md</code> porte la checklist de
        scaffolding, <code className="font-mono">AGENTS.md</code> les conventions.
      </p>
      <div>
        <Button asChild>
          <a href="/health">Vérifier /health</a>
        </Button>
      </div>
    </main>
  );
}
