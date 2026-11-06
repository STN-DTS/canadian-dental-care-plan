import { ConnectionTimeoutError, ErrorReply, SocketClosedUnexpectedlyError, SocketTimeoutError, TimeoutError } from 'redis';
import { expect, test } from 'vitest';

import { redisErrorType } from '~/.server/data/redis-error-type';
import { ResourceNotFoundException } from '~/.server/domain/exceptions/resource-not-found-exception';

test.each([
  [new ConnectionTimeoutError(), 'ConnectionTimeoutError'],
  [new SocketTimeoutError(1000), 'SocketTimeoutError'],
  [new TimeoutError(), 'TimeoutError'],
  [new SocketClosedUnexpectedlyError(), 'SocketClosedUnexpectedlyError'],
  [new ErrorReply('WRONGPASS synthetic-secret'), 'ErrorReply'],
  [new ErrorReply('NOAUTH synthetic-secret'), 'ErrorReply'],
  [new ErrorReply('NOPERM synthetic-secret'), 'ErrorReply'],
  [new ErrorReply('ERR synthetic-secret'), 'ErrorReply'],
  [Object.assign(new Error('synthetic-secret'), { code: 'ECONNREFUSED' }), 'Error'],
  [new Error('synthetic-secret'), 'Error'],
  [new ResourceNotFoundException('synthetic-secret'), 'ResourceNotFoundException'],
])('projects Redis failures to fixed categories', (error, expected) => {
  expect(redisErrorType(error)).toBe(expected);
});
