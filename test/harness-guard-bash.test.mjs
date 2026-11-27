// Two Bash guards, each run as the harness runs it (hook JSON on stdin). Both are best effort and decide by
// text, so the tables below are the contract: what passes silently, what asks, and what is blocked.
//  - guard-readonly-agent-bash.mjs passes silently only a short list of single plain commands for the agents it
//    names (`agent_type`), and asks, never blocks, for everything else;
//  - guard-secret-writes.mjs, for a Bash command, blocks a dotenv file named in a write, a command it cannot
//    read that could write, and a secret literal in a write, as it does for Write and Edit.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "CLAUDE_PROJECT_DIR"));
const run = (name, payload) => {
  const r = spawnSync("node", [path.join(root, ".claude/hooks", name)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env,
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
};

const AGENT = "code-reviewer";
const reviewer = (command, cwd = root, agent_type = AGENT) => run("guard-readonly-agent-bash.mjs", { tool_name: "Bash", cwd, agent_type, tool_input: { command } });
const verdict = (r) => {
  assert.equal(r.status, 0, r.err);
  if (r.out === "") return "allow";
  const decision = JSON.parse(r.out).hookSpecificOutput;
  assert.equal(decision.hookEventName, "PreToolUse");
  return decision.permissionDecision;
};

describe("guard-readonly-agent-bash: a read-only reviewer", () => {
  const allowed = [
    "git diff main...HEAD --name-only",
    "git diff --stat HEAD",
    "git log --oneline -5",
    "git log --oneline -n 5",
    "git log --max-count=3 --name-only",
    "git show HEAD:source/tokens.json",
    "git status --short",
    "git ls-files artifact",
    "git rev-parse --show-toplevel",
    "git branch --list",
    "ls artifact",
    "ls -l source",
    "cat source/tokens.json",
    "cat -n CLAUDE.md",
    "head -n 5 CLAUDE.md",
    "head -5 CLAUDE.md",
    "tail -n 5 CLAUDE.md",
    "wc -l CLAUDE.md",
    "grep -n persist-credentials .github/workflows/verify.yml",
    "grep -n 'a b' CLAUDE.md",
    "rg -n TOKEN .github/workflows/verify.yml",
    "rg -n -i TOKEN .github/workflows/verify.yml source/tokens.json",
    "rg --files CLAUDE.md",
    "gh pr view 12 --json=title",
    "gh pr list",
    "gh issue list --label=bug --limit=5",
    "gh run view 123 --log-failed",
    "gh repo view monte3l/.github",
    "node --test test/harness-guard-bash.test.mjs",
  ];
  const asked = [
    // not on the list
    "git commit -s -m x",
    "git push",
    "git checkout main",
    "git -C /tmp log",
    "git branch newbranch",
    "git branch -D x",
    "jq . tools/lint/package.json",
    "find artifact -name x",
    "sort source/tokens.json",
    "uniq source/tokens.json",
    "diff source/tokens.json tools/lint/package.json",
    "cmp source/tokens.json tools/lint/package.json",
    "egrep -n x source/tokens.json",
    "fgrep -n x source/tokens.json",
    "shellcheck bin/new-repo.sh",
    "actionlint .github/workflows/verify.yml",
    "stat CLAUDE.md",
    "file CLAUDE.md",
    "basename x",
    "rm -rf x",
    "curl https://example.com",
    "sed -i '' s/a/b/ f",
    "gh pr merge 3",
    "gh issue create",
    "gh workflow run x.yml",
    "gh pr view 3 --web",
    "gh pr view 3 -w",
    "gh pr view 3 4",
    "gh api repos/monte3l/.github",
    "gh api repos/monte3l/.github --jq .name",
    "gh api --template x repos/monte3l/.github",
    "gh api -X POST repos/monte3l/.github/issues",
    "gh api -XGET repos/monte3l/.github",
    "bash -n bin/new-repo.sh",
    "bash -c 'git log'",
    "bash script.sh",
    "node bin/org-audit.mjs",
    "node --test",
    "node --test tests/*.test.mjs",
    "node --test --import ./x.mjs test/harness-guard-bash.test.mjs",
    "node --test -r ./x.js test/harness-guard-bash.test.mjs",
    "node -e 1",
    "node design/source/docs-kit/build.mjs --check",
    // not one simple command
    "git log; rm x",
    "git log && rm x",
    "git log || rm x",
    "git log & rm x",
    "git log\nrm x",
    "git log | cat",
    "git log > out.txt",
    "cat source/tokens.json >> out.txt",
    "cat < source/tokens.json",
    "echo $(rm x)",
    "cat `rm x`",
    "cat $HOME/x",
    "(git log)",
    "FOO=1 git log",
    "ls \\; x",
    "cat source/*.json",
    "cat source/s?nc.json",
    "cat ~/x",
    "ls {source,design}",
    "ls [b]lueprint",
    "git diff HEAD~1",
    "cat 'unclosed",
    // flags not on the list, and bundled options
    "git diff --output=out.txt",
    "git diff --ext-diff",
    "git diff --no-index a b",
    "git show --textconv HEAD:source/tokens.json",
    "git log -S x",
    "git log --git-dir=x",
    "git log --work-tree=x",
    "git log --contents",
    "git log -O x",
    "git log --ignore-revs-file=x",
    "git diff --",
    "ls -la source",
    "grep -rn TOKEN artifact",
    "grep -r -n persist-credentials artifact",
    "grep -R TOKEN artifact",
    "grep --recursive TOKEN artifact",
    "grep -r --include=yml TOKEN artifact",
    "grep --include=yml TOKEN .github/workflows/verify.yml",
    "grep -e TOKEN artifact",
    "grep -f x artifact",
    "rg -ni TOKEN .github/workflows/verify.yml",
    "rg -n TOKEN artifact",
    "rg --files design",
    "rg --glob=yml TOKEN CLAUDE.md",
    "rg -g yml TOKEN CLAUDE.md",
    "grep -n TOKEN artifact",
    "grep -n x source",
    "rg --hidden TOKEN artifact",
    "rg -uu TOKEN artifact",
    "rg --no-ignore TOKEN artifact",
    "rg --pre ./x TOKEN artifact",
    "head -n x CLAUDE.md",
    "cat -A CLAUDE.md",
    // paths
    "ls",
    "cat",
    "ls .",
    "ls ..",
    "ls /",
    "cat /etc/passwd",
    "cat ../x",
    "cat nonexistent-file",
    "grep -n TOKEN",
    "grep -r TOKEN .",
    "grep -r TOKEN ..",
    "grep -r TOKEN /etc",
    "grep -n TOKEN /etc/passwd",
    "rg TOKEN",
    "rg --files",
    "rg TOKEN /",
    "git show HEAD:../x",
    "git ls-files ..",
    // dotenv, in any case
    "cat .env",
    "cat .ENV",
    "cat .Env.Local",
    "cat --file=.env",
    "grep TOKEN .env",
    "git show HEAD:.env",
    "git show HEAD:.ENV",
    "git diff -- .env",
  ];
  for (const command of allowed) {
    it(`allows ${JSON.stringify(command)}`, () => assert.equal(verdict(reviewer(command)), "allow"));
  }
  for (const command of asked) {
    it(`asks for ${JSON.stringify(command)}`, () => assert.equal(verdict(reviewer(command)), "ask"));
  }

  it("never blocks: an ask carries a reason naming the agent", () => {
    const r = reviewer("rm x");
    assert.equal(r.status, 0);
    assert.match(JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason, new RegExp(AGENT));
  });
  it("leaves every other agent and the main session alone", () => {
    assert.equal(verdict(reviewer("rm x", root, "some-other-agent")), "allow");
    assert.equal(verdict(run("guard-readonly-agent-bash.mjs", { tool_name: "Bash", tool_input: { command: "rm x" } })), "allow");
  });
  it("fails closed on a payload it cannot read", () => {
    assert.equal(run("guard-readonly-agent-bash.mjs", "not json").status, 2);
  });
  it("asks when the named agent sends no command", () => {
    assert.equal(verdict(run("guard-readonly-agent-bash.mjs", { agent_type: AGENT, tool_input: {} })), "ask");
  });

  describe("paths are resolved with realpath against the git toplevel of the working directory", () => {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ro-guard-")));
    const sh = (cwd, ...args) => assert.equal(spawnSync("git", args, { cwd, env, encoding: "utf8" }).status, 0);
    sh(tmp, "init", "-q");
    fs.mkdirSync(path.join(tmp, "sub"));
    fs.mkdirSync(path.join(tmp, "Secrets"));
    fs.writeFileSync(path.join(tmp, "ok.txt"), "x\n");
    fs.writeFileSync(path.join(tmp, "sub", "ok.txt"), "x\n");
    fs.writeFileSync(path.join(tmp, "Secrets", "key.txt"), "x\n");
    fs.writeFileSync(path.join(tmp, ".ENV"), "x\n");
    fs.symlinkSync("/etc/hosts", path.join(tmp, "link-out"));
    fs.symlinkSync(path.join(tmp, ".ENV"), path.join(tmp, "link-env"));
    fs.symlinkSync("ok.txt", path.join(tmp, "link-in"));
    const at = (command, cwd = tmp) => verdict(reviewer(command, cwd));

    it("allows a file in the repository, from the root or a subdirectory", () => {
      assert.equal(at("cat ok.txt"), "allow");
      assert.equal(at("cat sub/ok.txt"), "allow");
      assert.equal(at("cat ok.txt", path.join(tmp, "sub")), "allow");
      assert.equal(at("cat ../ok.txt", path.join(tmp, "sub")), "allow");
      assert.equal(at("cat link-in"), "allow");
    });
    it("asks for a symlink that leaves the repository or points at a dotenv file", () => {
      assert.equal(at("cat link-out"), "ask");
      assert.equal(at("cat link-env"), "ask");
    });
    it("asks for a secrets directory in any case, a dotenv file in any case, the root and a missing file", () => {
      assert.equal(at("cat Secrets/key.txt"), "ask");
      assert.equal(at("ls Secrets"), "ask");
      assert.equal(at("cat .ENV"), "ask");
      assert.equal(at("ls ."), "ask");
      assert.equal(at("cat missing.txt"), "ask");
    });
    it("lets rg and grep search regular files only, never a directory", () => {
      fs.mkdirSync(path.join(tmp, "clean"));
      fs.writeFileSync(path.join(tmp, "clean", "a.txt"), "x\n");
      fs.mkdirSync(path.join(tmp, "dirty-env"));
      fs.writeFileSync(path.join(tmp, "dirty-env", ".ENV"), "x\n");
      fs.mkdirSync(path.join(tmp, "dirty-secrets", "Secrets"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "dirty-env", "b.txt"), "x\n");
      assert.equal(at("rg x ok.txt"), "allow");
      assert.equal(at("rg x clean"), "ask");
      assert.equal(at("rg x clean/a.txt ok.txt"), "allow");
      assert.equal(at("rg x dirty-env"), "ask");
      assert.equal(at("rg x dirty-secrets"), "ask");
      assert.equal(at("rg x clean dirty-env"), "ask");
      assert.equal(at("rg --files dirty-env"), "ask");
      assert.equal(at("rg x missing"), "ask");
      assert.equal(at("grep x dirty-env/b.txt"), "allow");
    });
    it("asks when the working directory is not in a git repository", () => {
      const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ro-guard-nogit-")));
      fs.writeFileSync(path.join(outside, "a.txt"), "x\n");
      assert.equal(at("cat a.txt", outside), "ask");
    });
  });
});

describe("guard-secret-writes: Bash (best effort, blocks when in doubt)", () => {
  // Built at run time so this file holds no token literal itself.
  const token = `ghp_${"a1B2".repeat(9)}`;
  const pem = `-----BEGIN ${"PRIVATE"} KEY-----`;
  const bash = (command) => run("guard-secret-writes.mjs", { tool_name: "Bash", tool_input: { command } }).status;
  const blocked = [
    // a dotenv file named in a write, in any case
    "echo X=1 > .env",
    "echo X=1 >> .env.local",
    "echo X=1 >.env",
    'echo X=1 > "config/.env.production"',
    "echo x > '.env'",
    "echo x > .ENV",
    "echo hi | tee .env",
    "echo hi | tee -a .env.local",
    "printf x &> .env",
    "echo hi >| .env",
    "cp a .env",
    "mv a .Env.local",
    "install -m 600 a .env",
    "ln -s a .env",
    "dd if=a of=.env",
    "sed -i s/a/b/ .env",
    "sed -i '' s/a/b/ .env.local",
    "touch .env",
    "truncate -s 0 .env",
    "FOO=1 tee .env <<< x",
    "env FOO=1 cp a .env",
    "env -i cp a .env",
    "sudo -u root tee .env",
    "timeout 5 cp a .env",
    "xargs -I {} cp {} .env",
    'echo x > .en""v',
    "echo x > .e\\nv",
    // a dotenv file named in a command with a substitution or a heredoc
    'echo "$(echo x > .env)"',
    "echo `echo x > .env`",
    "echo x > $(echo .env)",
    "cat $(echo .env)",
    "git commit -s -m \"$(cat <<'EOF'\nmention .env here\nEOF\n)\"",
    "$CMD a .env",
    // a command the guard cannot read, that could write
    'echo x > "unclosed',
    "echo x > $'.env'",
    "echo x > $'a'",
    "bash -c 'echo x > .env'",
    'sh -c "cp a .env"',
    'eval "echo x > .env"',
    'eval "$X > out.txt"',
    "source ./x.sh > out.txt",
    // run text the guard does not read: blocked whatever else is visible
    "bash -c 'echo hi'",
    'sh -c "echo hi"',
    "zsh -c ls",
    "dash -c ls",
    "ksh -c ls",
    "ash -c ls",
    "fish -c ls",
    "bash -ec 'echo hi'",
    'eval "echo hi"',
    "eval $X",
    "source ./x.sh",
    ". ./x.sh",
    "env -S 'echo hi'",
    "env --split-string='echo hi'",
    "echo 'unclosed; bash -c 'echo hi'",
    // a heredoc marker anywhere, with a write or a dotenv word, even inside a quoted string
    "cat <<EOF > out.txt\nx\nEOF",
    'echo "<<EOF"; cp a b',
    "echo '<<X'; cat > out.txt",
    "cat <<EOF\n.env\nEOF",
    "bash script.sh > out.txt",
    "env -S 'cp a .env'",
    "cp a b.txt\\",
    // a target built by an expansion or a glob
    'echo x > "$F"',
    "echo x > $F",
    `echo x > \${F}.txt`,
    "echo x > {a,b}",
    "echo x > {.env,b}",
    "echo x > .env{,}",
    "echo x > .e*",
    'dd if=a of="$X"',
    "cp a $X",
    // a secret literal in a write
    `echo GH_TOKEN=${token} > notes.txt`,
    `echo ${token} | tee out.txt`,
    `cat > f.txt <<'EOF'\nNPM_TOKEN=${token}\nEOF`,
    `cat > f.txt <<'EOF'\n${pem}\nEOF`,
    `sed -i 's/x/${token}/' notes.txt`,
    `dd if=in of=out.txt <<< ${token}`,
  ];
  const allowed = [
    "echo X=1 > .env.example",
    "echo X=1 > .ENV.SAMPLE",
    "echo hi | tee notes.txt",
    "git log --oneline",
    "cat .env.example",
    "cat .env",
    "grep x .env",
    "ls 2>/dev/null",
    "gh api repos/x/y 2>&1",
    `echo 'GH_TOKEN=\${GH_TOKEN}' > out.txt`,
    `echo ${token}`,
    `GH_TOKEN=${token} gh api user 2>/dev/null`,
    "pnpm verify > /tmp/out.log",
    "echo x > $TMPDIR/out.log",
    'echo x > "$TMPDIR/out.log"',
    "cp a b.txt",
    "mv a b.txt",
    "sed -i s/a/b/ notes.txt",
    "sed s/a/b/ .envrc.txt",
    "bash script.sh",
    "cat <<EOF\nhello\nEOF",
    "echo $(date)",
    "git commit -s -m \"$(cat <<'EOF'\nit's fine\nEOF\n)\"",
  ];
  for (const command of blocked) {
    it(`blocks ${JSON.stringify(command).slice(0, 70)}`, () => assert.equal(bash(command), 2));
  }
  for (const command of allowed) {
    it(`allows ${JSON.stringify(command).slice(0, 70)}`, () => assert.equal(bash(command), 0));
  }
  it("keeps the Write and Edit rules", () => {
    const write = (file_path, content) => run("guard-secret-writes.mjs", { tool_name: "Write", tool_input: { file_path, content } }).status;
    assert.equal(write("/x/.env", "A=1"), 2);
    assert.equal(write("/x/a.txt", "hello"), 0);
    assert.equal(write("/x/a.txt", `GH_TOKEN=${token}`), 2);
  });
});
