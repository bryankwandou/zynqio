/**
 * Zynqio Load Test — Simulate 300 concurrent players
 * Usage: node scripts/load-test.js [BASE_URL] [ROOM_CODE]
 *
 * Target: p95 response time < 500ms for /api/room/state
 * Upstash free tier: 10,000 req/day — 300 players x 20 questions = 6,000 req (safe)
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
const ROOM_CODE = process.argv[3] || "TEST01";
const PLAYER_COUNT = parseInt(process.argv[4] || "300", 10);
const BATCH_SIZE = 50;

const results = {
  join: { times: [], errors: 0 },
  state: { times: [], errors: 0 },
  answer: { times: [], errors: 0 },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function timedFetch(url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    return { ms: Date.now() - start, status: res.status, ok: res.ok };
  } catch {
    return { ms: Date.now() - start, status: 0, ok: false, error: true };
  }
}

async function joinPlayer(i) {
  const r = await timedFetch(`${BASE_URL}/api/room/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomCode: ROOM_CODE,
      playerName: `LoadTestPlayer${i}`,
      avatarId: "fox",
    }),
  });
  results.join.times.push(r.ms);
  if (!r.ok) results.join.errors++;
  return r;
}

async function pollState(playerId) {
  const r = await timedFetch(`${BASE_URL}/api/room/state?code=${ROOM_CODE}`);
  results.state.times.push(r.ms);
  if (!r.ok) results.state.errors++;
}

async function submitAnswer(playerId, questionId, sessionId) {
  const r = await timedFetch(`${BASE_URL}/api/answer/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId,
      questionId: questionId || "q1",
      selectedAnswer: "0",
      roomCode: ROOM_CODE,
      sessionId: sessionId || "test_session",
    }),
  });
  results.answer.times.push(r.ms);
  if (!r.ok) results.answer.errors++;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx];
}

function stats(arr) {
  if (!arr.length) return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  return {
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    p50: percentile(arr, 50),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    max: Math.max(...arr),
  };
}

async function runBatch(fn, items) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fn));
    await sleep(100); // Brief pause between batches
  }
}

async function main() {
  console.log(`\n🚀 Zynqio Load Test`);
  console.log(`   Base URL:    ${BASE_URL}`);
  console.log(`   Room Code:   ${ROOM_CODE}`);
  console.log(`   Players:     ${PLAYER_COUNT}`);
  console.log(`   Batch size:  ${BATCH_SIZE}\n`);

  // Phase 1: Join room
  console.log(`[1/3] Joining ${PLAYER_COUNT} players...`);
  const players = Array.from({ length: PLAYER_COUNT }, (_, i) => i);
  const start1 = Date.now();
  await runBatch((i) => joinPlayer(i), players);
  console.log(`      Done in ${Date.now() - start1}ms — Errors: ${results.join.errors}`);

  // Phase 2: Poll state (simulate lobby waiting)
  console.log(`[2/3] Polling room state (3x per player)...`);
  const pollers = Array.from({ length: PLAYER_COUNT * 3 }, (_, i) => i);
  const start2 = Date.now();
  await runBatch(() => pollState(), pollers);
  console.log(`      Done in ${Date.now() - start2}ms — Errors: ${results.state.errors}`);

  // Phase 3: Submit answers
  console.log(`[3/3] Submitting answers (1 per player)...`);
  const answerers = players.map((i) => ({
    id: `player_${i}`,
    q: "q_test_1",
    s: "session_test",
  }));
  const start3 = Date.now();
  await runBatch((p) => submitAnswer(p.id, p.q, p.s), answerers);
  console.log(`      Done in ${Date.now() - start3}ms — Errors: ${results.answer.errors}`);

  // Report
  console.log("\n📊 Results:\n");

  const sections = [
    ["Join Room (/api/room/join)", results.join],
    ["Poll State (/api/room/state)", results.state],
    ["Submit Answer (/api/answer/submit)", results.answer],
  ];

  for (const [label, data] of sections) {
    const s = stats(data.times);
    const pass = s.p95 < 500;
    console.log(`  ${pass ? "✅" : "❌"} ${label}`);
    console.log(`     avg=${s.avg}ms  p50=${s.p50}ms  p95=${s.p95}ms  p99=${s.p99}ms  max=${s.max}ms`);
    console.log(`     errors=${data.errors}/${data.times.length}\n`);
  }

  const allP95s = sections.map(([, d]) => percentile(d.times, 95));
  const worstP95 = Math.max(...allP95s);
  console.log(`Overall p95: ${worstP95}ms — Target: <500ms — ${worstP95 < 500 ? "✅ PASS" : "❌ FAIL"}\n`);
}

main().catch(console.error);
