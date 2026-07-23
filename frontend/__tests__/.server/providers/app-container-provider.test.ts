import { Container } from 'inversify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { DefaultAppContainerProvider } from '~/.server/app-container-provider';
import type { ServiceIdentifier } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

describe('DefaultAppContainerProvider', () => {
  let container: Container;
  let appContainerProvider: DefaultAppContainerProvider;

  let mockLogger: MockProxy<Logger>;

  type MockService = { name: string };
  const mockService: MockService = { name: 'MockService' };
  const mockServiceIdentifier = Symbol.for('MockService') as unknown as ServiceIdentifier<MockService>;

  beforeEach(() => {
    mockLogger = mock<Logger>();
    vi.mocked(createLogger).mockReturnValueOnce(mockLogger);

    container = new Container();
    appContainerProvider = new DefaultAppContainerProvider(container);
  });

  describe('find', () => {
    it('should return the service instance if found', () => {
      container.bind(mockServiceIdentifier).toConstantValue(mockService);

      const result = appContainerProvider.find(mockServiceIdentifier);

      expect(result).toEqual(mockService);
      expect(mockLogger.trace).toHaveBeenCalledWith('Finding service for service identifier: %s', mockServiceIdentifier);
    });

    it('should return undefined if service is not found', () => {
      const result = appContainerProvider.find(mockServiceIdentifier);

      expect(result).toBeUndefined();
      expect(mockLogger.trace).toHaveBeenCalledWith('Finding service for service identifier: %s', mockServiceIdentifier);
    });
  });

  describe('get', () => {
    it('should return the service instance if found', () => {
      container.bind(mockServiceIdentifier).toConstantValue(mockService);

      const result = appContainerProvider.get(mockServiceIdentifier);

      expect(result).toEqual(mockService);
      expect(mockLogger.trace).toHaveBeenCalledWith('Get service for service identifier: %s', mockServiceIdentifier);
    });

    it('should throw an error if service is not found', () => {
      expect(() => appContainerProvider.get(mockServiceIdentifier)).toThrowError();
      expect(mockLogger.trace).toHaveBeenCalledWith('Get service for service identifier: %s', mockServiceIdentifier);
    });
  });

  describe('findAll', () => {
    it('should return all instances of the service if found', () => {
      const mockService1 = { name: 'MockService1' };
      const mockService2 = { name: 'MockService2' };
      const mockServiceInstances = [mockService1, mockService2];
      container.bind(mockServiceIdentifier).toConstantValue(mockService1);
      container.bind(mockServiceIdentifier).toConstantValue(mockService2);

      const result = appContainerProvider.findAll(mockServiceIdentifier);

      expect(result).toEqual(mockServiceInstances);
      expect(mockLogger.trace).toHaveBeenCalledWith('Finding service for service identifier: %s', mockServiceIdentifier);
    });

    it('should return an empty array if no instances are found', () => {
      const result = appContainerProvider.findAll(mockServiceIdentifier);

      expect(result).toEqual([]);
      expect(mockLogger.trace).toHaveBeenCalledWith('Finding service for service identifier: %s', mockServiceIdentifier);
    });
  });

  describe('getAll', () => {
    it('should return all instances of the service if found', () => {
      const mockService1 = { name: 'MockService1' };
      const mockService2 = { name: 'MockService2' };
      const mockServiceInstances = [mockService1, mockService2];
      container.bind(mockServiceIdentifier).toConstantValue(mockService1);
      container.bind(mockServiceIdentifier).toConstantValue(mockService2);

      const result = appContainerProvider.getAll(mockServiceIdentifier);

      expect(result).toEqual(mockServiceInstances);
      expect(mockLogger.trace).toHaveBeenCalledWith('Getting all services for service identifier: %s', mockServiceIdentifier);
    });

    it('should return empty array when no instances are found', () => {
      const result = appContainerProvider.getAll(mockServiceIdentifier);
      expect(result).toHaveLength(0);
      expect(mockLogger.trace).toHaveBeenCalledWith('Getting all services for service identifier: %s', mockServiceIdentifier);
    });
  });
});
