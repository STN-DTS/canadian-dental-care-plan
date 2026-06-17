export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const ErrorCodes = {
  UNCAUGHT_ERROR: 'UNC-0000',

  // validation error codes
  INVALID_REQUEST: 'VAL-0001',

  // instance error codes
  NO_FACTORY_PROVIDED: 'INST-0001',

  // route error codes
  ROUTE_NOT_FOUND: 'RTE-0001',

  // dev-only error codes
  TEST_ERROR_CODE: 'DEV-0001',

  // external api error codes
  XAPI_API_ERROR: 'XAPI-0001',
  XAPI_TOO_MANY_REQUESTS: 'XAPI-0002',
  XAPI_RETRY_NO_CONDITIONS: 'XAPI-0003',
  XAPI_RETRY_CONDITION_MATCHED: 'XAPI-0004',
} as const;
