#!/usr/bin/env node
/**
 * PreToolUse guard (Bash): keeps a reviewer agent that calls itself read-only to a short list of read commands.
 * Best effort, and it asks by default: a shell cannot be policed completely from its text, so this passes
 * silently only what it can recognise exactly, and answers `permissionDecision: "ask"` for everything else.
 *
 * The hook input names the running subagent in `agent_type` (the `name` of its definition; hooks reference,
 * "Common input fields"). Only the agents in READONLY_AGENTS are judged: every other Bash call passes untouched.
 * It is registered in settings.json, not in the agent's frontmatter, because the docs say frontmatter `hooks`
 * are ignored for plugin subagents.
 *
 * A command passes silently only when it is ONE simple command: no pipe, `;`, `&`, `|`, redirect, `$`,
 * backtick, backslash, parenthesis, brace, glob, `~`, `!`, `#` or newline anywhere, no variable assignment
 * in front, and no bundled short options (`-rn`). Only quotes group a word. The shapes are:
 *   git log|show|diff|status|ls-files|rev-parse|branch --list   with a short fixed flag list
 *   ls, cat, head, tail, wc                                       with fixed flags and named paths
 *   grep, rg (named regular files only: never a directory, never recursive, no globs)
 *   gh pr|issue|run|workflow|release|repo|label view|list         with fixed flags
 *   node --test test/NAME.test.mjs
 * Everything else asks: jq, gh api, find, sort, uniq, diff, shellcheck, wrappers, and so on.
 * Every path operand is resolved with realpath and must lie strictly inside the git toplevel of the working
 * directory, and not name a dotenv file (any case) or sit under `secrets/`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Agent names (`agent_type`) that must stay read-only. Add a reviewer's name here. */
export const READONLY_AGENTS = ["Explore", "code-reviewer", "silent-failure-hunter", "token-change-reviewer"];

function isEntryPoint() {
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

// Anything here, in or out of quotes, makes the command one this guard does not judge.
const REFUSED = /[|;&<>$`\\(){}[\]*?!#\n\r]/;

/** The words of a single simple command, or null when it is not one. Quotes only group; they hide nothing. */
function words(command) {
  if (REFUSED.test(command)) return null;
  const out = [];
  let word = null;
  let quote = "";
  for (const c of command) {
    if (quote !== "") {
      if (c === quote) quote = "";
      else word += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word ??= "";
    } else if (c === " " || c === "\t") {
      if (word !== null) out.push(word);
      word = null;
    } else word = (word ?? "") + c;
  }
  if (quote !== "") return null;
  if (word !== null) out.push(word);
  // A word that starts with `~` is a home directory.
  return out.length > 0 && !out.some((w) => w.startsWith("~")) ? out : null;
}

const TEMPLATE_SUFFIX = /\.(example|sample|template|dist)$/;

/** The git toplevel of `cwd`, resolved, or null. */
function toplevel(cwd) {
  try {
    const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
    return r.status === 0 ? fs.realpathSync(r.stdout.trim()) : null;
  } catch {
    return null;
  }
}

/**
 * Why a path operand is refused, or null. It is resolved with realpath (an error refuses), relative to the
 * real working directory, and must lie strictly inside `top`; no part of it may be a dotenv file or `secrets`.
 */
function pathProblem(operand, cwd, top) {
  if (top === null) return "the git toplevel of the working directory is unknown";
  let real;
  try {
    real = fs.realpathSync(path.resolve(fs.realpathSync(cwd), operand));
  } catch {
    return `${operand} cannot be resolved`;
  }
  if (real === top || !real.startsWith(top + path.sep)) return `${operand} is not strictly inside the repository`;
  for (const part of real.slice(top.length + 1).toLowerCase().split(path.sep)) {
    if (part === "secrets" || (part.startsWith(".env") && !TEMPLATE_SUFFIX.test(part))) return `${operand} is a secrets path`;
  }
  return null;
}

/**
 * Sort `args` into flags (checked against `allowed`, a set of exact flags; `--name=value` is checked by its name
 * in `valued`) and operands. `numbered` allows `-5` style flags. A flag that is not listed is returned as a reason.
 */
function parse(cmd, args, { allowed = [], valued = [], numbered = false, valueNext = [] }) {
  const flags = new Set(allowed);
  const valuedNames = new Set(valued);
  const nextNames = new Set(valueNext);
  const operands = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") return { reason: `${cmd} with a bare --` };
    if (!a.startsWith("-") || a === "-") {
      operands.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0 && valuedNames.has(a.slice(0, eq))) continue;
    if (flags.has(a) || (numbered && /^-\d{1,4}$/.test(a))) continue;
    if (nextNames.has(a) && /^\d{1,6}$/.test(args[i + 1] ?? "")) {
      i++;
      continue;
    }
    return { reason: `${cmd} flag ${a} is not on the allowed list` };
  }
  return { operands };
}

const GIT_SUBCOMMANDS = {
  log: { allowed: ["--oneline", "--name-only", "--name-status", "--stat", "--shortstat", "--numstat", "--no-color", "--graph", "--decorate", "--first-parent", "--merges", "--no-merges"], valued: ["--max-count", "--since", "--until", "--author", "--pretty", "--format"], numbered: true, valueNext: ["-n"] },
  show: { allowed: ["--oneline", "--name-only", "--name-status", "--stat", "--shortstat", "--numstat", "--no-color"], valued: ["--pretty", "--format"], numbered: false, valueNext: [] },
  diff: { allowed: ["--name-only", "--name-status", "--stat", "--shortstat", "--numstat", "--cached", "--staged", "--no-color"], valued: [], numbered: false, valueNext: [] },
  status: { allowed: ["--short", "--porcelain", "--branch", "-s", "-b"], valued: [], numbered: false, valueNext: [] },
  "ls-files": { allowed: ["--cached", "--others", "--modified", "--deleted", "--exclude-standard", "-c", "-o", "-m"], valued: [], numbered: false, valueNext: [] },
  "rev-parse": { allowed: ["--show-toplevel", "--abbrev-ref", "--short", "--verify", "--git-dir"], valued: [], numbered: false, valueNext: [] },
  branch: { allowed: ["--list", "--all", "--remotes", "--show-current", "-a", "-r"], valued: [], numbered: false, valueNext: [] },
};
// A revision, a range or a ref: no leading dash, no absolute path, no `..` directory.
const REVISION = /^[A-Za-z0-9_@~^][A-Za-z0-9_./@~^-]*$/;

function judgeGit(args, cwd, top) {
  const [sub, ...rest] = args;
  const spec = GIT_SUBCOMMANDS[sub];
  if (!spec) return `git ${sub ?? ""} is not on the read list`.replace("  ", " ");
  const parsed = parse(`git ${sub}`, rest, spec);
  if (parsed.reason) return parsed.reason;
  if (sub === "branch" && !rest.includes("--list") && !rest.includes("--show-current")) return "git branch only with --list or --show-current";
  // git show and git diff print a patch or a file body, which can show a secret, and take refs, ranges and paths
  // that cannot be judged by name. They pass only as a listing of names (one of the flags below) with no operand,
  // or with exactly HEAD, HEAD~N or HEAD^. Anything else asks.
  if (sub === "diff" || sub === "show") {
    if (!rest.some((f) => ["--name-only", "--name-status", "--stat", "--shortstat", "--numstat"].includes(f))) {
      return `git ${sub} needs --name-only, --name-status or --stat`;
    }
    if (parsed.operands.length > 1 || (parsed.operands.length === 1 && !/^HEAD(?:~[0-9]{1,3}|\^)?$/.test(parsed.operands[0]))) {
      return `git ${sub} takes no operand, or exactly HEAD, HEAD~N or HEAD^`;
    }
    return null;
  }
  for (const operand of parsed.operands) {
    // Whatever else is true of a revision or path, no part may be a secrets directory or a dotenv file (it need not exist).
    for (const part of operand.toLowerCase().split(/[/:]/)) {
      if (part === "secrets" || (part.startsWith(".env") && !TEMPLATE_SUFFIX.test(part))) return `${operand} is a secrets path`;
    }
    // `REV:path` names a file at a revision; the path part is checked as a path.
    const [rev, ...pathParts] = operand.split(":");
    if (pathParts.length > 1) return `${operand} is not a plain revision or path`;
    if (rev !== "" && !(REVISION.test(rev) && !rev.split("/").includes(".."))) {
      const problem = pathProblem(rev, cwd, top);
      if (problem !== null) return problem;
    }
    if (pathParts.length === 1) {
      const problem = pathProblem(path.join(top ?? "", pathParts[0]), cwd, top);
      if (problem !== null) return problem;
    }
  }
  return null;
}

function judgePaths(cmd, args, cwd, top, spec, { minPaths = 1, skipFirst = false } = {}) {
  const parsed = parse(cmd, args, spec);
  if (parsed.reason) return parsed.reason;
  const operands = skipFirst ? parsed.operands.slice(1) : parsed.operands;
  if (skipFirst && parsed.operands.length === 0) return `${cmd} needs a pattern`;
  if (operands.length < minPaths) return `${cmd} needs a named path`;
  for (const operand of operands) {
    const problem = pathProblem(operand, cwd, top) ?? (cmd === "rg" || cmd === "grep" ? regularFileProblem(operand, cwd) : null);
    if (problem !== null) return problem;
  }
  return null;
}

/** A search names regular files only: a directory would be searched recursively, past what the guard can see. */
function regularFileProblem(operand, cwd) {
  try {
    const real = fs.realpathSync(path.resolve(fs.realpathSync(cwd), operand));
    return fs.statSync(real).isFile() ? null : `${operand} is not a regular file`;
  } catch {
    return `${operand} cannot be read`;
  }
}

const SIMPLE = {
  ls: { allowed: ["-l", "-a", "-h", "-t", "-r", "-1", "-d"] },
  cat: { allowed: ["-n"] },
  head: { allowed: [], numbered: true, valueNext: ["-n"] },
  tail: { allowed: [], numbered: true, valueNext: ["-n"] },
  wc: { allowed: ["-l", "-w", "-c"] },
};
const SEARCH = {
  grep: { allowed: ["-n", "-i", "-v", "-w", "-F", "-E", "-l", "-c", "-H", "-h", "-s", "-x", "-o"], valued: ["--max-count"] },
  rg: { allowed: ["-n", "-i", "-w", "-F", "-l", "-c", "-v", "-s", "--files"], valued: ["--type", "--max-count"] },
};
const GH_GROUPS = new Set(["pr", "issue", "run", "workflow", "release", "repo", "label"]);
const GH_VERBS = new Set(["view", "list"]);
const GH_FLAGS = {
  allowed: ["--comments", "--log", "--log-failed", "--verbose"],
  valued: ["--json", "--limit", "--state", "--label", "--author", "--branch", "--workflow", "--status"],
};

function judgeGh(args) {
  const [group, verb, ...rest] = args;
  if (!GH_GROUPS.has(group) || !GH_VERBS.has(verb)) return `gh ${group ?? ""} ${verb ?? ""} is not on the read list`.replace(/\s+/g, " ").trim();
  const parsed = parse(`gh ${group} ${verb}`, rest, GH_FLAGS);
  if (parsed.reason) return parsed.reason;
  if (parsed.operands.length > 1 || parsed.operands.some((o) => !/^[\w.-]+(?:\/[\w.-]+)?$/.test(o))) return "gh view or list with an unexpected operand";
  return null;
}

/**
 * Why a command is outside the read list, or null when it may run silently.
 *
 * @param {string} command
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function judgeCommand(command, cwd = process.cwd()) {
  const w = words(command);
  if (w === null) return "the command is not one simple command (pipe, redirect, expansion, glob, escape or unclosed quote)";
  const [cmd, ...args] = w;
  if (w.some((word) => word.split(/[=:]/).some((part) => path.basename(part).toLowerCase().startsWith(".env") && !TEMPLATE_SUFFIX.test(part.toLowerCase())))) {
    return "a dotenv secret file";
  }
  const top = toplevel(cwd);
  switch (cmd) {
    case "git":
      return judgeGit(args, cwd, top);
    case "gh":
      return judgeGh(args);
    case "node": {
      const ok = args.length === 2 && args[0] === "--test" && /^test\/[\w.-]+\.test\.mjs$/.test(args[1]);
      return ok ? pathProblem(args[1], cwd, top) : "node outside `node --test test/NAME.test.mjs`";
    }
    case "grep":
    case "rg": {
      const files = cmd === "rg" && args.includes("--files");
      return judgePaths(cmd, args, cwd, top, SEARCH[cmd], { skipFirst: !files });
    }
    default:
      return Object.hasOwn(SIMPLE, cmd) ? judgePaths(cmd, args, cwd, top, SIMPLE[cmd]) : `${cmd} is not on the read list`;
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

if (isEntryPoint()) {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    input = null;
  }
  // A payload that cannot be read cannot say which agent runs: fail closed, as the sibling guards do.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    process.stderr.write("[guard-readonly-agent-bash] could not read the hook payload; blocking.\n");
    process.exit(2);
  }
  if (!READONLY_AGENTS.includes(input.agent_type)) process.exit(0);
  const command = input.tool_input?.command;
  const cwd = typeof input.cwd === "string" && input.cwd !== "" ? input.cwd : process.cwd();
  const reason = typeof command === "string" ? judgeCommand(command, cwd) : "the command is missing";
  if (reason === null) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `[guard-readonly-agent-bash] ${input.agent_type} is read-only; outside its read list: ${reason}.`,
      },
    }),
  );
  process.exit(0);
}
