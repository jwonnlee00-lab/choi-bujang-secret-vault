// Stage 5 self-check: unauthenticated requests only; never expose note bodies or tokens.
export async function runAttackChecks(config) {
  if (config.step !== 7) throw new Error('7단계 자기 점검 설정을 확인해 주세요.');
  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || !app.hostname.endsWith('.vercel.app')) {
    throw new Error('실제 HTTPS 배포 주소가 필요합니다.');
  }
  const checks = [];
  const fetchStatus = async (path) => {
    const response = await fetch(new URL(path, app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Cache-Control': 'no-cache' },
    });
    return response;
  };
  const anonymous = await fetchStatus('/api/notes');
  checks.push({
    attackId: 'anonymous_note_read',
    expected: '비로그인 자료 요청은 HTTP 401로 거부',
    observed: '비로그인 GET /api/notes: HTTP ' + anonymous.status,
  });
  const staticResponse = await fetchStatus('/data.json');
  let empty = false;
  if (staticResponse.ok) {
    try {
      const data = await staticResponse.json();
      empty = Array.isArray(data.notes) && data.notes.length === 0;
    } catch {}
  }
  checks.push({
    attackId: 'public_static_notes',
    expected: '정적 자료 파일은 404이거나 메모 0건',
    observed: 'GET /data.json: HTTP ' + staticResponse.status + ', 메모 0건 확인: ' + empty,
  });
  // Original REST API denial: public publishable key only, never the server secret.
  const original = new URL(config.originalApiUrl);
  if (original.protocol !== 'https:' || original.search) {
    throw new Error('원본 자료 API의 쿼리 없는 HTTPS 주소를 확인해 주세요.');
  }
  original.searchParams.set('select', 'id');
  const originalResponse = await fetch(original, {
    redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { apikey: 'sb_publishable_ipKN9KbU0NZx-DCV_bEEcg_LGecVpI4' },
  });
  checks.push({
    attackId: 'anonymous_original_notes',
    expected: '익명 원본 notes 직접 조회는 HTTP 401/403으로 거부',
    observed: '익명 GET 원본 notes: HTTP ' + originalResponse.status,
  });
  return checks;
}
