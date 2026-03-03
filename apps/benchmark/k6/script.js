import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    // --- NODE JS TESTS ---
    // 1. Manual Ping
    warmup_manual_ping: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualPing',
      startTime: '0s',
      tags: { test_type: 'warmup_manual_ping', is_warmup: 'true' },
    },
    manual_ping: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualPing',
      startTime: '5s',
      tags: { test_type: 'manual_ping' },
    },

    // 2. Manual Users Simple
    warmup_manual_users_simple: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualUsers',
      startTime: '25s',
      tags: { test_type: 'warmup_manual_users_simple', is_warmup: 'true' },
    },
    manual_users_simple: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualUsers',
      startTime: '30s',
      tags: { test_type: 'manual_users_simple' },
    },

    // 3. Auto Users Simple
    warmup_auto_users_simple: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'autoUsers',
      startTime: '50s',
      tags: { test_type: 'warmup_auto_users_simple', is_warmup: 'true' },
    },
    auto_users_simple: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'autoUsers',
      startTime: '55s',
      tags: { test_type: 'auto_users_simple' },
    },

    // 4. Manual Posts Complex
    warmup_manual_posts_complex: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualPostsComplex',
      startTime: '75s',
      tags: { test_type: 'warmup_manual_posts_complex', is_warmup: 'true' },
    },
    manual_posts_complex: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualPostsComplex',
      startTime: '80s',
      tags: { test_type: 'manual_posts_complex' },
    },

    // 5. Auto Posts Complex
    warmup_auto_posts_complex: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'autoPostsComplex',
      startTime: '100s',
      tags: { test_type: 'warmup_auto_posts_complex', is_warmup: 'true' },
    },
    auto_posts_complex: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'autoPostsComplex',
      startTime: '105s',
      tags: { test_type: 'auto_posts_complex' },
    },


    // --- BUN TESTS ---
    // 6. Manual Ping Bun
    warmup_manual_ping_bun: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualPingBun',
      startTime: '125s',
      tags: { test_type: 'warmup_manual_ping_bun', is_warmup: 'true' },
    },
    manual_ping_bun: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualPingBun',
      startTime: '130s',
      tags: { test_type: 'manual_ping_bun' },
    },

    // 7. Manual Users Simple Bun
    warmup_manual_users_simple_bun: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualUsersBun',
      startTime: '150s',
      tags: { test_type: 'warmup_manual_users_simple_bun', is_warmup: 'true' },
    },
    manual_users_simple_bun: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualUsersBun',
      startTime: '155s',
      tags: { test_type: 'manual_users_simple_bun' },
    },

    // 8. Auto Users Simple Bun
    warmup_auto_users_simple_bun: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'autoUsersBun',
      startTime: '175s',
      tags: { test_type: 'warmup_auto_users_simple_bun', is_warmup: 'true' },
    },
    auto_users_simple_bun: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'autoUsersBun',
      startTime: '180s',
      tags: { test_type: 'auto_users_simple_bun' },
    },

    // 9. Manual Posts Complex Bun
    warmup_manual_posts_complex_bun: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualPostsComplexBun',
      startTime: '200s',
      tags: { test_type: 'warmup_manual_posts_complex_bun', is_warmup: 'true' },
    },
    manual_posts_complex_bun: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualPostsComplexBun',
      startTime: '205s',
      tags: { test_type: 'manual_posts_complex_bun' },
    },

    // 10. Auto Posts Complex Bun
    warmup_auto_posts_complex_bun: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'autoPostsComplexBun',
      startTime: '225s',
      tags: { test_type: 'warmup_auto_posts_complex_bun', is_warmup: 'true' },
    },
    auto_posts_complex_bun: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'autoPostsComplexBun',
      startTime: '230s',
      tags: { test_type: 'auto_posts_complex_bun' },
    },

    // --- FASTIFY TESTS ---
    // 11. Manual Ping Fastify
    warmup_manual_ping_fastify: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualPingFastify',
      startTime: '250s',
      tags: { test_type: 'warmup_manual_ping_fastify', is_warmup: 'true' },
    },
    manual_ping_fastify: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualPingFastify',
      startTime: '255s',
      tags: { test_type: 'manual_ping_fastify' },
    },

    // 12. Manual Users Simple Fastify
    warmup_manual_users_simple_fastify: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualUsersFastify',
      startTime: '275s',
      tags: { test_type: 'warmup_manual_users_simple_fastify', is_warmup: 'true' },
    },
    manual_users_simple_fastify: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualUsersFastify',
      startTime: '280s',
      tags: { test_type: 'manual_users_simple_fastify' },
    },

    // 13. Manual Posts Complex Fastify
    warmup_manual_posts_complex_fastify: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5s',
      exec: 'manualPostsComplexFastify',
      startTime: '300s',
      tags: { test_type: 'warmup_manual_posts_complex_fastify', is_warmup: 'true' },
    },
    manual_posts_complex_fastify: {
      executor: 'constant-vus',
      vus: 20,
      duration: '20s',
      exec: 'manualPostsComplexFastify',
      startTime: '305s',
      tags: { test_type: 'manual_posts_complex_fastify' },
    },
  },
  thresholds: {
    'http_req_duration{test_type:manual_ping}': ['p(95)<100'],
    'http_req_duration{test_type:manual_users_simple}': ['p(95)<500'],
    'http_req_duration{test_type:auto_users_simple}': ['p(95)<500'],
    'http_req_duration{test_type:manual_posts_complex}': ['p(95)<500'],
    'http_req_duration{test_type:auto_posts_complex}': ['p(95)<500'],
    'http_reqs{test_type:manual_ping}': ['count>=0'],
    'http_reqs{test_type:manual_users_simple}': ['count>=0'],
    'http_reqs{test_type:auto_users_simple}': ['count>=0'],
    'http_reqs{test_type:manual_posts_complex}': ['count>=0'],
    'http_reqs{test_type:auto_posts_complex}': ['count>=0'],
    
    // Bun Thresholds
    'http_req_duration{test_type:manual_ping_bun}': ['p(95)<100'],
    'http_req_duration{test_type:manual_users_simple_bun}': ['p(95)<500'],
    'http_req_duration{test_type:auto_users_simple_bun}': ['p(95)<500'],
    'http_req_duration{test_type:manual_posts_complex_bun}': ['p(95)<500'],
    'http_req_duration{test_type:auto_posts_complex_bun}': ['p(95)<500'],
    'http_reqs{test_type:manual_ping_bun}': ['count>=0'],
    'http_reqs{test_type:manual_users_simple_bun}': ['count>=0'],
    'http_reqs{test_type:auto_users_simple_bun}': ['count>=0'],
    'http_reqs{test_type:manual_posts_complex_bun}': ['count>=0'],
    'http_reqs{test_type:auto_posts_complex_bun}': ['count>=0'],

    // Fastify Thresholds
    'http_req_duration{test_type:manual_ping_fastify}': ['p(95)<100'],
    'http_req_duration{test_type:manual_users_simple_fastify}': ['p(95)<500'],
    'http_req_duration{test_type:manual_posts_complex_fastify}': ['p(95)<500'],
    'http_reqs{test_type:manual_ping_fastify}': ['count>=0'],
    'http_reqs{test_type:manual_users_simple_fastify}': ['count>=0'],
    'http_reqs{test_type:manual_posts_complex_fastify}': ['count>=0'],
  },
};

const NODE_URL = 'http://app:3000';
const BUN_URL = 'http://app-bun:3000';
const FASTIFY_URL = 'http://app-fastify:3000';

function checkResponse(res, name) {
  const success = check(res, { 'status was 200': (r) => r.status == 200 });
  if (!success) {
    console.error(`[${name}] Failed: ${res.status} ${res.body}`);
  }
}

// Node Functions
export function manualPing() {
  const res = http.get(`${NODE_URL}/api/manual/ping`);
  checkResponse(res, 'manualPing');
}

export function manualUsers() {
  const res = http.get(`${NODE_URL}/api/manual/users`);
  checkResponse(res, 'manualUsers');
}

export function autoUsers() {
  const res = http.get(`${NODE_URL}/api/users`);
  checkResponse(res, 'autoUsers');
}

export function manualPostsComplex() {
  const res = http.get(`${NODE_URL}/api/manual/posts-complex`);
  checkResponse(res, 'manualPostsComplex');
}

export function autoPostsComplex() {
  const res = http.get(`${NODE_URL}/api/posts?include=author&include=comments&limit=20`);
  checkResponse(res, 'autoPostsComplex');
}

// Bun Functions
export function manualPingBun() {
  const res = http.get(`${BUN_URL}/api/manual/ping`);
  checkResponse(res, 'manualPingBun');
}

export function manualUsersBun() {
  const res = http.get(`${BUN_URL}/api/manual/users`);
  checkResponse(res, 'manualUsersBun');
}

export function autoUsersBun() {
  const res = http.get(`${BUN_URL}/api/users`);
  checkResponse(res, 'autoUsersBun');
}

export function manualPostsComplexBun() {
  const res = http.get(`${BUN_URL}/api/manual/posts-complex`);
  checkResponse(res, 'manualPostsComplexBun');
}

export function autoPostsComplexBun() {
  const res = http.get(`${BUN_URL}/api/posts?include=author&include=comments&limit=20`);
  checkResponse(res, 'autoPostsComplexBun');
}

// Fastify Functions
export function manualPingFastify() {
  const res = http.get(`${FASTIFY_URL}/api/manual/ping`);
  checkResponse(res, 'manualPingFastify');
}

export function manualUsersFastify() {
  const res = http.get(`${FASTIFY_URL}/api/manual/users`);
  checkResponse(res, 'manualUsersFastify');
}

export function manualPostsComplexFastify() {
  const res = http.get(`${FASTIFY_URL}/api/manual/posts-complex`);
  checkResponse(res, 'manualPostsComplexFastify');
}

export function handleSummary(data) {
  const tests = [
    'manual_ping',
    'manual_users_simple',
    'auto_users_simple',
    'manual_posts_complex',
    'auto_posts_complex',
    'manual_ping_bun',
    'manual_users_simple_bun',
    'auto_users_simple_bun',
    'manual_posts_complex_bun',
    'auto_posts_complex_bun',
    'manual_ping_fastify',
    'manual_users_simple_fastify',
    'manual_posts_complex_fastify'
  ];

  const baselines = {};

  let output = '\n\n';
  const separator = '--------------------------------------------------------------------------------------------------------------\n';
  output += separator;
  output += '| Test Case                 | RPS (req/s) | Avg (ms)    | p95 (ms)    | Max (ms)    | Failure % | % Slower  |\n';
  output += '|---------------------------|-------------|-------------|-------------|-------------|-----------|-----------|\n';

  tests.forEach(test => {
    const durationKey = `http_req_duration{test_type:${test}}`;
    const reqsKey = `http_reqs{test_type:${test}}`;
    
    const durationMetric = data.metrics[durationKey];
    const reqsMetric = data.metrics[reqsKey];
    
    if (!durationMetric || !reqsMetric) {
       output += `| ${test.padEnd(25)} | N/A         | N/A         | N/A         | N/A         | N/A       | N/A       |\n`;
       return;
    }

    const count = reqsMetric.values.count;
    const rps = (count / 20).toFixed(2);
    const avgVal = durationMetric.values.avg;
    const avg = avgVal.toFixed(2);
    const p95 = durationMetric.values['p(95)'].toFixed(2);
    const max = durationMetric.values.max.toFixed(2);
    
    let slower = '-';

    if (test.startsWith('manual_')) {
        baselines[test] = avgVal;
    } else if (test.startsWith('auto_')) {
        const manualKey = test.replace('auto_', 'manual_');
        if (baselines[manualKey]) {
            const manualAvg = baselines[manualKey];
            const diff = ((avgVal - manualAvg) / manualAvg) * 100;
            slower = (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
        }
    }
    
    output += `| ${test.padEnd(25)} | ${rps.padEnd(11)} | ${avg.padEnd(11)} | ${p95.padEnd(11)} | ${max.padEnd(11)} | -         | ${slower.padEnd(9)} |\n`;
  });

  output += separator;

  return {
    'stdout': output,
  };
}
