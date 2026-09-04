import { invariant } from '@dts-stn/invariant';
import { inject, injectable } from 'inversify';
import type { Option } from 'oxide.ts';
import { None, Some } from 'oxide.ts';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ApplicantResponseEntity, FindApplicantByBasicInfoRequestEntity, FindApplicantBySinRequestEntity } from '~/.server/domain/entities';
import type { HttpClient } from '~/.server/http';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

/**
 * A repository that provides access to applicant data.
 */
export interface ApplicantRepository {
  /**
   * Finds an applicant by basic info.
   *
   * @param request The basic info request entity.
   * @returns A Promise that resolves to the applicant entity if found, or `None` otherwise.
   */
  findApplicantByBasicInfo(request: FindApplicantByBasicInfoRequestEntity): Promise<Option<ApplicantResponseEntity>>;

  /**
   * Finds an applicant by SIN.
   *
   * @param request The SIN request entity.
   * @returns A Promise that resolves to the applicant entity if found, or `None` otherwise.
   */
  findApplicantBySin(request: FindApplicantBySinRequestEntity): Promise<Option<ApplicantResponseEntity>>;

  /**
   * Retrieves metadata associated with the applicant repository.
   *
   * @returns A record where the keys and values are strings representing metadata information.
   */
  getMetadata(): Record<string, string>;

  /**
   * Performs a health check to ensure that the applicant repository is operational.
   *
   * @throws An error if the health check fails or the repository is unavailable.
   * @returns A promise that resolves when the health check completes successfully.
   */
  checkHealth(): Promise<void>;
}

@injectable()
export class DefaultApplicantRepository implements ApplicantRepository {
  private readonly log: Logger;
  private readonly serverConfig: Pick<
    ServerConfig,
    'HEALTH_PLACEHOLDER_REQUEST_VALUE' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_APPLICANT_API_BASE_URI' | 'INTEROP_APPLICANT_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
  >;
  private readonly httpClient: HttpClient;
  private readonly baseUrl: string;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<
      ServerConfig,
      'HEALTH_PLACEHOLDER_REQUEST_VALUE' | 'HTTP_PROXY_URL' | 'INTEROP_API_BASE_URI' | 'INTEROP_API_SUBSCRIPTION_KEY' | 'INTEROP_APPLICANT_API_BASE_URI' | 'INTEROP_APPLICANT_API_SUBSCRIPTION_KEY' | 'INTEROP_API_MAX_RETRIES' | 'INTEROP_API_BACKOFF_MS'
    >,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultApplicantRepository');
    this.serverConfig = serverConfig;
    this.httpClient = httpClient;
    this.baseUrl = `${this.serverConfig.INTEROP_APPLICANT_API_BASE_URI ?? this.serverConfig.INTEROP_API_BASE_URI}/dental-care/applicant-information/dts/v1`;
  }

  async findApplicantByBasicInfo(request: FindApplicantByBasicInfoRequestEntity): Promise<Option<ApplicantResponseEntity>> {
    this.log.trace('Fetching applicant by basic info [%j]', request);

    const url = `${this.baseUrl}/applicant`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.applicant_by-basic-info.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_APPLICANT_API_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(request),
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_GATEWAY]: [],
        },
      },
    });

    if (response.status === 200) {
      const applicantResponseEntity = (await response.json()) as ApplicantResponseEntity;
      this.log.trace('Returning applicant [%j]', applicantResponseEntity);
      return Some(applicantResponseEntity);
    }

    if (response.status === 204) {
      this.log.trace('No applicant found; Returning None');
      return None;
    }

    this.log.error('%j', {
      message: "'Failed to 'POST' for applicant.",
      status: response.status,
      statusText: response.statusText,
      url: url,
      responseBody: await response.text(),
    });

    if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
      // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
      throw new AppError('Failed to POST to /applicant. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
    }

    throw new Error(`Failed to 'POST' for applicant. Status:  ${response.status}, Status Text: ${response.statusText}`);
  }

  async findApplicantBySin(request: FindApplicantBySinRequestEntity): Promise<Option<ApplicantResponseEntity>> {
    this.log.trace('Fetching applicant by SIN [%j]', request);

    const url = `${this.baseUrl}/applicant`;
    const response = await this.httpClient.instrumentedFetch('http.client.interop-api.applicant_by-sin.posts', url, {
      proxyUrl: this.serverConfig.HTTP_PROXY_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.serverConfig.INTEROP_APPLICANT_API_SUBSCRIPTION_KEY ?? this.serverConfig.INTEROP_API_SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(request),
      retryOptions: {
        retries: this.serverConfig.INTEROP_API_MAX_RETRIES,
        backoffMs: this.serverConfig.INTEROP_API_BACKOFF_MS,
        retryConditions: {
          [HttpStatusCodes.BAD_GATEWAY]: [],
        },
      },
    });

    if (response.status === 200) {
      const applicantResponseEntity = (await response.json()) as ApplicantResponseEntity;
      this.log.trace('Returning applicant [%j]', applicantResponseEntity);
      return Some(applicantResponseEntity);
    }

    if (response.status === 204) {
      this.log.trace('No applicant found; Returning None');
      return None;
    }

    this.log.error('%j', {
      message: "'Failed to 'POST' for applicant.",
      status: response.status,
      statusText: response.statusText,
      url: url,
      responseBody: await response.text(),
    });

    if (response.status === HttpStatusCodes.TOO_MANY_REQUESTS) {
      // TODO ::: GjB ::: this throw is to facilitate enabling the application kill switch -- it should be removed once the killswitch functionality is removed
      throw new AppError('Failed to POST to /applicant. Status: 429, Status Text: Too Many Requests', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
    }

    throw new Error(`Failed to 'POST' for applicant. Status:  ${response.status}, Status Text: ${response.statusText}`);
  }

  getMetadata(): Record<string, string> {
    return {
      baseUrl: this.baseUrl,
    };
  }

  async checkHealth(): Promise<void> {
    await this.findApplicantBySin({
      Applicant: {
        PersonSINIdentification: {
          IdentificationID: this.serverConfig.HEALTH_PLACEHOLDER_REQUEST_VALUE,
        },
      },
    });
  }
}

@injectable()
export class MockApplicantRepository implements ApplicantRepository {
  private readonly log: Logger;

  private readonly mockApplicantDb = [
    {
      mailingAddressStreet: '2219 Waste Lane',
      mailingAddressSecondaryUnitText: 'Apt. No. 21',
      mailingAddressCityName: 'HALIFAX',
      mailingAddressProvince: 'fc2243c9-36b3-eb11-8236-0022486d8d5f',
      mailingAddressCountryReferenceId: '0cf5389e-97ae-eb11-8236-000d3af4bfc3',
      mailingAddressPostalCode: 'B0C 0A1',
      homeAddressStreet: '1191 Windy Street',
      homeAddressSecondaryUnitText: 'Apt. No. 50',
      homeAddressCityName: 'OTTAWA',
      homeAddressProvince: '9c440baa-35b3-eb11-8236-0022486d8d5f',
      homeAddressCountryReferenceId: '0cf5389e-97ae-eb11-8236-000d3af4bfc3',
      homeAddressPostalCode: 'L9B 1A2',
      sameHomeAndMailingAddress: false,
      clientNumber: '81657965177',
      clientId: '17cdea07-2f83-ee11-8179-000d3a09d7c5',
      applicantId: '4635f70b-2f83-ee11-8179-000d3a09d136',
      applicantCategoryCode: '775170000',
      birthdate: '1997-09-01',
      lastName: 'Eliot',
      firstName: 'Thomas Stearns',
      emailAddressId: 'rhapsody@domain.ca',
      primaryTelephoneNumber: '807-555-5555',
      alternateTelephoneNumber: '416-555-6666',
      preferredMethodCommunicationCode: '775170001',
      preferredMethodCommunicationGCCode: '775170000',
      federalDentalPlanId: 'e174250d-26c5-ee11-9079-000d3a09d640',
      provincialTerritorialDentalPlanId: 'b5f25fea-a7a9-ee11-a569-000d3af4f898',
      privateDentalPlanId: '333333',
      sinIdentification: '800011819',
      maritalStatusCode: '775170001',
      preferredLanguage: '1033',
    },
    {
      mailingAddressStreet: '1915 Verwandlung Street',
      mailingAddressSecondaryUnitText: 'Apt. No. 21',
      mailingAddressCityName: 'Victoria',
      mailingAddressProvince: '9c440baa-35b3-eb11-8236-0022486d8d5f',
      mailingAddressCountryReferenceId: '0cf5389e-97ae-eb11-8236-000d3af4bfc3',
      mailingAddressPostalCode: 'V1M 1M1',
      homeAddressStreet: '1915 Verwandlung Lane',
      homeAddressSecondaryUnitText: 'Apt. No. 21',
      homeAddressCityName: 'Victoria',
      homeAddressProvince: '9c440baa-35b3-eb11-8236-0022486d8d5f',
      homeAddressCountryReferenceId: '0cf5389e-97ae-eb11-8236-000d3af4bfc3',
      homeAddressPostalCode: 'V1M 1M1',
      sameHomeAndMailingAddress: true,
      clientNumber: '81400774242',
      clientId: '17cdea07-2f83-ee11-8179-000d3a09d7c4',
      applicantId: '4635f70b-2f83-ee11-8179-000d3a09d131',
      applicantCategoryCode: '775170000',
      birthdate: '1924-07-03',
      lastName: 'Kafka',
      firstName: 'Franz',
      emailAddressId: 'metamorphosis0@domain.ca',
      primaryTelephoneNumber: '555-555-5555',
      alternateTelephoneNumber: '789-555-6666',
      preferredMethodCommunicationCode: '775170001',
      preferredMethodCommunicationGCCode: '775170000',
      federalDentalPlanId: '5a5c5294-26c5-ee11-9079-000d3a09d640',
      provincialTerritorialDentalPlanId: '39449f70-37b3-eb11-8236-0022486d8d5f',
      privateDentalPlanId: '1111111',
      sinIdentification: '800000002',
      maritalStatusCode: '775170001',
      preferredLanguage: '1033',
    },
    {
      mailingAddressStreet: '123 Main Street',
      mailingAddressSecondaryUnitText: 'Suite 100',
      mailingAddressCityName: 'Toronto',
      mailingAddressProvince: '9c440baa-35b3-eb11-8236-0022486d8d5f',
      mailingAddressCountryReferenceId: '0cf5389e-97ae-eb11-8236-000d3af4bfc3',
      mailingAddressPostalCode: 'M5H 2N2',
      homeAddressStreet: '456 Oak Avenue',
      homeAddressSecondaryUnitText: 'Unit 5',
      homeAddressCityName: 'Toronto',
      homeAddressProvince: '9c440baa-35b3-eb11-8236-0022486d8d5f',
      homeAddressCountryReferenceId: '0cf5389e-97ae-eb11-8236-000d3af4bfc3',
      homeAddressPostalCode: 'M5V 3A8',
      sameHomeAndMailingAddress: false,
      clientNumber: '81234567890',
      clientId: '17cdea07-2f83-ee11-8179-000d3a09d7c6',
      applicantId: '4635f70b-2f83-ee11-8179-000d3a09d137',
      applicantCategoryCode: '775170000',
      birthdate: '1985-05-15',
      lastName: 'Smith',
      firstName: 'John',
      emailAddressId: 'john.smith@domain.ca',
      primaryTelephoneNumber: '416-555-1234',
      alternateTelephoneNumber: '647-555-5678',
      preferredMethodCommunicationCode: '775170001',
      preferredMethodCommunicationGCCode: '775170000',
      federalDentalPlanId: 'a1b2c3d4-26c5-ee11-9079-000d3a09d640',
      provincialTerritorialDentalPlanId: 'e5f6g7h8-a7a9-ee11-a569-000d3af4f898',
      privateDentalPlanId: '4444444',
      sinIdentification: '800000408',
      maritalStatusCode: '775170000',
      preferredLanguage: '1033',
    },
  ];

  constructor() {
    this.log = createLogger('MockApplicantRepository');
  }

  async findApplicantByBasicInfo(request: FindApplicantByBasicInfoRequestEntity): Promise<Option<ApplicantResponseEntity>> {
    this.log.debug('Fetching applicant by basic info [%j]', request);

    const reqClientNumber = request.Applicant.ClientIdentification[0]?.IdentificationID;
    invariant(reqClientNumber, 'Client number must be defined');
    const reqFirstName = request.Applicant.PersonName.PersonGivenName[0];
    invariant(reqFirstName, 'First name must be defined');
    const reqLastName = request.Applicant.PersonName.PersonSurName;
    const reqBirthDate = request.Applicant.PersonBirthDate.date;

    const applicantEntity = this.mockApplicantDb.find(
      ({ clientNumber, birthdate, lastName, firstName }) =>
        clientNumber === reqClientNumber && //
        lastName.localeCompare(reqLastName, undefined, { sensitivity: 'base' }) === 0 &&
        firstName.localeCompare(reqFirstName, undefined, { sensitivity: 'base' }) === 0 &&
        birthdate === reqBirthDate,
    );

    if (!applicantEntity) {
      this.log.debug('No applicant found; Returning None');
      return await Promise.resolve(None);
    }

    const applicantResponseEntity = this.mapToApplicantResponseEntity(applicantEntity);
    this.log.debug('Returning applicant [%j]', applicantResponseEntity);
    return await Promise.resolve(Some(applicantResponseEntity));
  }

  async findApplicantBySin(applicantRequestEntity: FindApplicantBySinRequestEntity): Promise<Option<ApplicantResponseEntity>> {
    this.log.debug('Fetching applicant by SIN [%j]', applicantRequestEntity);

    const sin = applicantRequestEntity.Applicant.PersonSINIdentification.IdentificationID;
    const applicantEntity = this.mockApplicantDb.find(({ sinIdentification }) => sinIdentification === sin);

    if (!applicantEntity) {
      this.log.debug('No applicant found; Returning None');
      return await Promise.resolve(None);
    }

    const applicantResponseEntity = this.mapToApplicantResponseEntity(applicantEntity);
    this.log.debug('Returning applicant [%j]', applicantResponseEntity);
    return await Promise.resolve(Some(applicantResponseEntity));
  }

  mapToApplicantResponseEntity(applicantEntity: (typeof this.mockApplicantDb)[number]): ApplicantResponseEntity {
    const clientIdentification: { IdentificationID: string; IdentificationCategoryText: 'Client ID' | 'Client Number' }[] = [];

    if (applicantEntity.clientNumber) {
      clientIdentification.push({ IdentificationID: applicantEntity.clientNumber, IdentificationCategoryText: 'Client Number' });
    }

    if (applicantEntity.clientId) {
      clientIdentification.push({ IdentificationID: applicantEntity.clientId, IdentificationCategoryText: 'Client ID' });
    }

    return {
      BenefitApplication: {
        Applicant: {
          ApplicantCategoryCode: {
            ReferenceDataID: applicantEntity.applicantCategoryCode,
          },
          ClientIdentification: clientIdentification,
          PersonBirthDate: {
            date: applicantEntity.birthdate,
          },
          PersonContactInformation: [
            {
              Address: [
                {
                  AddressCategoryCode: { ReferenceDataName: 'Mailing' },
                  AddressStreet: { StreetName: applicantEntity.mailingAddressStreet },
                  AddressSecondaryUnitText: applicantEntity.mailingAddressSecondaryUnitText,
                  AddressCityName: applicantEntity.mailingAddressCityName,
                  AddressProvince: { ProvinceCode: { ReferenceDataID: applicantEntity.mailingAddressProvince } },
                  AddressCountry: { CountryCode: { ReferenceDataID: applicantEntity.mailingAddressCountryReferenceId } },
                  AddressPostalCode: applicantEntity.mailingAddressPostalCode,
                },
                {
                  AddressCategoryCode: { ReferenceDataName: 'Home' },
                  AddressStreet: { StreetName: applicantEntity.homeAddressStreet },
                  AddressSecondaryUnitText: applicantEntity.homeAddressSecondaryUnitText,
                  AddressCityName: applicantEntity.homeAddressCityName,
                  AddressProvince: { ProvinceCode: { ReferenceDataID: applicantEntity.homeAddressProvince } },
                  AddressCountry: { CountryCode: { ReferenceDataID: applicantEntity.homeAddressCountryReferenceId } },
                  AddressPostalCode: applicantEntity.homeAddressPostalCode,
                },
              ],
              EmailAddress: [{ EmailAddressID: applicantEntity.emailAddressId }],
              TelephoneNumber: [
                {
                  FullTelephoneNumber: { TelephoneNumberFullID: applicantEntity.primaryTelephoneNumber },
                  TelephoneNumberCategoryCode: { ReferenceDataName: 'Primary' },
                },
                {
                  FullTelephoneNumber: { TelephoneNumberFullID: applicantEntity.alternateTelephoneNumber },
                  TelephoneNumberCategoryCode: { ReferenceDataName: 'Alternate' },
                },
              ],
            },
          ],

          PersonMaritalStatus: {
            StatusCode: {
              ReferenceDataID: applicantEntity.maritalStatusCode,
            },
          },
          PersonName: [
            {
              PersonGivenName: [applicantEntity.firstName],
              PersonSurName: applicantEntity.lastName,
            },
          ],
          PersonSINIdentification: {
            IdentificationID: applicantEntity.sinIdentification,
          },
          PersonLanguage: [
            {
              CommunicationCategoryCode: {
                ReferenceDataID: applicantEntity.preferredLanguage,
              },
              PreferredIndicator: true,
            },
          ],
          PreferredMethodCommunicationCode: {
            ReferenceDataID: applicantEntity.preferredMethodCommunicationCode,
          },
          PreferredMethodCommunicationGCCode: {
            ReferenceDataID: applicantEntity.preferredMethodCommunicationGCCode,
          },
        },
      },
    };
  }

  getMetadata(): Record<string, string> {
    return {
      mockEnabled: 'true',
    };
  }

  async checkHealth(): Promise<void> {
    return await Promise.resolve();
  }
}
