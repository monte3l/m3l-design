// Two Bash guards, each run as the harness runs it (hook JSON on stdin):
//  - guard-readonly-agent-bash.mjs keeps a reviewer that calls itself read-only to read commands.
//    It judges only the agents it names (`agent_type`), and asks, never blocks, for the rest;
//  - guard-secret-writes.mjs, for a Bash command, blocks a write to a dotenv file or a secret literal
//    written by redirect or tee, as it does for Write and Edit.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "CLAUDE_PROJECT_DIR"));
const run = (name, payload) => {
  const r = spawnSync("node", [path.join(root, ".claude/hooks", name)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env,
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
};

const AGENT = "code-reviewer";
const reviewer = (command, agent_type = AGENT) => run("guard-readonly-agent-bash.mjs", { tool_name: "Bash", cwd: root, agent_type, tool_input: { command } });
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
    "git log --oneline -5",
    "git show HEAD:blueprint/README.md",
    "git status --short",
    "git ls-files workflow-templates",
    "git rev-parse --show-toplevel",
    "gh api repos/monte3l/.github/rulesets",
    "gh api -X GET repos/monte3l/.github",
    "gh api --method=get repos/monte3l/.github --jq .name",
    "gh pr view 12 --json title",
    "gh pr list",
    "gh run view 123 --log-failed",
    "gh issue list --label bug",
    "ls -la blueprint",
    "cat blueprint/sync.json",
    "grep -rn 'persist-credentials' workflow-templates",
    'grep -E "a|b" file.txt',
    "rg --files design",
    "jq . blueprint/pins.json",
    "git ls-files | grep yml | wc -l",
    'node --test "tests/*.test.mjs"',
    "node design/source/docs-kit/build.mjs --check",
    "shellcheck bin/apply-repo-baseline.sh",
    "actionlint .github/workflows/verify.yml",
    "bash -n bin/new-repo.sh",
    "find workflow-templates -name '*.yml'",
    "cat .env.example",
    "node --test tests/a.test.mjs tests/b.test.mjs",
    "node --test",
    "rg -n TOKEN workflow-templates",
    "grep -rn -e TOKEN workflow-templates",
  ];
  const asked = [
    "git commit -s -m x",
    "git push",
    "git checkout main",
    "git -C /tmp log",
    "git diff --output=out.txt",
    "gh api -X POST repos/monte3l/.github/issues",
    "gh api repos/monte3l/.github/issues -f title=x",
    "gh api repos/monte3l/.github --method DELETE",
    "gh api -XPATCH repos/monte3l/.github",
    "gh api graphql -f query=x",
    "gh pr merge 3",
    "gh issue create",
    "gh workflow run x.yml",
    "rm -rf x",
    "curl https://example.com",
    "sed -i '' s/a/b/ f",
    "git log; rm x",
    "git log && rm x",
    "git log || rm x",
    "git log & rm x",
    "git log\nrm x",
    "git log > out.txt",
    "cat f >> out.txt",
    "cat < f",
    "echo $(rm x)",
    "cat `rm x`",
    "cat $HOME/x",
    "(git log)",
    "bash -c 'git log'",
    "bash script.sh",
    "node bin/org-audit.mjs",
    "find . -delete",
    "find . -exec rm {} +",
    "rg --pre ./x foo",
    "sort -o out.txt in.txt",
    "cat .env",
    "grep TOKEN .env.local",
    "FOO=1 git log",
    "git log | tee out.txt",
    "ls \\; x",
    "node --test --import ./x.mjs tests/a.test.mjs",
    "node --test -r ./x.js",
    "node --test --env-file=.env.x tests/a.test.mjs",
    "node --test other/a.mjs",
    "node -e 1",
    "sort --compress-program=./x f",
    "sort -T /tmp f",
    "actionlint -shellcheck=./x f.yml",
    "actionlint -pyflakes=./x f.yml",
    "ls -Z",
    "cat .e*",
    "cat .en?",
    "cat [.]env",
    "cat ~/.env",
    "cat --file=.env",
    "grep -rn TOKEN .",
    "grep -rn TOKEN",
    "grep -rn TOKEN ..",
    "rg TOKEN",
    "rg TOKEN /",
    "git show HEAD:.env",
    "git ls-files *.yml",
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
    assert.equal(verdict(reviewer("rm x", "some-other-agent")), "allow");
    assert.equal(verdict(run("guard-readonly-agent-bash.mjs", { tool_name: "Bash", tool_input: { command: "rm x" } })), "allow");
  });
  it("fails closed on a payload it cannot read", () => {
    assert.equal(run("guard-readonly-agent-bash.mjs", "not json").status, 2);
  });
  it("asks when the named agent sends no command", () => {
    assert.equal(verdict(run("guard-readonly-agent-bash.mjs", { agent_type: AGENT, tool_input: {} })), "ask");
  });
});

describe("guard-secret-writes: Bash", () => {
  // Built at run time so this file holds no token literal itself.
  const token = `ghp_${"a1B2".repeat(9)}`;
  const pem = `-----BEGIN ${"PRIVATE"} KEY-----`;
  const bash = (command) => run("guard-secret-writes.mjs", { tool_name: "Bash", tool_input: { command } }).status;
  const blocked = [
    "echo X=1 > .env",
    "echo X=1 >> .env.local",
    "echo X=1 >.env",
    'echo X=1 > "config/.env.production"',
    "echo hi | tee .env",
    "echo hi | tee -a .env.local",
    "printf x &> .env",
    "echo hi >| .env",
    "echo x > .en\"\"v",
    "echo x > .e\\nv",
    "echo x > \"$F\"",
    "echo x > $(echo .env)",
    "echo x > $'.env'",
    "echo x > .e*",
    "echo x > '.env'",
    "cp a .env",
    "mv a .env.local",
    "install -m 600 a .env",
    "ln -s a .env",
    "dd if=a of=.env",
    "dd if=a of=\"$X\"",
    "sed -i s/a/b/ .env",
    "sed -i '' s/a/b/ .env.local",
    "FOO=1 tee .env <<< x",
    "touch .env",
    `sed -i 's/x/${token}/' notes.txt`,
    `dd if=in of=out.txt <<< ${token}`,
    `echo GH_TOKEN=${token} > notes.txt`,
    `echo ${token} | tee out.txt`,
    `cat > f.txt <<'EOF'\nNPM_TOKEN=${token}\nEOF`,
    `cat > f.txt <<'EOF'\n${pem}\nEOF`,
  ];
  const allowed = [
    "echo X=1 > .env.example",
    "echo x > $TMPDIR/out.log",
    "cp a b.txt",
    "sed -i s/a/b/ notes.txt",
    "sed s/a/b/ .envrc.txt",
    "cat <<EOF\nhello\nEOF",
    "echo '> .env'",
    "echo hi | tee notes.txt",
    "git log --oneline",
    "cat .env.example",
    "ls 2>/dev/null",
    "gh api repos/x/y 2>&1",
    `echo 'GH_TOKEN=\${GH_TOKEN}' > out.txt`,
    `echo ${token}`,
    `GH_TOKEN=${token} gh api user 2>/dev/null`,
    "pnpm verify > /tmp/out.log",
  ];
  for (const command of blocked) {
    it(`blocks ${JSON.stringify(command).slice(0, 60)}`, () => assert.equal(bash(command), 2));
  }
  for (const command of allowed) {
    it(`allows ${JSON.stringify(command).slice(0, 60)}`, () => assert.equal(bash(command), 0));
  }
  it("keeps the Write and Edit rules", () => {
    const write = (file_path, content) => run("guard-secret-writes.mjs", { tool_name: "Write", tool_input: { file_path, content } }).status;
    assert.equal(write("/x/.env", "A=1"), 2);
    assert.equal(write("/x/a.txt", "hello"), 0);
  });
});
