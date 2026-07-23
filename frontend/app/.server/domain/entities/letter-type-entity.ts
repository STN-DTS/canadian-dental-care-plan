import type { ReadonlyDeep } from 'type-fest';

export type LetterTypeResponseEntity = ReadonlyDeep<{
  value: LetterTypeEntity[];
}>;

export type LetterTypeEntity = ReadonlyDeep<{
  esdc_value: string;
  esdc_cctlettertypeid: string;
  esdc_portalnameenglish: string;
  esdc_portalnamefrench: string;
  _esdc_parentid_value: string | null;
  esdc_ParentId: {
    esdc_portalnamefrench: string;
    esdc_portalnameenglish: string;
    esdc_cctlettertypeid: string;
  } | null;
}>;
