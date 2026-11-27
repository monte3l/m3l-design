#!/usr/bin/env node
/**
 * PreToolUse blocking (Write|Edit|NotebookEdit|Bash): refuse to write a real secret to disk.
 *
 * CLAUDE.md's Security section requires that no secret or token ever land in
 * source, tests, or fixtures. A CI secret-scanning step is the backstop;
 * this hook is the earlier, write-time block so a credential never reaches
 * the working tree -- where it would linger in git reflog/objects even
 * after a fix.
 *
 * Two independent triggers, both hard-block (exit 2):
 *   1. Path: a dotenv file (`.env`, `.env.local`, ...) -- these are
 *      gitignored secret stores and should never be authored by the agent.
 *      Template variants (`.env.example`/`.sample`/`.template`/`.dist`) are
 *      allowed.
 *   2. Content: a known secret-key assignment carrying a *real* value, or a
 *      recognised high-entropy token/private-key literal. References and
 *      placeholders (`${{ secrets.X }}`, `process.env.X`, `<your-token>`, ...)
 *      are NOT flagged -- the point is to catch values, not names.
 *
 * A Bash command is held to the same rules where it writes a file: a redirect
 * (`>`, `>>`, `&>`, `>|`) or `tee` aimed at a dotenv file is blocked, and so is a
 * command that has such a write (other than to /dev/null or a file descriptor)
 * and carries a secret literal, which covers `echo KEY=value > f` and a heredoc.
 * A command that writes nothing is not judged: it holds a token only in memory.
 *
 * Detection is deliberately conservative: prefix-anchored token shapes and
 * placeholder exclusion keep false positives off legitimate config/docs
 * (e.g. `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` in a workflow).
 */
import process from "node:process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Exact env-var names whose assigned *value* is a secret we must never
 * persist. A project-specific key can be appended here, which makes the copy
 * custom, so template-sync stops refreshing it.
 */
export const SECRET_KEYS = [
  "NPM_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SESSION_TOKEN",
  "API_KEY",
];

// High-signal literal shapes -- a match is almost certainly a real credential.
const TOKEN_LITERALS = [
  /\bgh[pousr]_[A-Za-z0-9]{36}\b/, // GitHub token: personal, OAuth, user-to-server, server-to-server, refresh
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/, // GitHub fine-grained PAT
  /\bnpm_[A-Za-z0-9]{36}\b/, // npm automation token
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, // PEM private key
];

/**
 * A value is a placeholder/reference, not a real secret, when it defers to an
 * env var or CI secret, or is an obvious dummy. Such values must not be flagged.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isPlaceholderValue(value) {
  const v = value.trim().replace(/^["'`]|["'`]$/g, "");
  if (v.length === 0) return true;
  if (/^[.…]+$/.test(v)) return true; // "..." or an ellipsis: text that elides the value
  // A value that is only a reference to a variable: `${X}`, `$X`, `${{ secrets.X }}`.
  // A lookup call or index is judged by `afterReference`; matching a prefix here
  // would let a real token that merely starts like one through.
  const bare = /^(?:\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*))$/.exec(v);
  if (bare && isRefName(bare[1] ?? bare[2])) return true;
  if (/^\$\{\{[^}]*\}\}$/.test(v)) return true;
  if (/^<.*>$/.test(v)) return true; // <your-token>
  // A dummy is a marker word set off from the rest by a delimiter (or the whole
  // value), such as `your_token_here` or `example-token`. A marker buried inside
  // a longer alphanumeric run (`s3cr3tfakeA1b2...`) is not one.
  if (
    /(?:^|[^A-Za-z0-9])(?:example|placeholder|changeme|your|dummy|fake|redacted|x{3,})(?:[^A-Za-z0-9]|$)/i.test(
      v,
    )
  )
    return true;
  // Too short / low-entropy to be a real token.
  return v.length < 16;
}

/**
 * The value an assignment gives: a quoted string up to its closing quote, else
 * the run up to a space, comma, semicolon or closing bracket. What follows on the
 * line (a comment, the rest of a JSON object, a sentence) is not the value.
 *
 * @param {string} rest the text after the `=` or `:`
 * @returns {string}
 */
function firstValue(rest) {
  const text = rest.trim();
  const quoted = /^(["'`])(.*?)\1/.exec(text);
  if (quoted) return quoted[2];
  // A `${...}` or `$(...)` is one unit, so `${X}<token>` and `$(cmd)<token>` are
  // read to their end, not to the brace or the space. A backtick ends the value:
  // it closes a code span in prose.
  return /^(?:\$\{+[^}]*\}+|\$\([^)]*\)|[^\s,;)\]}`])*/.exec(text)?.[0] ?? "";
}

/**
 * A variable name that reads as a name and not as a value: `NPM_TOKEN`, `npm_config_x`,
 * or a short word. A mixed-case run of letters and digits is a token, not a name.
 */
const isEnvName = (name) =>
  /^[A-Z][A-Z0-9_]*$/.test(name) ||
  (/^[a-z][a-z0-9_]*$/.test(name) && (name.length < 16 || name.includes("_")));

/**
 * Whether `$NAME` or `${NAME}` is a reference to a variable and not a token with a dollar sign in front.
 * The name is short (40 characters at most), does not begin like a token (`ghp_`, `sk-`, `AKIA`, ...), and
 * is an environment variable's name (`isEnvName`) or letters and underscores only (a camelCase name such
 * as `githubTokenForTests`). A run that mixes letters and digits in no pattern is a value.
 */
const isRefName = (name) =>
  name.length <= 40 && !spelledLikeToken(name) && (isEnvName(name) || /^[A-Za-z_]+$/.test(name));

/**
 * Whether a name begins like a token (`ghp_...`, `sk-...`, `npm_...`). A short snake_case name of letters
 * only that happens to start with one (`npm_config_cache`, `sk_live_mode`) is a name, as a token has digits
 * or is longer.
 */
const spelledLikeToken = (name) =>
  TOKEN_PREFIX.test(name) && !(name.length < 30 && /^[A-Za-z]+(?:_[A-Za-z]+)+$/.test(name));

/**
 * The text of a bracketed reference up to and including its `closer` (what is
 * inside may hold a default, so it is read), and what follows it. `quote` is the
 * quote the value opened with, if any: the same quote right after the closer
 * closes the value and is not part of what follows. Returns null when the
 * reference never closes.
 *
 * @param {string} text the text after the opening token
 * @param {string} closer
 * @param {string} quote
 * @returns {{ scan: string, suffix: string } | null}
 */
function through(text, closer, quote) {
  const end = text.indexOf(closer);
  if (end === -1) return null;
  let suffix = text.slice(end + closer.length);
  if (quote !== "" && suffix.startsWith(quote)) suffix = suffix.slice(1);
  return { scan: text.slice(0, end + closer.length), suffix };
}

/**
 * What a reference may be followed by: nothing, a space or a delimiter, or a code
 * span's closing backtick in prose. More value stuck to it (`${X}<token>`,
 * `${X}"<token>"`, `$(cmd)'<token>'`) makes the whole a value, not a lookup.
 */
const endsReference = (suffix) =>
  suffix === "" ||
  /^[\s,;)\]}]/.test(suffix) ||
  (suffix[0] === "`" && (suffix.length === 1 || /[\s:.,;)\]}]/.test(suffix[1])));

/**
 * The literals after a default operator (`|| "x"`, `?? 'x'`, `or "x"`, `| "x"`),
 * however many are chained: what a default looks like once the reference ended.
 */
function defaultLiterals(tail) {
  const found = [];
  let rest = tail;
  for (let m; (m = /^\s*(?:\|\||\?\?|\bor\b|\|)\s*(["'])((?:\\.|(?!\1).)*)\1/.exec(rest)); ) {
    found.push(m[2]);
    rest = rest.slice(m[0].length);
  }
  return found;
}

/**
 * What follows a lookup of the environment on an object or a function: an index
 * (`["X"]`), a call (`("X"`, `.get("X"`, `.fetch("X"`) or a plain `.NAME` property
 * whose name reads as a name. Returns the text after the variable name, where a
 * default would be, or null when it is none of those (so the value is not a
 * lookup at all).
 */
function afterAccess(text, call) {
  // More value glued to an index or a property (`.get-<token>`, `["X"]-<token>`) is not a lookup.
  const ended = (rest) => (rest === "" || /^[\s"'`),;}\]|&?:]/.test(rest) ? rest : null);
  let m;
  if (!call && (m = /^\[\s*(["'])(?:(?!\1).)*\1\s*\]/.exec(text))) return ended(text.slice(m[0].length));
  if (!call && (m = /^\[[^\]"']*\]/.exec(text))) return ended(text.slice(m[0].length));
  if ((m = /^(?:\.(?:get|fetch))?\s*\(\s*(?:(["'])(?:(?!\1).)*\1)?/.exec(text))) return text.slice(m[0].length);
  if (!call && (m = /^\.([A-Za-z_]\w*)(?![\w(])/.exec(text)) && isEnvName(m[1])) return ended(text.slice(m[0].length));
  return null;
}

/**
 * A JavaScript template literal's interpolation that is a reference and not a value: a name or a
 * dotted path of names (`${token}`, `${process.env.NPM_TOKEN}`), or a call of one whose arguments are
 * names and numbers (`${randomToken()}`, `${makeToken(32)}`, `${tokens.make(len, kind)}`). A name has at
 * most 32 characters and a number at most 4 digits. A body outside this grammar (a string, a template, an
 * operator, a `$`, a nested call, a longer name or number) is read as a value (`${X || "<token>"}`,
 * `${fn("<token>")}`, `${a.b.<token>}`).
 */
const JS_INTERPOLATION = (() => {
  // A strict grammar, and nothing else: no `$`, no quote, no operator, no nested `${`, no digit run of five or more.
  const ident = "[A-Za-z_][A-Za-z0-9_]{0,31}";
  const path = `${ident}(?:\\.${ident})*`;
  const arg = `(?:${path}|\\d{1,4})`;
  return new RegExp(`^\\$\\{\\s*(${path})(\\(\\s*(?:${arg}(?:\\s*,\\s*${arg})*)?\\s*\\))?\\s*\\}`);
})();

/**
 * A reference to the environment or a CI secret at the start of `text`:
 *  - null when the value does not start with one (`ENV-<token>`, `getenv-<token>`,
 *    `env.<token>` and `os.environ<token>` are values, not references: the head must
 *    be followed by what a lookup is followed by);
 *  - `{ scan, suffix, after }` when it is one: `scan` is read for any quoted literal (a
 *    default inside the reference), `suffix` is what follows it on the line, and
 *    `after` is everything after the head, which is read for any run that looks
 *    like a secret;
 *  - "unclosed" when a bracketed reference never closes.
 *
 * @param {string} text
 * @param {string} quote the quote the value opened with, or ""
 * @returns {{ scan: string, suffix: string, after: string } | "unclosed" | null}
 */
function afterReference(text, quote) {
  let m;
  const bracket = (opening, closer) => {
    const closed = through(text.slice(opening), closer, quote);
    return closed === null ? "unclosed" : { ...closed, after: text.slice(opening) };
  };
  const plain = (from, scan = text.slice(from)) => ({ scan, suffix: "", after: text.slice(from) });
  if (text.startsWith("${{")) return bracket(3, "}}");
  if ((m = JS_INTERPOLATION.exec(text))) {
    // A JavaScript template literal's `${...}` whose body is only names and numbers holds no literal.
    const closed = through(text.slice(2), "}", quote);
    if (closed === null) return "unclosed";
    // The body matched a strict grammar (see JS_INTERPOLATION): a path of names, optionally called with
    // names and numbers of at most four digits. Each name must also be a name: not spelled like a token and
    // not a run that looks like a secret (16 or more characters of letters and digits). A lone `${NAME}` is
    // judged as `${NAME}` is (`isRefName`); a name inside a path or call may be a short camelCase name with
    // a digit and capitals (`accessToken2`, `sha256Hash`). Otherwise it is no reference and the whole is
    // read as a value.
    const names = `${m[1]}.${m[2] ?? ""}`.split(/[\s.,()]+/).filter((part) => part !== "" && !/^\d+$/.test(part));
    const isName = (part) => !spelledLikeToken(part) && (TOKEN_PREFIX.test(part) || !looksLikeSecretRun(part));
    if (!names.every(isName)) return null;
    if (m[2] === undefined && !m[1].includes(".") && !isRefName(m[1])) return null;
    return { ...closed, after: text.slice(m[0].length) };
  }
  if ((m = /^\$\{([A-Za-z_]\w*)(?=[}:])/.exec(text))) return isRefName(m[1]) ? bracket(m[0].length, "}") : null;
  if (text.startsWith("$(")) return bracket(2, ")");
  if ((m = /^\$([A-Za-z_]\w*)(?=$|[\s"'`),;}\]])/.exec(text))) return isRefName(m[1]) ? plain(m[0].length) : null;
  if ((m = /^(?:secrets|env)\.([A-Za-z_][\w-]*)(?![\w.-])/.exec(text))) return isEnvName(m[1]) ? plain(m[0].length) : null;
  if ((m = /^(?:process\.env|os\.environ|ENV)(?=[[.])/.exec(text))) {
    const scan = afterAccess(text.slice(m[0].length), false);
    return scan === null ? null : plain(m[0].length, scan);
  }
  if ((m = /^(?:os\.getenv|System\.getenv|getenv)(?=\s*\()/.exec(text))) {
    const scan = afterAccess(text.slice(m[0].length), true);
    return scan === null ? null : plain(m[0].length, scan);
  }
  return null;
}

/**
 * A hyphenated identifier made of lowercase words, the way a repository or a package is named
 * (`m3l-output-governor`, `claude-code-plugin`, `m3l-s3-bucket-name`). Every part starts with a letter and is
 * either a plain word (letters only) or a short part that mixes in a digit (`m3l`, `v2`, `s3`: at most four
 * characters), at most two of those, and at least one part is a plain word of three letters or more. A
 * letters-only part of eight or more letters that are all hex digits (`deadbeef`) is not a word. A token is
 * not one: it has a long part that mixes letters and digits (`key-a1b2c3d4e5f6g7h8i9j0`), or groups of them
 * (`ab12-cd34-ef56-gh78`), or a part that starts with a digit (a UUID).
 */
function isHyphenatedName(run) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+$/.test(run)) return false;
  const parts = run.split("-");
  let mixed = 0;
  for (const part of parts) {
    if (/^[a-z]+$/.test(part)) {
      if (part.length >= 8 && /^[a-f]+$/.test(part)) return false;
    } else if (part.length > 4) {
      return false;
    } else {
      mixed++;
    }
  }
  return mixed <= 2 && parts.some((part) => /^[a-z]{3,}$/.test(part));
}

// Prefixes of credentials that are tokens whatever else they look like. `key-` is taken only when a digit
// follows directly, that is in the part right after the hyphen, so names such as `key-value-store-v2` and
// `key-manager-v2-prod` are not tokens.
const TOKEN_PREFIX = /^(?:gh[pousr]_|github_pat_|npm_|AKIA|ASIA|sk-|sk_|rk_|xox[abprs]-|glpat-|AIza|ya29\.|key-(?=[A-Za-z0-9]*\d))/;

/**
 * Whether a run of characters looks like a secret by the same rules as a plain value
 * (16 or more characters, not a placeholder), narrowed so that text around a reference
 * is not mistaken for one: a token prefix is enough, anything else needs letters and
 * digits, and a path, a URL, or a NAME_LIKE_THIS identifier is not one.
 *
 * @param {string} run
 * @returns {boolean}
 */
function looksLikeSecretRun(run) {
  if (run.length < 16 || !/^[A-Za-z0-9_\-+/=.~]+$/.test(run)) return false;
  if (TOKEN_PREFIX.test(run)) return !isPlaceholderValue(run);
  if (/^(?:[~.]?\/|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/|$))/.test(run)) return false; // a path or a URL
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(run) || /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(run)) return false; // a name
  if (isHyphenatedName(run)) return false; // a repository or package name
  if (!/[A-Za-z]/.test(run) || !/\d/.test(run)) return false;
  return !isPlaceholderValue(run);
}

/**
 * Whether anything in `text`, whatever the structure around it (a literal, a list
 * element, a concatenation, a second argument, a value behind an operator), is a run
 * that looks like a secret once quotes, operators and delimiters are taken away.
 */
function remainderHasSecret(text) {
  return text.split(/[\s"'`,;()[\]{}|&?:<>=!$@#%^*\\]+/).some(looksLikeSecretRun);
}

/** The first value of `rest` and what follows it. */
function valueAndTail(rest) {
  const text = rest.trim();
  const quoted = /^(["'`])(.*?)\1/.exec(text);
  if (quoted) return { value: quoted[2], tail: text.slice(quoted[0].length) };
  const value = firstValue(text);
  return { value, tail: text.slice(value.length) };
}

/**
 * Whether the text after `KEY =` carries a literal secret. A value that is a
 * lookup (`os.environ[...]`, `getenv(...)`, `process.env.X`, `${X}`, `${{ secrets.X }}`)
 * is a placeholder only for the lookup itself: a default is a literal
 * (`os.environ.get("X", "<token>")`, `process.env.X ?? '<token>'`, `${X:-<token>}`,
 * `${X} || "<token>"`), so every quoted string inside the reference, a shell default
 * word and the literals after a default operator are read. A reference with more value
 * stuck to it (`${X}"<token>"`) is that value. Any other value is its first token, and
 * the literals after a default operator that follows it. Whatever the first value is, a
 * placeholder included, the rest of the line is read for a run that looks like a secret.
 *
 * Not read: a second assignment on the line whose value is short or has no digit, and a
 * secret built by concatenation.
 *
 * @param {string} rest the text after the `=` or `:`
 * @returns {boolean}
 */
function valueIsSecret(rest) {
  const text = rest.trim();
  const quote = /^["'`]/.exec(text)?.[0] ?? "";
  const ref = afterReference(text.slice(quote.length), quote);
  if (ref === "unclosed" || ref === null) {
    const { value, tail } = valueAndTail(rest);
    if (!isPlaceholderValue(value) || defaultLiterals(tail).some((literal) => !isPlaceholderValue(literal))) return true;
    // The first value is a placeholder, a reference somewhere in the value (`["${X}", "<token>"]`) or
    // not (`changeme <token>`): no structure is trusted, so the whole of the line is read for a run that
    // looks like a secret.
    return remainderHasSecret(text);
  }
  const shellDefault = /^:?[-=+?]([^}]*)\}/.exec(ref.scan);
  if (shellDefault && !isPlaceholderValue(shellDefault[1])) return true;
  for (const literal of ref.scan.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)) {
    if (!isPlaceholderValue(literal[2])) return true;
  }
  if (!endsReference(ref.suffix)) {
    // More value stuck to the reference: judge the glued run, quotes removed.
    const run = ref.suffix.split(/\s/)[0].replace(/["'`]/g, "").replace(/[,;)\]}]+$/, "");
    if (!isPlaceholderValue(run)) return true;
  }
  if (defaultLiterals(ref.suffix).some((literal) => !isPlaceholderValue(literal))) return true;
  // Whatever else follows the reference, in any shape: no structure is trusted.
  return remainderHasSecret(ref.after);
}

/**
 * True when the basename is a real dotenv file (not a committed template).
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isEnvFilePath(filePath) {
  const base = path.basename(filePath);
  if (!/^\.env(\.|$)/.test(base)) return false;
  return !/\.(example|sample|template|dist)$/.test(base);
}

/**
 * Scan `content` for secret-key assignments carrying a real value or for a
 * recognised token/private-key literal. Returns a human-readable reason per
 * match (empty array when clean).
 *
 * @param {string} content
 * @returns {string[]}
 */
export function findSecrets(content) {
  const hits = [];

  for (const key of SECRET_KEYS) {
    // KEY = value, KEY: value or KEY => value (env, yaml, toml, ruby, ...), with
    // the key itself optionally quoted ("KEY": "v", 'KEY' = 'v'), in any case. A
    // key in backticks (prose such as `GITHUB_TOKEN`: the pull request) is text
    // about the key, not an assignment.
    const re = new RegExp(`\\b${key}\\b["']?\\s*(?:=>|[:=])\\s*(.+)`, "gi");
    for (const m of content.matchAll(re)) {
      if (valueIsSecret(m[1]))
        hits.push(`${key} assigned a literal value`);
    }
  }

  for (const re of TOKEN_LITERALS) {
    if (re.test(content))
      hits.push(`recognised token/key literal (${re.source})`);
  }

  return hits;
}

/**
 * Combined verdict for a write. Returns the block reasons (empty when allowed).
 *
 * @param {string} filePath
 * @param {string} content
 * @returns {string[]}
 */
export function isSecretWrite(filePath, content) {
  const reasons = [];
  if (isEnvFilePath(filePath)) {
    reasons.push(`writing a dotenv secret file (${path.basename(filePath)})`);
  }
  reasons.push(...findSecrets(content ?? ""));
  return reasons;
}

// The scanners below find where a substitution (`$(...)`, backticks) or a quoted string ends, with quotes,
// nested substitutions and heredoc bodies inside it. -1 means it never closes.
function backtickEnd(s, from) {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "`") return i;
  }
  return -1;
}

function doubleQuoteEnd(s, from) {
  let i = from;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") i += 2;
    else if (c === '"') return i;
    else if (c === "$" && s[i + 1] === "(") {
      const end = substitutionEnd(s, i + 2);
      if (end === -1) return -1;
      i = end + 1;
    } else if (c === "`") {
      const end = backtickEnd(s, i + 1);
      if (end === -1) return -1;
      i = end + 1;
    } else i++;
  }
  return -1;
}

function substitutionEnd(s, from) {
  let i = from;
  let depth = 1;
  const pending = [];
  while (i < s.length) {
    const c = s[i];
    if (c === "\n") {
      i++;
      while (pending.length > 0) {
        const delimiter = pending.shift();
        while (i < s.length) {
          const end = s.indexOf("\n", i);
          const line = s.slice(i, end === -1 ? s.length : end);
          i = end === -1 ? s.length : end + 1;
          if (line.replace(/^\t+/, "") === delimiter) break;
        }
      }
    } else if (c === "\\") i += 2;
    else if (c === "'") {
      const end = s.indexOf("'", i + 1);
      if (end === -1) return -1;
      i = end + 1;
    } else if (c === '"') {
      const end = doubleQuoteEnd(s, i + 1);
      if (end === -1) return -1;
      i = end + 1;
    } else if (c === "`") {
      const end = backtickEnd(s, i + 1);
      if (end === -1) return -1;
      i = end + 1;
    } else if (c === "$" && s[i + 1] === "(") {
      const end = substitutionEnd(s, i + 2);
      if (end === -1) return -1;
      i = end + 1;
    } else if (c === "<" && s[i + 1] === "<" && s[i + 2] !== "<") {
      const m = /^<<-?[ \t]*(?:'([^']*)'|"([^"]*)"|([^\s;&|()<>]+))/.exec(s.slice(i));
      if (m) {
        pending.push(m[1] ?? m[2] ?? m[3]);
        i += m[0].length;
      } else i++;
    } else {
      if (c === "(") depth++;
      if (c === ")" && --depth === 0) return i;
      i++;
    }
  }
  return -1;
}

/**
 * Read a shell command into tokens: `{ word, dyn }` for a word (quotes and escapes resolved; `dyn` when
 * it holds an expansion the parser cannot resolve: `$`, a backtick, an unquoted `{`) and `{ op }` for an
 * operator. Heredoc bodies are skipped. The text of every substitution is returned in `subs`, to be read
 * as commands too. Returns null for what it cannot model (an unclosed quote or substitution, `$'..'`).
 *
 * @param {string} command
 * @returns {(({ word: string, dyn: boolean } | { op: string })[] & { subs: string[] }) | null}
 */
export function lexShell(command) {
  const toks = [];
  toks.subs = [];
  const pending = [];
  let word = null;
  let dyn = false;
  let wantDelimiter = false;
  const n = command.length;
  const flush = () => {
    if (word === null) return;
    if (wantDelimiter) pending.push(word);
    wantDelimiter = false;
    toks.push({ word, dyn });
    word = null;
    dyn = false;
  };
  const op = (value) => {
    flush();
    toks.push({ op: value });
  };
  // A substitution at `i`: its text goes to `subs`, the word holds a marker, and the index after it is returned (or -1).
  const substitution = (i) => {
    const backtick = command[i] === "`";
    const end = backtick ? backtickEnd(command, i + 1) : substitutionEnd(command, i + 2);
    if (end === -1) return -1;
    toks.subs.push(command.slice(i + (backtick ? 1 : 2), end));
    word = (word ?? "") + "$()";
    dyn = true;
    return end + 1;
  };
  let i = 0;
  while (i < n) {
    const c = command[i];
    if (c === "\n") {
      op("\n");
      i++;
      while (pending.length > 0) {
        const delimiter = pending.shift();
        while (i < n) {
          const end = command.indexOf("\n", i);
          const line = command.slice(i, end === -1 ? n : end);
          i = end === -1 ? n : end + 1;
          if (line.replace(/^\t+/, "") === delimiter) break;
        }
      }
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      flush();
      i++;
      continue;
    }
    if (c === "#" && word === null) {
      while (i < n && command[i] !== "\n") i++;
      continue;
    }
    if (c === "'") {
      const end = command.indexOf("'", i + 1);
      if (end === -1) return null;
      word = (word ?? "") + command.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c === '"') {
      word ??= "";
      i++;
      for (;;) {
        if (i >= n) return null;
        const d = command[i];
        if (d === '"') break;
        if (d === "\\" && i + 1 < n && '"\\$`\n'.includes(command[i + 1])) {
          if (command[i + 1] !== "\n") word += command[i + 1];
          i += 2;
        } else if ((d === "$" && command[i + 1] === "(") || d === "`") {
          i = substitution(i);
          if (i === -1) return null;
        } else {
          if (d === "$") dyn = true;
          word += d;
          i++;
        }
      }
      i++;
      continue;
    }
    if (c === "\\") {
      if (i + 1 < n && command[i + 1] !== "\n") word = (word ?? "") + command[i + 1];
      i += 2;
      continue;
    }
    if (c === "$" && command[i + 1] === "'") return null;
    if ((c === "$" && command[i + 1] === "(") || c === "`") {
      i = substitution(i);
      if (i === -1) return null;
      continue;
    }
    if (c === "$") {
      dyn = true;
      word = (word ?? "") + c;
      i++;
      continue;
    }
    const rest = command.slice(i);
    const operator = /^(?:&>>|&>|&&|&|\|\||\|&|\||;|\(|\)|>>|>\||>&|>|<<<|<<-|<<|<&|<)/.exec(rest)?.[0];
    if (operator !== undefined) {
      // `2>file`: the digits are a file descriptor, not an argument.
      if (operator.startsWith(">") || operator.startsWith("<")) {
        if (word !== null && /^\d+$/.test(word)) word = null;
      }
      op(operator);
      if (operator === "<<" || operator === "<<-") wantDelimiter = true;
      i += operator.length;
      continue;
    }
    if (c === "{") dyn = true;
    word = (word ?? "") + c;
    i++;
  }
  flush();
  return toks;
}

const REDIRECT_OUT = new Set([">", ">>", ">|", "&>", "&>>", ">&"]);
const WORD_WRITERS = new Set(["cp", "mv", "install", "ln", "touch", "truncate"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash", "fish"]);
// What a wrapper takes before the command it runs: flags that carry a value, and leading positionals.
const PREFIXES = {
  env: { value: ["-u", "-C", "-S", "--unset", "--chdir"], unresolved: ["-S", "--split-string"] },
  command: { value: [] },
  builtin: { value: [] },
  exec: { value: ["-a"] },
  nohup: { value: [] },
  setsid: { value: [] },
  time: { value: ["-f", "-o"] },
  sudo: { value: ["-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-r", "-t", "-U"] },
  doas: { value: ["-u", "-C"] },
  timeout: { value: ["-s", "-k", "--signal", "--kill-after"], positional: 1 },
  nice: { value: ["-n", "--adjustment"] },
  ionice: { value: ["-c", "-n", "-p", "-t"] },
  stdbuf: { value: ["-i", "-o", "-e"] },
  xargs: { value: ["-I", "-n", "-P", "-d", "-L", "-s", "-E", "-a", "-l"] },
};
// Only the name of the file matters: `$TMPDIR/out.log` is a known name in an unknown directory.
const KNOWN_DIRECTORY = /^(?:\$\w+|\$\{\w+\})\/[^$`{}*?[\\\s]+$/;
const envLike = (word) => {
  const base = path.basename(word);
  return base.startsWith(".env") && !/\.(example|sample|template|dist)$/.test(base);
};

/** Index of the command a run of words executes, after assignments and wrappers (and their options), or -1. */
function headIndex(words, out) {
  let k = 0;
  for (;;) {
    if (k >= words.length) return -1;
    const w = words[k].word;
    if (/^[A-Za-z_]\w*=/.test(w)) {
      k++;
      continue;
    }
    const spec = PREFIXES[path.basename(w)];
    if (!spec || words[k].dyn) return k;
    k++;
    while (k < words.length && words[k].word.startsWith("-") && words[k].word.length > 1) {
      const flag = words[k].word;
      k++;
      if (flag === "--") break;
      if (spec.unresolved?.some((u) => flag === u || flag.startsWith(`${u}=`))) out.unresolved.push(`${path.basename(w)} ${flag}`);
      if (spec.value.includes(flag) && k < words.length) k++;
    }
    k += spec.positional ?? 0;
  }
}

function analyze(command, out, depth) {
  if (depth > 4) {
    out.unresolved.push("a command nested too deeply");
    return;
  }
  const toks = lexShell(command);
  if (toks === null) {
    out.unresolved.push("a command the parser cannot model");
    return;
  }
  for (const sub of toks.subs) analyze(sub, out, depth + 1);
  const add = (tok, text) => {
    const raw = tok.word;
    const base = path.basename(raw);
    if (/[*?[]/.test(base) && base.startsWith(".") && ".env".startsWith(base.split(/[*?[]/)[0])) {
      out.unresolved.push(raw);
      return;
    }
    if (tok.dyn && !KNOWN_DIRECTORY.test(raw)) {
      out.unresolved.push(raw);
      return;
    }
    out.targets.push(raw);
    if (text) out.writes = out.writes || (raw !== "/dev/null" && !/^&?\d+$|^-$/.test(raw));
  };
  let words = [];
  const finish = () => {
    const segment = words;
    words = [];
    const k = headIndex(segment, out);
    const head = segment[k];
    // The head cannot be identified: fall back to reading every word for a dotenv file.
    if (head === undefined || head.dyn) {
      if (segment.some((w) => envLike(w.word))) out.unresolved.push(segment.map((w) => w.word).join(" "));
      return;
    }
    const args = segment.slice(k + 1);
    const name = path.basename(head.word);
    const plain = args.filter((a) => !a.word.startsWith("-"));
    if (SHELLS.has(name)) {
      const c = args.findIndex((a) => /^-[A-Za-z]*c/.test(a.word) && !a.word.startsWith("--"));
      if (c !== -1 && args[c + 1]) {
        if (args[c + 1].dyn) out.unresolved.push(`${name} -c with a dynamic string`);
        else analyze(args[c + 1].word, out, depth + 1);
      }
    } else if (name === "eval") {
      if (args.some((a) => a.dyn)) out.unresolved.push("eval with a dynamic string");
      else analyze(args.map((a) => a.word).join(" "), out, depth + 1);
    } else if (name === "source" || name === ".") out.unresolved.push(`${name} runs a script the parser cannot read`);
    else if (name === "tee") for (const a of plain) add(a, true);
    else if (name === "dd") {
      for (const a of args) if (a.word.startsWith("of=")) add({ word: a.word.slice(3), dyn: a.dyn }, true);
    } else if (name === "sed") {
      if (args.some((a) => /^-[A-Za-z]*i|^--in-place/.test(a.word))) for (const a of plain.slice(1)) add(a, true);
    } else if (WORD_WRITERS.has(name)) for (const a of plain) add(a, false);
  };
  for (let t = 0; t < toks.length; t++) {
    const tok = toks[t];
    if ("word" in tok) {
      words.push(tok);
      continue;
    }
    if (REDIRECT_OUT.has(tok.op)) {
      const target = toks[t + 1];
      if (target && "word" in target) {
        t++;
        if (!(tok.op === ">&" && /^(\d+|-)$/.test(target.word))) add(target, true);
      }
      continue;
    }
    if (tok.op.startsWith("<")) {
      if (toks[t + 1] && "word" in toks[t + 1]) t++;
      continue;
    }
    finish();
  }
  finish();
}

/**
 * The files a Bash command writes, read with a shell-word tokenizer: redirects, `tee`, `dd of=`,
 * `sed -i`, and the targets of `cp`, `mv`, `install`, `ln`, `touch` and `truncate`, also inside
 * substitutions, `sh -c` strings and `eval`. `writes` is true when text is written to a file (a literal
 * secret in the command is then a leak). `unresolved` lists what the parser cannot resolve (a target
 * built by an expansion, a command it cannot model, `source`): the caller refuses those.
 *
 * @param {string} command
 * @returns {{ targets: string[], writes: boolean, unresolved: string[] }}
 */
export function bashWriteTargets(command) {
  const out = { targets: [], writes: false, unresolved: [] };
  analyze(command, out, 0);
  return out;
}

/**
 * Block reasons for a Bash command (empty when allowed).
 *
 * @param {string} command
 * @returns {string[]}
 */
export function isSecretBash(command) {
  const { targets, writes, unresolved } = bashWriteTargets(command);
  const reasons = targets.filter(isEnvFilePath).map((t) => `writing a dotenv secret file (${path.basename(t)})`);
  for (const t of unresolved) reasons.push(`a write target the parser cannot resolve (${t})`);
  if (writes) reasons.push(...findSecrets(command));
  return reasons;
}

// Kept as a duplicated, self-contained block in every hook file rather than
// imported from a shared helper -- each hook stays a single independent
// file, which keeps this project's hook count easy to reason about against
// CLAUDE.md's hook budget. `import.meta.url` is symlink-resolved but
// `process.argv[1]` is not, so comparing them directly would be false under
// a symlinked invocation path -- and the guard below would then never run,
// i.e. silently fail open (exit 0) instead of blocking.
function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

// Main execution -- only run when invoked directly, not when imported for testing.
if (isEntryPoint()) {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    input = null;
  }
  // A payload that cannot be read cannot be judged, so fail closed. The hook is
  // registered with onFailure: "block", which covers a crash but not a
  // deliberate exit 0, and exit 0 means allow.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    process.stderr.write("[guard-secret-writes] could not read the hook payload; blocking.\n");
    process.exit(2);
  }

  // A notebook edit names its file `notebook_path` and carries `new_source`.
  const ti = input.tool_input ?? {};
  if (typeof ti.command === "string" && ti.file_path === undefined && ti.notebook_path === undefined) {
    const bashReasons = isSecretBash(ti.command);
    if (bashReasons.length === 0) process.exit(0);
    process.stderr.write(`\
[guard-secret-writes] Blocked Bash command that writes a secret:
${bashReasons.map((r) => `  - ${r}`).join("\n")}

Secrets and tokens must never be written to the working tree. Use an env var
reference, and keep real dotenv files out of the repo (author .env.example).
`);
    process.exit(2);
  }
  const filePath = ti.file_path ?? ti.notebook_path ?? "";
  if (typeof filePath !== "string" || filePath.length === 0) process.exit(0);

  // Content by field presence (Write -> content, Edit -> new_string, NotebookEdit
  // -> new_source), matching the sibling-hook convention so the guard stays live
  // if tool_name is absent.
  const content =
    typeof ti.content === "string"
      ? ti.content
      : typeof ti.new_string === "string"
        ? ti.new_string
        : typeof ti.new_source === "string"
          ? ti.new_source
          : "";

  const reasons = isSecretWrite(filePath, content);
  if (reasons.length === 0) process.exit(0);

  process.stderr.write(`\
[guard-secret-writes] Blocked write to ${filePath}:
${reasons.map((r) => `  - ${r}`).join("\n")}

Secrets and tokens must never be written to the working tree -- they persist in
git objects/reflog even after removal. Use a CI secret or an env var reference
instead of a literal value, and keep real dotenv files out of the repo (.env*
is gitignored; author .env.example with placeholders).
`);
  process.exit(2);
}
