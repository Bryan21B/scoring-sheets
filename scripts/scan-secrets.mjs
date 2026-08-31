#!/usr/bin/env node
import { execFileSync } from "node:child_process";

/**
 * Blocks a push carrying credentials.
 *
 * Runs at pre-push rather than pre-commit on purpose: a secret committed
 * locally is recoverable with a rebase, one that reached the remote has to be
 * treated as burned. This complements the pre-commit hook, it does not replace
 * it.
 *
 * Every git invocation goes through `execFileSync` with an argument array —
 * interpolating a branch or file name into a shell string is CWE-78.
 */
const PATTERNS = [
  { name: "clé d'accès AWS", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "bloc de clé privée PEM", regex: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { name: "token GitHub", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "clé secrète Stripe", regex: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: "clé API Anthropic", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "clé API OpenAI", regex: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/ },
  {
    name: "JSON web token",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    name: "URL de connexion avec mot de passe",
    regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@/,
  },
];

/** Binary blobs and lockfiles produce nothing but false positives. */
const SKIPPED =
  /(^|\/)(bun\.lock|package-lock\.json|pnpm-lock\.yaml)$|\.(png|jpe?g|gif|ico|webp|pdf|woff2?)$/;

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // Les sondes ci-dessous échouent volontairement ; leur stderr n'est pas une
    // information pour l'utilisateur.
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Renvoie la sortie de git, ou `null` si la commande échoue. */
function tryGit(args) {
  try {
    return git(args).trim();
  } catch {
    return null;
  }
}

/**
 * Fichiers à inspecter avant un push.
 *
 * Trois cas, du plus précis au plus large :
 *   1. La branche a un upstream → seulement ce qui le sépare de HEAD.
 *   2. Pas d'upstream mais une branche par défaut distante connue → tout ce qui
 *      sépare le point de divergence de HEAD.
 *   3. Rien de tout ça (repo jamais poussé) → tous les fichiers suivis.
 *
 * Le cas 3 doit rester un scan complet : comparer au worktree ne renverrait rien
 * une fois les secrets commités, c'est-à-dire précisément quand le push les
 * emmène.
 */
function filesToScan() {
  const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);

  if (upstream !== null) {
    return listDiff(`${upstream}..HEAD`);
  }

  const defaultRef = tryGit(["rev-parse", "--abbrev-ref", "origin/HEAD"]);
  const base = defaultRef === null ? null : tryGit(["merge-base", defaultRef, "HEAD"]);

  if (base !== null) {
    return listDiff(`${base}..HEAD`);
  }

  return filter(git(["ls-tree", "-r", "--name-only", "HEAD"]));
}

function listDiff(range) {
  return filter(git(["diff", "--name-only", range]));
}

function filter(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !SKIPPED.test(line));
}

const findings = [];

for (const file of filesToScan()) {
  let content;
  try {
    content = git(["show", `HEAD:${file}`]);
  } catch {
    continue; // Fichier supprimé dans le range.
  }

  content.split("\n").forEach((line, index) => {
    for (const { name, regex } of PATTERNS) {
      if (regex.test(line)) {
        findings.push(`  ${file}:${index + 1} — ${name}`);
      }
    }
  });
}

if (findings.length > 0) {
  process.stderr.write(
    [
      "Push bloqué : secret potentiel détecté.",
      ...findings,
      "",
      "Retire-le et réécris l'historique avant de repousser.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
