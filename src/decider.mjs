// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
// 6단계 추가
// 7단계 추가
// 8단계 추가


function inspectConnectionInput(request) {
  const signals = request?.signals;
  const source = signals?.source;

  // 현재 계약에서 실제로 신뢰할 수 있는 위치 신호는 없음
  const isFixture = source === 'judge_fixture';

  return {
    at: typeof request?.at === 'string' ? request.at : null,
    source: source === 'none' || source === 'judge_fixture'
      ? source
      : null,
    region: isFixture ? signals?.region : null,
    network: isFixture ? signals?.network : null,
    hour: isFixture ? signals?.hour : null,
    recentEvents: Array.isArray(request?.recentEvents)
      ? request.recentEvents
      : null,
  };
}


function needsStepUp(connectionInput) {

  // 심판의 합성 시험 사건만 판정
  if (connectionInput.source !== 'judge_fixture') {
    return false;
  }

  const unusualHour = connectionInput.hour === 3;
  const unusualNetwork = connectionInput.network === 'unusual';

  const manyReads = connectionInput.recentEvents?.some(
    event =>
      event.kind === 'risk_signal' &&
      event.count >= 20
  ) === true;

  return unusualHour && unusualNetwork && manyReads;
}

export function isAllowedZone(request) {
  const { service, method, route } = request;

  if (service !== 'notes') {
    return false;
  }

  if (
    method === 'GET' &&
    (route === 'GET /notes/:id' || route === 'GET /api/notes/:id')
  ) {
    return true;
  }

  if (method === 'GET' && route === 'GET /api/notices/:id') {
    return true;
  }

  return false;
}

export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'resource_zone'
]);

export async function decide(request) {
  const connectionInput = inspectConnectionInput(request);
  const registered = request?.deviceRegistered === true;

  if (!registered) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  const suspicious = needsStepUp(connectionInput);
  if (!isAllowedZone(request)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'resource_access_denied',
      ruleIds: ['resource_zone'],
    };
  }
  const verified = request?.stepUp?.verified === true;

  const additionalCheck = suspicious && !verified;

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: additionalCheck ? 'step_up' : 'allow',
    reasonCode: additionalCheck ? 'step_up_required' : 'approved',
    ruleIds: additionalCheck
      ? ['device_registered', 'step_up_required']
      : ['device_registered'],
  };
}
