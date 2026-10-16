// 9단계에서 학생이 채우는 탐지 함수입니다. 이 기본값은 어떤 접속도 회수하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.
// 9단계: 사용자별 10분 내 GET 요청 120건 초과 탐지

export function detect(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('invalid_detection_events');
  }

  // 사용자별 GET 요청 발생 시각을 저장
  const users = new Map();

  for (const event of events) {
    if (event.method !== 'GET') continue;

    const subject = event.identity.sub;
    const time = Date.parse(event.at);

    if (!users.has(subject)) {
      users.set(subject, []);
    }

    users.get(subject).push(time);
  }

  // 사용자별로 어느 10분 구간에서든 120건을 초과했는지 검사
  for (const [subject, times] of users) {
    times.sort((a, b) => a - b);

    let start = 0;

    for (let end = 0; end < times.length; end++) {
      while (times[end] - times[start] > 10 * 60 * 1000) {
        start++;
      }

      const count = end - start + 1;

      if (count > 120) {
        return {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject,
        };
      }
    }
  }

  return { action: 'observe' };
}