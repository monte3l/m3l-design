#!/usr/bin/env node
/**
 * PreToolUse guard (Bash): keeps a reviewer agent that calls itself read-only to
 * read commands. `disallowedTools` cannot limit single commands, so without this
 * the agent's "read-only" rests on its prompt alone.
 *
 * The hook input names the running subagent in `agent_type` (the `name` of its
 * definition; hooks reference, "Common input fields"). Only the agents listed in
 * READONLY_AGENTS are judged: every other Bash call passes untouched. It is
 * registered in settings.json, not in the agent's frontmatter, because the docs
 * say frontmatter `hooks` are ignored for plugin subagents.
 *
 * For a listed agent a command passes silently when it is one plain command (or a
 * pipe of them) from a fixed list of read commands. Anything else gets
 * `permissionDecision: "ask"`, never a silent block, so a person can approve a
 * command the list does not know. Refused outright to be judged at all (so: ask):
 * a second command (`;`, `&&`, `||`, `&`, newline), a redirect, a substitution
 * (`$(...)`, backticks, `$VAR`), a subshell or group, a backslash, `bash -c`, and
 * `gh api` with a method other than GET or with a body.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Agent names (`agent_type`) that must stay read-only. Add a reviewer's name here. */
export const READONLY_AGENTS = ["Explore", "code-reviewer", "silent-failure-hunter", "token-change-reviewer"];

const GIT_READ = new Set([
  "log", "show", "diff", "status", "ls-files", "rev-parse", "ls-tree", "cat-file", "blame",
  "merge-base", "rev-list", "describe", "shortlog", "diff-tree", "show-ref", "name-rev",
]);
const GH_GROUPS = new Set(["pr", "issue", "run", "workflow", "release", "repo", "label", "gist", "ruleset", "cache"]);
const GH_READ_VERBS = new Set(["view", "list", "status", "diff", "checks"]);

function isEntryPoint() {
  try {
    return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

/**
 * Split a command into pipe segments of words, or return a reason it cannot be
 * judged. Quoting is honoured: inside single quotes everything is literal, inside
 * double quotes only an expansion (`$`, backtick) is refused.
 *
 * @param {string} command
 * @returns {{ segments: string[][] } | { reason: string }}
 */
export function split(command) {
  const segments = [];
  let words = [];
  let word = null;
  let quote = "";
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = "";
      else word += c;
      continue;
    }
    if (c === "$" || c === "`") return { reason: "a substitution or variable" };
    if (quote === '"') {
      if (c === '"') quote = "";
      else if (c === "\\") return { reason: "a backslash" };
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      word ??= "";
      continue;
    }
    if (c === "\\") return { reason: "a backslash" };
    if (c === "|") {
      if (command[i + 1] === "|") return { reason: "a second command (||)" };
      endWord();
      if (words.length === 0) return { reason: "an empty pipe segment" };
      segments.push(words);
      words = [];
      continue;
    }
    if (c === ";" || c === "&" || c === "\n" || c === "\r") return { reason: "a second command" };
    if (c === ">" || c === "<") return { reason: "a redirect" };
    if (c === "(" || c === ")" || c === "{" || c === "}") return { reason: "a subshell or group" };
    if (c === "*" || c === "?" || c === "[" || (c === "~" && word === null)) return { reason: "an unquoted glob or tilde" };
    if (c === " " || c === "\t") {
      endWord();
      continue;
    }
    word = (word ?? "") + c;
  }
  if (quote !== "") return { reason: "an unclosed quote" };
  endWord();
  if (words.length === 0) return { reason: "an empty command" };
  segments.push(words);
  return { segments };
}

// Any word, or the part of one after `=` or `:` (`--file=.env`, `HEAD:.env`), that names a dotenv file or a variant (any case).
const isEnvArg = (arg) =>
  arg.split(/[=:]/).some((part) => {
    const base = path.basename(part).toLowerCase();
    return base.startsWith(".env") && !/\.(example|sample|template|dist)$/.test(base);
  });

/**
 * Why a path operand is refused: it must resolve to something strictly inside the working directory
 * (never the directory itself or anything above or beside it), and not under a `secrets` directory.
 * `-` (standard input) is fine.
 */
function pathProblem(operand, cwd) {
  if (operand === "-") return null;
  const base = path.resolve(cwd);
  const resolved = path.resolve(base, operand);
  if (resolved === base || !resolved.startsWith(base + path.sep)) return `${operand} is not strictly inside the repository`;
  if (resolved.slice(base.length).toLowerCase().split(path.sep).includes("secrets")) return `${operand} is under a secrets directory`;
  return null;
}

const NONE = /(?!)/;
const NUMBER_FLAG = /^-(?:[nc]|\d+|q)$/;
/**
 * Every command that is not special-cased: the flags it may carry (any other argument that starts with `-` asks),
 * the flags that take the next word as a value (not an operand), a cap on operands (`uniq IN OUT` writes OUT, so
 * `uniq` takes one), and whether the operands are paths (each must pass `pathProblem`). A command with no entry asks.
 */
const SPEC = {
  ls: { flags: /^-[alhRtrS1dF]+$/, paths: true },
  cat: { flags: /^-[nbsEv]+$/, paths: true },
  head: { flags: NUMBER_FLAG, value: ["-n", "-c"], paths: true },
  tail: { flags: NUMBER_FLAG, value: ["-n", "-c"], paths: true },
  wc: { flags: /^-[lwcm]+$/, paths: true },
  nl: { flags: NONE, paths: true },
  sort: { flags: /^-[nrufbdVkt]+$/, value: ["-k", "-t"], paths: true },
  uniq: { flags: /^-[cdui]+$/, paths: true, max: 1 },
  stat: { flags: NONE, paths: true },
  file: { flags: /^-[bi]+$/, paths: true },
  cut: { flags: /^-[dfcb].+$/, paths: true },
  diff: { flags: /^-[uqiwB]+$/, paths: true, max: 2 },
  cmp: { flags: /^-[sl]+$/, paths: true, max: 2 },
  tr: { flags: /^-[dsc]+$/, max: 2 },
  basename: { flags: NONE, max: 2 },
  dirname: { flags: NONE, max: 1 },
  realpath: { flags: NONE, paths: true, max: 1 },
  pwd: { flags: NONE, max: 0 },
  which: { flags: NONE, max: 3 },
  true: { flags: NONE, max: 0 },
  test: { flags: /^-[a-z]$/, max: 3 },
  shellcheck: { flags: /^-[xaSsfeP]$|^--(?:format|severity|shell|exclude|external-sources|check-sourced|color|source-path|norc)(?:=.*)?$/, paths: true },
  actionlint: { flags: /^-(?:oneline|no-color|color|verbose|version)$/, paths: true },
};
const SEARCH_FLAGS = {
  grep: /^-[EFGPiIvwxcLlonshHrRqabzABCe]+$|^--(?:include|exclude|exclude-dir|color|line-number|ignore-case|files-with-matches|recursive)(?:=.*)?$/,
  rg: /^-[nilwvcFHhsSIAB]+$|^--(?:files|line-number|ignore-case|fixed-strings|files-with-matches|count|no-heading|type|glob)(?:=.*)?$/,
};
const FIND_FLAGS = /^-(?:name|iname|path|ipath|type|maxdepth|mindepth|mtime|size|empty|print|print0|not|and|or|o|a|newer|prune)$/;
const FIND_VALUE = new Set(["-name", "-iname", "-path", "-ipath", "-type", "-maxdepth", "-mindepth", "-mtime", "-size", "-newer"]);
const JQ_FLAGS = /^-[nrcsSeR]+$|^--(?:arg|argjson|slurp|raw-output|compact-output|sort-keys|exit-status|null-input|tab)$/;
// A jq program can read the environment, other files and standard error.
const JQ_REACH = /\benv\b|\$ENV|\binput_filename\b|\binclude\b|\bimport\b|\binputs?\b|\bdebug\b|\bstderr\b|\$__/;

function judgeSpec(cmd, spec, args, cwd) {
  const operands = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.length > 1 && a.startsWith("-")) {
      if (!spec.flags.test(a)) return `${cmd} flag ${a} is not on the allowed list`;
      if (spec.value?.includes(a)) i++;
      continue;
    }
    operands.push(a);
  }
  if (spec.max !== undefined && operands.length > spec.max) return `${cmd} takes at most ${spec.max} operand${spec.max === 1 ? "" : "s"}`;
  if (spec.paths) {
    for (const operand of operands) {
      const problem = pathProblem(operand, cwd);
      if (problem !== null) return problem;
    }
  }
  return null;
}

/**
 * grep, egrep, fgrep and rg: the options are read properly (a value such as `-A 3`, `-e PATTERN` or
 * `--include X` is not an operand), every path must sit strictly inside the working directory, and a
 * recursive search (always, for rg) must name at least one.
 */
function judgeSearch(cmd, args, cwd) {
  const family = cmd === "rg" ? "rg" : "grep";
  const valueShort = family === "rg" ? "AB" : "ABCefm";
  const valueLong = /^--(?:include|exclude|exclude-dir|type|glob|max-count)$/;
  const operands = [];
  let recursive = family === "rg";
  let patternGiven = false;
  let files = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.length > 1 && a.startsWith("-")) {
      if (!SEARCH_FLAGS[family].test(a)) return `${cmd} flag ${a} is not on the allowed list`;
      if (a.startsWith("--")) {
        if (a === "--recursive") recursive = true;
        if (a === "--files") files = true;
        if (valueLong.test(a)) i++;
        continue;
      }
      const cluster = a.slice(1);
      if (family === "grep" && /[rR]/.test(cluster)) recursive = true;
      if (family === "grep" && cluster.includes("e")) patternGiven = true;
      if ([...cluster].some((ch) => valueShort.includes(ch))) i++;
      continue;
    }
    operands.push(a);
  }
  const paths = patternGiven || files ? operands : operands.slice(1);
  if (recursive && paths.length === 0) return `recursive ${cmd} needs named paths strictly inside the repository`;
  for (const p of paths) {
    const problem = pathProblem(p, cwd);
    if (problem !== null) return problem;
  }
  return null;
}

function judgeFind(args, cwd) {
  let i = 0;
  while (/^-[HLP]$/.test(args[i] ?? "")) i++;
  const starts = [];
  while (i < args.length && !args[i].startsWith("-") && args[i] !== "!") starts.push(args[i++]);
  if (starts.length === 0) return "find needs a named start path";
  for (const p of starts) {
    const problem = pathProblem(p, cwd);
    if (problem !== null) return problem;
  }
  for (; i < args.length; i++) {
    const a = args[i];
    if (a === "!") continue;
    if (!FIND_FLAGS.test(a)) return `find expression ${a} is not on the allowed list`;
    if (FIND_VALUE.has(a)) i++;
  }
  return null;
}

function judgeJq(args, cwd) {
  const operands = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.length > 1 && a.startsWith("-")) {
      if (!JQ_FLAGS.test(a)) return `jq flag ${a} is not on the allowed list`;
      if (a === "--arg" || a === "--argjson") i += 2;
      continue;
    }
    operands.push(a);
  }
  if (operands.length === 0 || JQ_REACH.test(operands[0])) return "jq program is missing or reaches the environment or other files";
  for (const p of operands.slice(1)) {
    const problem = pathProblem(p, cwd);
    if (problem !== null) return problem;
  }
  return null;
}

/** @returns {string | null} why `words` is not a known read command, or null when it is. */
function judge(words, cwd) {
  const [cmd, ...args] = words;
  if (/^[A-Za-z_]\w*=/.test(cmd)) return "an environment assignment before the command";
  if (args.some(isEnvArg)) return "a dotenv secret file";
  switch (cmd) {
    case "git": {
      const sub = args[0];
      if (!sub || !GIT_READ.has(sub)) return `git ${sub ?? ""} is not on the read list`.replace("  ", " ");
      if (args.some((a) => /^(--output|-o$|-O|--ext-diff|--textconv|--open-files-in-pager|--no-index|--git-dir|--work-tree|--exec-path)/.test(a))) return "a git option that writes, runs a program or leaves the repository";
      return null;
    }
    case "gh":
      return judgeGh(args);
    case "node": {
      // Only the test runner on test files: any other flag (`--import`, `-e`, `--env-file`, ...) runs or loads code.
      if (args[0] === "--test" && args.slice(1).every((a) => /^tests\/[\w.-]+\.test\.mjs$/.test(a) || a === "tests/*.test.mjs")) return null;
      if (args[0] === "design/source/docs-kit/build.mjs" && args[1] === "--check" && args.length === 2) return null;
      return "node outside --test and the docs-kit --check";
    }
    case "bash":
      return args[0] === "-n" && args.length === 2 && pathProblem(args[1], cwd) === null ? null : "bash other than `bash -n FILE` inside the repository";
    case "grep":
    case "egrep":
    case "fgrep":
    case "rg":
      return judgeSearch(cmd, args, cwd);
    case "find":
      return judgeFind(args, cwd);
    case "jq":
      return judgeJq(args, cwd);
    default:
      return Object.hasOwn(SPEC, cmd) ? judgeSpec(cmd, SPEC[cmd], args, cwd) : `${cmd} is not on the read list`;
  }
}

// `gh api` is read-only only as a GET with no body, so every flag must be on this list; anything else asks.
// A flag with a value takes the next argument (or `--flag=value`); `-X` and `--method` must say GET.
const GH_API_BOOLEAN = new Set(["--paginate", "--slurp", "--silent", "-i", "--include"]);
const GH_API_VALUE = new Set(["--jq", "-q", "--template", "-t", "--cache", "-H", "--header", "-X", "--method"]);
function judgeGhApi(args) {
  const operands = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-") || a === "-") {
      operands.push(a);
      continue;
    }
    if (GH_API_BOOLEAN.has(a)) continue;
    const eq = a.startsWith("--") ? a.indexOf("=") : -1;
    const flag = eq === -1 ? a : a.slice(0, eq);
    if (!GH_API_VALUE.has(flag)) return `gh api flag ${a} is not on the allowed list`;
    const value = eq === -1 ? args[++i] : a.slice(eq + 1);
    if (value === undefined) return `gh api flag ${a} has no value`;
    if ((flag === "-X" || flag === "--method") && value.toUpperCase() !== "GET") return "gh api with a method other than GET";
    if ((flag === "-H" || flag === "--header") && !/^Accept:/i.test(value)) return "gh api with a header other than Accept";
  }
  if (operands.length !== 1 || operands[0] === "graphql" || /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(operands[0])) return "gh api needs exactly one REST endpoint path";
  return null;
}

function judgeGh(args) {
  const [group, verb] = args;
  if (group === "api") return judgeGhApi(args.slice(1));
  if (GH_GROUPS.has(group) && GH_READ_VERBS.has(verb)) return args.some((a) => a === "-w" || a === "--web") ? "gh with --web opens a browser" : null;
  return `gh ${group ?? ""} ${verb ?? ""} is not on the read list`.replace(/\s+/g, " ").trim();
}

/**
 * Why a command is outside the read list, or null when it may run silently.
 *
 * @param {string} command
 * @returns {string | null}
 */
export function judgeCommand(command, cwd = process.cwd()) {
  const parsed = split(command);
  if ("reason" in parsed) return `the command has ${parsed.reason}`;
  for (const words of parsed.segments) {
    const reason = judge(words, cwd);
    if (reason !== null) return reason;
  }
  return null;
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
  const reason = typeof command === "string" ? judgeCommand(command, typeof input.cwd === "string" ? input.cwd : process.cwd()) : "the command is missing";
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
