#!/usr/bin/env bash
# PreToolUse(Bash) — refuse les commandes destructives ou irréversibles avant
# qu'elles s'exécutent. Ce qui passe ici est encore rattrapable ; ce qui passe
# au-delà ne l'est plus.
#
# Exit 2 = blocage, stderr remonté à l'agent comme raison du refus.
set -euo pipefail

command=$(jq -r '.tool_input.command // empty')

if [ -z "$command" ]; then
  exit 0
fi

deny() {
  echo "Commande bloquée par .claude/hooks/block-dangerous-bash.sh : $1" >&2
  exit 2
}

# rm récursif+forcé sur une racine, un chemin absolu court, ou un glob nu.
#
# La cible est cherchée dans le seul segment qui porte le `rm`, pas dans la
# commande entière : sinon un `rm -rf .next && biome check .` se fait refuser à
# cause du `.` de la *deuxième* commande.
while IFS= read -r segment; do
  printf '%s' "$segment" | grep -Eq '\brm\b[^|;&]*-[a-zA-Z]*r[a-zA-Z]*f|\brm\b[^|;&]*-[a-zA-Z]*f[a-zA-Z]*r' || continue

  if printf '%s' "$segment" | grep -Eq '\s(/|~|\$HOME|\*|\.)(\s|$)|\s/[A-Za-z]+(\s|$)'; then
    deny "rm -rf sur un chemin trop large"
  fi
done < <(printf '%s\n' "$command" | tr ';&|' '\n\n\n')

# Réécriture d'historique publiée.
if printf '%s' "$command" | grep -Eq 'git\s+push\b[^|;&]*(--force\b|-f\b)' &&
  ! printf '%s' "$command" | grep -q -- '--force-with-lease'; then
  deny "force-push sans --force-with-lease"
fi

if printf '%s' "$command" | grep -Eq 'git\s+reset\s+--hard\b[^|;&]*origin/(main|master)\b'; then
  deny "reset --hard sur la branche distante par défaut"
fi

# Destruction de données locales.
if printf '%s' "$command" | grep -Eq 'git\s+clean\b[^|;&]*-[a-zA-Z]*f[a-zA-Z]*d|git\s+clean\b[^|;&]*-[a-zA-Z]*d[a-zA-Z]*f'; then
  deny "git clean -fd détruit les fichiers non suivis"
fi

# Le fichier .env porte les vraies valeurs ; .env.example est le fichier à éditer.
if printf '%s' "$command" | grep -Eq '(^|[|;&>[:space:]])(cat|less|head|tail|bat)\s+[^|;&]*\.env(\.local|\.production)?(\s|$)'; then
  deny "lecture d'un .env — les valeurs réelles ne remontent pas en contexte, voir .env.example"
fi

if printf '%s' "$command" | grep -Eq '>\s*\.env(\.local|\.production)?(\s|$)'; then
  deny "écriture dans un .env"
fi

exit 0
