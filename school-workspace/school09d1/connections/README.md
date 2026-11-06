> 고정 정책: 0원 운영, 기존 BogunOn/BAERURI 두 프로젝트만 유지. 추가 프로젝트 생성·확보·비용 검토·유료 전환 없음. Hosted는 READ-ONLY 메타데이터만. 실설치/실계정 시험은 별도 승인 전 NOT RUN. 최신 범위는 `../SCOPE_POLICY.json` 및 `../REPORT.md`를 따른다.

> 2026-11-06 추가 OAuth 이후 상태: 두 연결 모두 조회 성공. 현재 증거와 라우팅은 `../hosted-readonly/connections.json`, 판정은 `../REPORT.md` 참조. 아래는 추가 OAuth 이전 설정/진단 이력이다. 기존 ChatGPT 연결의 인증을 다시 수행할 필요는 없다. CLI 별도 설정이 인증됐다는 뜻은 아니다.

# Concurrent Supabase connections — 2026-11-06

## Verified scope

The existing ChatGPT Supabase connection remains unchanged. Organization visibility: TEAM BAERURI (`lvghjzarjcsqfpkqucih`). Project metadata access to `baeruri` (`zbdnvdjleipnrprpwqyd`, ap-northeast-2) succeeded. Metadata access to BogunOn (`xxownwxxajzrviuvvfiu`, expected ap-southeast-2) was denied. No fallback request or database query followed the denial. Personal account/email identity is not exposed by the connector; wrong account versus organization-scoped OAuth consent is not distinguishable from this evidence.

No disconnect, replacement, provider permission change, SQL, migration, Auth setting change, or old development/QA rerun occurred.

## Additive project pinning

`.codex/config.toml` adds the unique `supabase_bogunon_ro` name and a project-scoped, read-only endpoint. It contains no credentials. The BAERURI template is an example only, because its repository is not available here. It must be added alongside existing entries in that repository, never substituted for them.

The shell CLI registry and the injected ChatGPT connector are separate. In this environment `codex mcp list --json` did not load the repository entry. An explicit CLI override recognized the scoped endpoint, with authentication status `unknown`; this is NOT an authenticated connection or a successful project query. No global configuration or trust settings were changed.

On a user-controlled Codex CLI, launch with this additive override if repo-local configuration is not loaded:

```sh
codex -c 'mcp_servers.supabase_bogunon_ro.url="https://mcp.supabase.com/mcp?project_ref=xxownwxxajzrviuvvfiu&read_only=true"' mcp login supabase_bogunon_ro
```

Complete OAuth in the browser using an account authorized for the BogunOn organization. Do not disconnect BAERURI or replace its connection. Do not paste passwords, tokens, authorization codes, or callback URLs into chat. If the consent flow would replace an existing grant rather than add access, stop and use a separate named connection/account supported by the client. Login cannot be completed from this session: no OAuth/account-switch/browser-control tool is exposed, and the managed global config is read-only.

For the existing ChatGPT Supabase app, use an additional connection/account if offered. If one account belongs to both organizations, authorize both organizations while retaining TEAM BAERURI. Merely opening the BogunOn dashboard or switching its selected organization does not grant MCP access. If the UI only offers replacement, leave BAERURI intact and use the separate project-scoped MCP connection above.

## Stop-on-mismatch guard

```sh
python school-workspace/school09d1/connections/verify_binding.py --observed-project xxownwxxajzrviuvvfiu
PYTHONDONTWRITEBYTECODE=1 python school-workspace/school09d1/connections/test_binding.py
```

The observed ID must come from a verified connection response, not an assumed successful login. The script checks the scoped URL, read-only flag and product origin; mismatch or access denial exits nonzero. It sends no network requests. These checks do not intercept arbitrary calls through the existing global ChatGPT connector. Every such call still requires an explicit project ID and stopping on denial/mismatch. No automatic replacement project is permitted.

## Next verification after OAuth

1. Verify BAERURI remains accessible by its exact ID using project metadata only.
2. Verify BogunOn through its new scoped connection using project URL/metadata only; project-scoped MCP disables account-level list tools.
3. Require the returned host/ref to match the expected ID before any further read-only metadata work. Stop immediately on denial or mismatch.
4. No production installation or authenticated user testing is authorized by this connection setup.

Status: BAERURI metadata VERIFIED; BogunOn access BLOCKED pending user OAuth. Both-project access is not complete. New offline guard tests: 6 PASS; existing QA not rerun.

References:
- https://supabase.com/docs/guides/ai-tools/mcp (project_ref, read_only, browser OAuth organization authorization)
- https://developers.openai.com/codex/mcp/ (Codex MCP configuration and OAuth login)
