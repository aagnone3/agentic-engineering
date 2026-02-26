---
title: "Agentic Engineering Plugin: Addressing Integration Testing Gaps"
type: proposal
date: 2026-02-25
---

# Agentic Engineering Plugin: Addressing Integration Testing Gaps

## Problem Statement

During the MCP tool selection feature (`feat/mcp-tool-selection-filtering`), the agentic-engineering pipeline executed the full review -> resolve -> verify cycle:

- `/workflows:review` launched **10 review agents** in parallel (configured via `agentic-engineering.local.md`)
- **25 findings** were created as todo files via the `file-todos` skill and categorized (P1/P2/P3)
- `/resolve_todo_parallel` spawned **7 parallel `pr-comment-resolver` agents** to implement fixes
- All unit tests passed, TypeScript compiled, biome lint clean

Despite this, the feature **did not work**. Tool discovery failed at runtime because:

1. `Client(url, headers=...)` -- the `fastmcp.Client` constructor doesn't accept a `headers` kwarg
2. SSE servers received HTTP transport connections -- no transport-type dispatch existed
3. No test ever constructed a real `Client` or connected to a real MCP server

The root cause isn't a single agent failure -- it's a **systemic gap across the entire pipeline**. Every stage assumed someone else would catch integration-boundary bugs, and none did.

## Failure Analysis

### What Each Pipeline Stage Missed

| Pipeline Stage | Command/Agent | What It Did | What It Missed |
|---|---|---|---|
| Plan | `/workflows:plan` | Described the feature, referenced files, ran `repo-research-analyst` + `learnings-researcher` | No guidance on testing strategy or integration boundaries (even though v2.35.1 added System-Wide Impact templates, they didn't prompt for testing library APIs) |
| Implement | `/workflows:work` | Implemented code, ran unit tests, executed System-Wide Test Check | The System-Wide Test Check (v2.35.1) asks about callbacks/middleware but **not** about external library API compatibility. Never verified the `discover_tools` endpoint actually worked. |
| Review | `/workflows:review` (10 agents from `agentic-engineering.local.md`) | Found 25 code quality/security issues, created todo files via `file-todos` skill | No agent in the configured review set flagged that the most critical code path was untested. `security-sentinel`, `performance-oracle`, `architecture-strategist` each check their own domain but none check integration boundaries. |
| Resolve | `/resolve_todo_parallel` (7 `pr-comment-resolver` agents) | Fixed all 25 findings, tests passed | `pr-comment-resolver` (at `agents/workflow/pr-comment-resolver.md`) called `Client(url, headers=...)` without verifying the API. Its prompt has no instruction to verify external library signatures. |
| Post-fix | `pytest` + `tsc` | Ran existing unit tests | Only ran existing unit tests; didn't test the feature end-to-end |

### Root Causes

**1. Tests validated shapes, not behavior**

The `test_discover_tools.py` file contained 23 tests that tested:
- Regex patterns for tool names
- Pydantic model field presence
- Deduplication logic
- Auth/404 early-exit paths

Zero tests reached the `Client(transport)` call. The two "endpoint" tests failed at auth before hitting the client code. Every test passed while the feature was broken.

**2. No agent distinguishes "tests pass" from "feature works"**

`/workflows:review` runs agents from the `review_agents` list in `agentic-engineering.local.md` (configured via the `setup` skill). The default sets are:

- **Rails:** `kieran-rails-reviewer, dhh-rails-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle`
- **Python:** `kieran-python-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle`
- **TypeScript:** `kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle`

Plus the always-on `agent-native-reviewer` and `learnings-researcher`. None of these agents ask: "Does a test actually exercise the integration with an external library?"

**3. `pr-comment-resolver` trusts its own output**

The current `pr-comment-resolver` prompt (`agents/workflow/pr-comment-resolver.md`) follows this flow:
1. Analyze the Comment
2. Plan the Resolution
3. Implement the Change
4. Verify the Resolution (checks code conventions, not library APIs)
5. Report the Resolution

Step 4 says "Ensure no unintended modifications were made" and "Verify the code still follows project conventions" -- but has no instruction to verify that library function signatures match. When the resolver agent fixed todo 125 (info disclosure) and todo 134 (timeout), it wrote `Client(config["url"], headers=config.get("headers", {}))`. It ran `pytest` and saw green. But the test suite never constructed a `Client`, so this line was never executed.

**4. No concept of "integration boundary" in any agent prompt**

The 15 review agents in `agents/review/` each cover a specific domain:
- `security-sentinel` checks for injection
- `performance-oracle` checks for N+1 queries
- `architecture-strategist` checks for coupling
- `data-integrity-guardian` checks database migrations
- `pattern-recognition-specialist` checks for anti-patterns

But no agent asks: **"Where does our code call an external library, and do tests exercise that call?"** This is a distinct concern that falls between the cracks of existing specializations.

**5. v2.35.1 System-Wide Test Check is close but insufficient**

The System-Wide Test Check added to `/workflows:work` in v2.35.1 asks five questions about callbacks, mocked isolation, orphaned state, interface parity, and error strategy alignment. These are valuable for **intra-codebase** integration but miss **library-boundary** integration. The check doesn't ask: "Does the constructor you're calling actually accept these arguments?"

## Proposed Changes

### 1. New Review Agent: `integration-boundary-reviewer`

**File:** `plugins/agentic-engineering/agents/review/integration-boundary-reviewer.md`

**Category:** `review/` (alongside `security-sentinel`, `performance-oracle`, etc.)

**Purpose:** Identify untested integration boundaries -- places where application code calls into external libraries, APIs, or services.

**Trigger:** Run as part of `/workflows:review` parallel agent launch. Added to conditional agents section (see Change 3 below).

**What it checks:**

- For each new/modified function that imports and calls an external library:
  - Does a test exist that exercises the actual call (not just the inputs to it)?
  - Are constructor arguments verified against the library's API?
  - Is there a test with the real library (not just mocks)?
- For HTTP client construction (httpx, requests, fastmcp, aiohttp, etc.):
  - Are the kwargs being passed actually accepted by the constructor?
  - Is the transport type correct for the protocol being used?
- For database operations:
  - Do tests use a real (test) database, or only mock the ORM?

**Key heuristic:** If a function contains `from X import Y` and then calls `Y(...)`, but no test in the PR exercises that `Y(...)` call with real arguments, flag it as P1.

**Agent frontmatter:**

```yaml
---
name: integration-boundary-reviewer
description: "Identifies untested integration boundaries where application code calls external libraries, APIs, or services. Use when reviewing PRs that add new library imports, API clients, or service connections."
color: orange
model: inherit
---
```

**Example finding this agent would have produced:**

> P1: `discover_tools` imports `Client` from `fastmcp` and calls `Client(config["url"], headers=...)` but no test in `test_discover_tools.py` ever constructs a `Client`. The two endpoint tests fail at auth before reaching the client code. The `headers` kwarg is not in `Client.__init__`'s signature.

### 2. Update `pr-comment-resolver` Agent Prompt

**File:** `plugins/agentic-engineering/agents/workflow/pr-comment-resolver.md`

**Current Step 4 (Verify the Resolution):**

```markdown
4. **Verify the Resolution**: After making changes:
   - Double-check that the change addresses the original comment
   - Ensure no unintended modifications were made
   - Verify the code still follows project conventions
```

**Proposed Step 4 (expanded):**

```markdown
4. **Verify the Resolution**: After making changes:

   - Double-check that the change addresses the original comment
   - Ensure no unintended modifications were made
   - Verify the code still follows project conventions

   **Integration verification (when your fix touches external libraries):**

   a. **Verify external API calls**: If your fix calls a library function or
      constructor, verify the function signature actually accepts the arguments
      you're passing. Run the language-appropriate check:
      - Python: `python -c "import X; help(X.ClassName.__init__)"`
      - Ruby: `bundle exec ruby -e "require 'X'; puts X::ClassName.instance_method(:initialize).parameters"`
      - TypeScript/JS: Check the library's type definitions or documentation
      - Or use Context7 MCP: resolve the library ID, then query its constructor docs

   b. **Verify the changed code path is tested**: If you modified a function,
      confirm that at least one test actually executes the lines you changed.
      If no existing test reaches your code, write one.

   c. **For new library usage**: If you introduced a new import or constructor
      call, write a minimal smoke test that actually constructs the object.
      Don't assume the test suite covers it just because tests pass.
```

### 3. Update `/workflows:review` -- Add Integration Testing to Agent Launch

**File:** `plugins/agentic-engineering/commands/workflows/review.md`

The review workflow currently runs agents from `agentic-engineering.local.md`'s `review_agents` list plus always-on `agent-native-reviewer` and `learnings-researcher`.

**Change A:** Add `integration-boundary-reviewer` to the always-on agents list (alongside `agent-native-reviewer` and `learnings-researcher`):

```markdown
#### Parallel Agents to review the PR:

Run all configured review agents in parallel using Task tool. For each agent
in the `review_agents` list:

Task {agent-name}(PR content + review context from settings body)

Additionally, always run these regardless of settings:
- Task agent-native-reviewer(PR content) - Verify new features are agent-accessible
- Task learnings-researcher(PR content) - Search docs/solutions/ for past issues
- Task integration-boundary-reviewer(PR content) - Flag untested external library calls
```

**Change B:** Update the `setup` skill (`plugins/agentic-engineering/skills/setup/SKILL.md`) to include `integration-boundary-reviewer` in the **Comprehensive** depth option:

```markdown
**Depth:**
- Thorough: stack + selected focus areas
- Fast: stack + `code-simplicity-reviewer` only
- Comprehensive: all above + `git-history-analyzer, data-integrity-guardian,
  agent-native-reviewer, integration-boundary-reviewer`
```

### 4. Update `/workflows:work` -- Enhance System-Wide Test Check

**File:** `plugins/agentic-engineering/commands/workflows/work.md`

The v2.35.1 System-Wide Test Check is well-structured but misses library-boundary validation. Add a sixth question to the existing table in Phase 2, Step 1:

**Current table (5 questions).** Add this row:

| Question | What to do |
|----------|------------|
| **Does your code call an external library correctly?** If you import `X` and call `X.Y(args)`, are those args actually accepted by `Y`? Does the test suite exercise that call with real objects, or does it only test code *around* the call? | Run `help(X.Y)` or check the library's type stubs. If no test constructs a real `X.Y(...)`, write a smoke test. Passing tests that never reach the library call prove nothing about the integration. |

**Also update the "Test Continuously" section (Phase 2, Step 4)** by adding after the existing bullet about integration tests:

```markdown
- **External library smoke tests**: If you introduced a new library import
  or constructor call, write at least one test that constructs the real object
  with representative arguments. This catches API mismatches (wrong kwargs,
  missing parameters) that unit tests with mocks will never find.
```

**Also add to Phase 3 (Quality Check), Step 1 "Run Core Quality Checks":**

```markdown
### Integration Boundary Verification

Before submitting, for each external library call introduced or modified:

1. **Identify integration boundaries**: Any `import` from an external
   package followed by a constructor or function call.

2. **Verify at least one test exercises each boundary** with:
   - Real object construction (not a mock)
   - Representative arguments matching the library's actual API
   - Expected behavior assertion

3. **For network-dependent code**: Use in-process servers, test fixtures,
   or localhost servers rather than mocking the entire library away.

4. **Smoke test before committing**: If the feature has a UI or API
   endpoint, hit it once manually or via curl to verify it works
   end-to-end, not just in unit tests.
```

### 5. New Skill: `test-strategy-reviewer`

**Directory:** `plugins/agentic-engineering/skills/test-strategy-reviewer/`

**File:** `plugins/agentic-engineering/skills/test-strategy-reviewer/SKILL.md`

A lightweight skill that can be invoked during `/workflows:plan`, `/workflows:work`, or `/deepen-plan` to analyze a test file and report:

- **Coverage gaps**: Which functions in the source file have no corresponding test?
- **Mock depth**: Are tests mocking at the right level, or mocking away the thing they should be testing?
- **Boundary coverage**: For each external library call, is there a test that exercises it?
- **Happy path coverage**: Do tests cover the primary success path, or only error/edge cases?

**Frontmatter:**

```yaml
---
name: test-strategy-reviewer
description: Analyze test files for coverage gaps, mock depth issues, and untested integration boundaries. Use when reviewing test quality or planning testing strategy for a feature.
---
```

**Example invocation:**

```
skill: test-strategy-reviewer
# Pass the test file path as context
```

**Example output:**

```markdown
## Test Strategy Review: test_discover_tools.py

### Coverage Gaps
- discover_tools() happy path: NOT TESTED
  - No test reaches the Client() constructor on line 458
  - 2 endpoint tests fail at auth before hitting the client code

### Mock Depth Issues
- None (no mocks used -- but also no integration tests)

### Boundary Coverage
- fastmcp.Client: NOT TESTED (0 tests construct a Client)
- asyncio.wait_for: NOT TESTED (no timeout test)

### Recommendation
Add integration test that starts a FastMCP server and calls
discover_tools through the actual Client transport.
```

### 6. Update `/deepen-plan` -- Research Testing Patterns

**File:** `plugins/agentic-engineering/commands/deepen-plan.md`

**Change:** In Step 4 "Launch Per-Section Research Agents", add a dedicated testing strategy research agent that runs alongside the existing per-section research:

```markdown
### 4b. Testing Strategy Research

For each external library mentioned in the plan, spawn a dedicated research agent:

Task Explore: "Research testing patterns for [library name].
Find:
- The library's recommended testing approach (in-process vs mock vs fixture)
- Constructor signatures and required arguments
- Common testing pitfalls and anti-patterns
- Example integration tests from the library's own test suite or docs
Return concrete test code examples."

Also query Context7 for framework-specific testing documentation:

mcp__plugin_agentic-engineering_context7__resolve-library-id: Find library ID for [library]
mcp__plugin_agentic-engineering_context7__query-docs: Query testing patterns and examples
```

**Additionally**, in Step 7 "Enhance Plan Sections", add a **Testing Strategy** section to the enhancement format:

```markdown
### Testing Strategy (added by /deepen-plan)

**Integration Boundaries Identified:**
- [Library 1]: Constructor pattern, recommended test approach
- [Library 2]: Constructor pattern, recommended test approach

**Recommended Integration Tests:**
```[language]
// Concrete test example from library docs/research
```

**Testing Anti-Patterns to Avoid:**
- [Anti-pattern 1 and why it's dangerous]
```

This would have caught the `Client` API mismatch at plan time rather than after 3 rounds of implementation and review.

## Implementation Priority

| # | Change | File(s) | Effort | Impact | Priority |
|---|--------|---------|--------|--------|----------|
| 2 | Update `pr-comment-resolver` prompt | `agents/workflow/pr-comment-resolver.md` | Small | High -- prevents resolver agents from introducing bugs via `/resolve_todo_parallel` | P1 |
| 4 | Enhance `/workflows:work` System-Wide Test Check | `commands/workflows/work.md` | Small | Medium -- adds library-boundary question to existing v2.35.1 check | P1 |
| 1 | New `integration-boundary-reviewer` agent | `agents/review/integration-boundary-reviewer.md` | Medium | High -- catches the exact class of bug we hit | P2 |
| 3 | Add `integration-boundary-reviewer` to `/workflows:review` always-on list | `commands/workflows/review.md`, `skills/setup/SKILL.md` | Small | Medium -- catches test gaps during every review | P2 |
| 5 | New `test-strategy-reviewer` skill | `skills/test-strategy-reviewer/SKILL.md` | Medium | Medium -- useful for manual invocation during `/workflows:plan` or `/workflows:work` | P3 |
| 6 | Update `/deepen-plan` testing research | `commands/deepen-plan.md` | Small | Low -- only helps if plans are deepened | P3 |

### Versioning

Per `plugins/agentic-engineering/CLAUDE.md`, this adds:
- 1 new agent (`integration-boundary-reviewer`) -> MINOR bump
- 1 new skill (`test-strategy-reviewer`) -> MINOR bump
- Updates to 4 existing commands/agents -> included in same MINOR

**Proposed version:** `2.37.0` (from current `2.36.0`)

**Files requiring count updates:**
- `plugins/agentic-engineering/.claude-plugin/plugin.json` -> 30 agents, 21 skills
- `.claude-plugin/marketplace.json` -> matching description
- `plugins/agentic-engineering/README.md` -> matching description + new entries in agent/skill tables
- `plugins/agentic-engineering/CHANGELOG.md` -> document all changes

## Success Criteria

After these changes, the following scenario should be caught before merge:

1. `/workflows:plan` creates plan. If `/deepen-plan` is run, a Testing Strategy section is added with library constructor signatures and integration test examples.
2. `/workflows:work` implements feature. The enhanced System-Wide Test Check asks: "Does your code call an external library correctly? Are those args actually accepted?" Developer is prompted to write integration test.
3. `/workflows:review` launches configured agents from `agentic-engineering.local.md` PLUS the always-on `integration-boundary-reviewer`, which flags: "Client() is never constructed in any test."
4. Todo files are created via `file-todos` skill with P1 finding about missing integration test.
5. `/resolve_todo_parallel` spawns `pr-comment-resolver` agents. The updated prompt forces each resolver to verify `Client.__init__` signature before using it (via `help()`, type stubs, or Context7).
6. Feature either works before merge, or review blocks merge with a P1 finding.

## Appendix: The Test That Would Have Caught This

```python
@pytest.mark.asyncio
async def test_discover_tools_over_http(self):
    """Start a real MCP server on localhost and discover its tools."""
    mcp = FastMCP("test")

    @mcp.tool()
    def ping() -> str:
        return "pong"

    port = _free_port()
    task = asyncio.create_task(
        mcp.run_http_async(host="127.0.0.1", port=port, transport="streamable-http")
    )
    await asyncio.sleep(0.5)

    try:
        config = {"url": f"http://127.0.0.1:{port}/mcp", "transport": "http"}
        transport = build_discovery_transport(config)
        async with Client(transport) as client:
            tools = await client.list_tools()
        assert len(tools) == 1
        assert tools[0].name == "ping"
    finally:
        task.cancel()
```

This test takes 1.7 seconds to run and would have caught both bugs (wrong `Client` kwargs and missing SSE transport dispatch) before any code review agent was even needed.
