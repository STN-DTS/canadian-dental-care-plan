import type { ReadonlyDeep } from 'type-fest';

/**
 * Raw response entity for a single client returned by the `appeal-upload-eligible` service.
 *
 * Corresponds to:
 *   esdc_clients(esdc_clientnumber='{ClientNumber}')
 *     ?$select=esdc_clientid,esdc_clientnumber,esdc_applicanttype,esdc_socialinsurancenumber,statecode,statuscode,esdc_suspendedon
 *     &$expand=esdc_esdc_dentalapplicant_Clientid_esdc_client(esdc_dentalapplicantid,_esdc_dentalapplicationid_value,_esdc_pendingstatusid_value)
 */
export type AppealUploadEligibilityResponseEntity = ReadonlyDeep<{
  esdc_applicanttype: number;
  esdc_clientid: string;
  esdc_clientnumber: string;
  /**
   * Represents a list of the client profile's applications that are paused due to a T4 mismatch.
   * A non-empty array means the client is eligible to upload evidentiary documentation.
   */
  esdc_esdc_dentalapplicant_Clientid_esdc_client: Array<{
    _esdc_dentalapplicationid_value: string;
    _esdc_pendingstatusid_value: null | number;
    esdc_dentalapplicantid: string;
  }>;
  esdc_socialinsurancenumber: string;
  esdc_suspendedon: null | string;
  /**
   * Dynamics 365 standard state code:
   * 0 = Active
   * 1 = Inactive
   */
  statecode: number;
  statuscode: number;
}>;
