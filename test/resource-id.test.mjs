import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeResourceId } from '../src/resource-id.mjs';

test('메모와 강사 공지를 서로 다른 자원으로 식별한다', () => {
  assert.equal(makeResourceId('note', '123'), 'note:123');
  assert.equal(makeResourceId('notice', '456'), 'notice:456');
});

test('잘못된 자원 종류를 거부한다', () => {
  assert.throws(
    () => makeResourceId('admin', '123'),
    /INVALID_RESOURCE_TYPE/
  );
});

test('유효하지 않은 자료 ID를 거부한다', () => {
  assert.throws(
    () => makeResourceId('note', undefined),
    /INVALID_RESOURCE_ID/
  );

  assert.throws(
    () => makeResourceId('note', ''),
    /INVALID_RESOURCE_ID/
  );
});