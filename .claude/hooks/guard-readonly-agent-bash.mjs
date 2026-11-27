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
const PLAIN = new Set(["ls", "cat", "head", "tail", "wc", "grep", "egrep", "fgrep", "rg", "jq", "sort", "uniq", "stat", "file", "pwd", "basename", "dirname", "realpath", "cut", "tr", "nl", "diff", "cmp", "test", "true", "which", "shellcheck", "actionlint"]);

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

// Any word, or the part of one after `=` or `:` (`--file=.env`, `HEAD:.env`), that names a dotenv file or a variant.
const isEnvArg = (arg) =>
  arg.split(/[=:]/).some((part) => {
    const base = path.basename(part);
    return base.startsWith(".env") && !/\.(example|sample|template|dist)$/.test(base);
  });

// Flags each command may carry; any other argument that starts with `-` is asked about.
const FLAGS = {
  ls: /^-[alhRtrS1dF]+$/,
  cat: /^-[nbsEv]+$/,
  head: /^-(?:[nc]|\d+|q)$/,
  tail: /^-(?:[nc]|\d+|q)$/,
  wc: /^-[lwcm]+$/,
  grep: /^-[EFGPiIvwxcLlonshHrRqabzABCe]+$|^--(?:include|exclude|exclude-dir|color|line-number|ignore-case|files-with-matches|recursive)(?:=.*)?$/,
  rg: /^-[nilwvcFEHhsSIAB]+$|^--(?:files|line-number|ignore-case|fixed-strings|files-with-matches|count|no-heading|type|glob)(?:=.*)?$/,
  jq: /^-[nrcsSeR]+$|^--(?:arg|argjson|slurp|raw-output|compact-output|sort-keys|exit-status|null-input|tab)$/,
  sort: /^-[nrufbdVkt]+$/,
  uniq: /^-[cdui]+$/,
  file: /^-[bi]+$/,
  cut: /^-[dfcb].*$/,
  tr: /^-[dsc]+$/,
  diff: /^-[uqrNiwB]+$/,
  cmp: /^-[sl]+$/,
  find: /^-(?:name|iname|path|ipath|type|maxdepth|mindepth|mtime|size|empty|print|print0|not|and|or|o|a|newer|prune|H|L|P)$/,
  shellcheck: /^-[xaSsfeP]$|^--(?:format|severity|shell|exclude|external-sources|check-sourced|color|source-path|norc)(?:=.*)?$/,
  actionlint: /^-(?:oneline|no-color|color|verbose|version)$/,
};
const GREP_RECURSIVE = /^-[A-Za-z]*[rR]|^--recursive$/;
const BROAD_PATH = /^(?:\.|\.\.|\/.*|~.*|\.\.\/.*)$/;

/** @returns {string | null} why `words` is not a known read command, or null when it is. */
function judge(words) {
  const [cmd, ...args] = words;
  if (/^[A-Za-z_]\w*=/.test(cmd)) return "an environment assignment before the command";
  if (args.some(isEnvArg)) return "a dotenv secret file";
  if (FLAGS[cmd]) {
    const bad = args.find((a) => a.length > 1 && a.startsWith("-") && !FLAGS[cmd].test(a));
    if (bad !== undefined) return `${cmd} flag ${bad} is not on the allowed list`;
  }
  // A recursive search with no named path, or one that starts at the root, home or a parent, can reach a dotenv file.
  if (cmd === "rg" || (cmd === "grep" && args.some((a) => GREP_RECURSIVE.test(a)))) {
    const operands = args.filter((a) => !a.startsWith("-"));
    const needed = cmd === "rg" && args.includes("--files") ? 1 : args.some((a) => a === "-e" || a === "-f") ? 1 : 2;
    if (operands.length < needed || operands.some((a) => BROAD_PATH.test(a))) return `recursive ${cmd} needs a named path below the repository`;
  }
  switch (cmd) {
    case "git": {
      const sub = args[0];
      if (!sub || !GIT_READ.has(sub)) return `git ${sub ?? ""} is not on the read list`.replace("  ", " ");
      if (args.some((a) => /^(--output|-o$|--ext-diff|--textconv|--open-files-in-pager|-O)/.test(a))) return "a git option that writes or runs a program";
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
      return args[0] === "-n" && args.length === 2 ? null : "bash other than `bash -n FILE`";
    case "find":
      return null;
    case "rg":
    case "sort":
    case "diff":
      return null;
    default:
      return PLAIN.has(cmd) ? null : `${cmd} is not on the read list`;
  }
}

function judgeGh(args) {
  const [group, verb] = args;
  if (group === "api") {
    const rest = args.slice(1);
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (/^(-f|-F|--field|--raw-field|--input)/.test(a) || /^--(field|raw-field|input)=/.test(a)) return "gh api with a request body";
      if (a === "-X" || a === "--method" || /^-X./.test(a) || a.startsWith("--method=")) {
        const value = a === "-X" || a === "--method" ? rest[i + 1] : a.startsWith("--method=") ? a.slice(9) : a.slice(2);
        if (String(value).toUpperCase() !== "GET") return "gh api with a method other than GET";
      }
    }
    if (rest.some((a) => a === "graphql")) return "gh api graphql is a POST";
    return null;
  }
  if (GH_GROUPS.has(group) && GH_READ_VERBS.has(verb)) return null;
  return `gh ${group ?? ""} ${verb ?? ""} is not on the read list`.replace(/\s+/g, " ").trim();
}

/**
 * Why a command is outside the read list, or null when it may run silently.
 *
 * @param {string} command
 * @returns {string | null}
 */
export function judgeCommand(command) {
  const parsed = split(command);
  if ("reason" in parsed) return `the command has ${parsed.reason}`;
  for (const words of parsed.segments) {
    const reason = judge(words);
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
  const reason = typeof command === "string" ? judgeCommand(command) : "the command is missing";
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
