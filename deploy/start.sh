#!/bin/sh
# Runs the TrueForge harness and the Taro server in one container.
# TrueForge stays on the container's loopback; only Taro (8000) is exposed.
set -e

# Pin TrueForge to its own port: platforms like Railway inject PORT for the
# public service, and TrueForge would otherwise grab it.
PORT=8790 npx --yes @truefoundry/trueforge@latest &
TRUEFORGE_PID=$!

# Taro binds the platform-injected PORT (falls back to 8000 locally); the
# MCP callback URL must follow it.
TARO_PORT="${PORT:-8000}"
export MCP_PUBLIC_URL="${MCP_PUBLIC_URL_OVERRIDE:-http://127.0.0.1:${TARO_PORT}/mcp}"

# Wait for the harness before Taro registers the agent + MCP server.
i=0
until node -e "fetch('http://127.0.0.1:8790/api/v1/capabilities').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  i=$((i+1))
  [ $i -gt 60 ] && echo "TrueForge did not start" && exit 1
  sleep 2
done

# Sandbox provider (Daytona) — required for the agent's code execution.
if [ -n "$DAYTONA_API_KEY" ]; then
  node -e "
    fetch('http://127.0.0.1:8790/api/v1/settings/sandbox-providers', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ manifest: { type: 'daytona', auth: { api_key: process.env.DAYTONA_API_KEY },
        exec_timeout_ms: 60000, auto_stop_interval_in_minutes: 5,
        auto_archive_interval_in_minutes: 60, auto_delete_interval_in_minutes: 1440 } }),
    }).then(r => console.log('daytona provider:', r.status));
  "
fi

# Placeholder model provider so the orchestrator agent can be registered;
# visitors rotate in their own key through the lock screen (BYOK).
node -e "
  fetch('http://127.0.0.1:8790/api/v1/settings/model-providers', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ manifest: { type: 'openai',
      auth: { api_key: process.env.OPENAI_API_KEY || 'sk-placeholder-bring-your-own-key' },
      models: [
        { model_id: 'gpt-5.1', name: 'gpt-5-1', properties: { context_length: 400000, max_output_tokens: 128000 } },
        { model_id: 'gpt-5-mini', name: 'gpt-5-mini', properties: { context_length: 400000, max_output_tokens: 128000 } }
      ] } }),
  }).then(r => console.log('model provider:', r.status));
"

cd /app && pnpm --filter @taro/server start &
TARO_PID=$!

trap 'kill $TRUEFORGE_PID $TARO_PID' TERM INT
wait $TARO_PID
