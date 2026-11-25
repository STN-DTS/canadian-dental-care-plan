import { inject, injectable } from 'inversify';

import type { ClientConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_BUILD_DATE, ATTR_CDCP_BUILD_ID, ATTR_CDCP_BUILD_REVISION, ATTR_CDCP_BUILD_VERSION } from '~/.server/logging/log-attributes';
import { createMemoized } from '~/.server/utils/memoize-utils';
import type { MemoizedFunction } from '~/.server/utils/memoize-utils';

export interface BuildInfo {
  buildDate: string;
  buildId: string;
  buildRevision: string;
  buildVersion: string;
}

export interface BuildInfoService {
  getBuildInfo(): BuildInfo;
}

type DefaultBuildInfoService_ClientConfig = Pick<ClientConfig, 'BUILD_DATE' | 'BUILD_ID' | 'BUILD_REVISION' | 'BUILD_VERSION'>;

@injectable()
export class DefaultBuildInfoService implements BuildInfoService {
  private readonly log: Logger;

  private readonly clientConfig: DefaultBuildInfoService_ClientConfig;

  constructor(@inject(TYPES.ClientConfig) clientConfig: DefaultBuildInfoService_ClientConfig) {
    this.log = createLogger('DefaultBuildInfoService');
    this.clientConfig = clientConfig;
    this.init();
  }

  private init(): void {
    this.getBuildInfo = createMemoized(this.getBuildInfo, { maxSize: 1 });

    type MemoizedGetBuildInfo = MemoizedFunction<typeof this.getBuildInfo>;
    (this.getBuildInfo as MemoizedGetBuildInfo).cache.on('add', () => {
      this.log.info('Creating new getBuildInfo memo');
    });

    this.log.debug('DefaultBuildInfoService initiated.');
  }

  getBuildInfo(): BuildInfo {
    this.log.debug('Getting application build info');

    const buildInfo: BuildInfo = {
      buildDate: this.clientConfig.BUILD_DATE,
      buildId: this.clientConfig.BUILD_ID,
      buildRevision: this.clientConfig.BUILD_REVISION,
      buildVersion: this.clientConfig.BUILD_VERSION,
    };

    this.log.debug('Application build info retrieved', {
      [ATTR_CDCP_BUILD_DATE]: buildInfo.buildDate,
      [ATTR_CDCP_BUILD_ID]: buildInfo.buildId,
      [ATTR_CDCP_BUILD_REVISION]: buildInfo.buildRevision,
      [ATTR_CDCP_BUILD_VERSION]: buildInfo.buildVersion,
    });
    return buildInfo;
  }
}
