import { getEnv } from '~/.server/utils/env-utils';

export const postalCodeRegex = /^(?!.*[DFIOQUdfioqu])[A-VXYa-vxy][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]$/i;
export const zipCodeRegex = /^\d{5}$|^\d{5}-?\d{4}$/;

export const isValidPostalCode = (countryCode: string, postalCode: string) => {
  const { CANADA_COUNTRY_ID, USA_COUNTRY_ID } = getEnv();

  switch (countryCode) {
    case CANADA_COUNTRY_ID: {
      return postalCodeRegex.test(postalCode);
    }
    case USA_COUNTRY_ID: {
      return zipCodeRegex.test(postalCode);
    }
    default: {
      return true;
    }
  }
};

export function isValidCanadianPostalCode(provinceCode: string, postalCode: string) {
  const {
    CANADA_COUNTRY_ID,
    ALBERTA_PROVINCE_ID,
    BRITISH_COLUMBIA_PROVINCE_ID,
    MANITOBA_PROVINCE_ID,
    NEW_BRUNSWICK_PROVINCE_ID,
    NOVA_SCOTIA_PROVINCE_ID,
    ONTARIO_PROVINCE_ID,
    QUEBEC_PROVINCE_ID,
    SASKATCHEWAN_PROVINCE_ID,
    NEWFOUNDLAND_PROVINCE_ID,
    PRINCE_EDWARD_ISLAND_PROVINCE_ID,
    NUNAVUT_PROVINCE_ID,
    NORTHWEST_TERRITORIES_PROVINCE_ID,
    YUKON_PROVINCE_ID,
  } = getEnv();
  if (!isValidPostalCode(CANADA_COUNTRY_ID, postalCode)) {
    return false;
  }
  const upperCasePostalCode = postalCode.toUpperCase();
  switch (provinceCode) {
    case BRITISH_COLUMBIA_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('V');
    }
    case ALBERTA_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('T');
    }
    case SASKATCHEWAN_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('S');
    }
    case MANITOBA_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('R');
    }
    case ONTARIO_PROVINCE_ID: {
      return /^[KLNMP]/.test(upperCasePostalCode);
    }
    case QUEBEC_PROVINCE_ID: {
      return /^[GHJ]/.test(upperCasePostalCode);
    }
    case NEW_BRUNSWICK_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('E');
    }
    case NOVA_SCOTIA_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('B');
    }
    case PRINCE_EDWARD_ISLAND_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('C');
    }
    case NEWFOUNDLAND_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('A');
    }
    case YUKON_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('Y');
    }
    case NORTHWEST_TERRITORIES_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('X');
    }
    case NUNAVUT_PROVINCE_ID: {
      return upperCasePostalCode.startsWith('X');
    }
    default: {
      return false;
    }
  }
}

export function formatPostalCode(countryCode: string, postalCode: string) {
  if (!isValidPostalCode(countryCode, postalCode)) {
    throw new Error(`Invalid postal or zip code; countryCode: ${countryCode}, postalCode: ${postalCode}`);
  }

  const { CANADA_COUNTRY_ID, USA_COUNTRY_ID } = getEnv();

  if (countryCode === CANADA_COUNTRY_ID) {
    const sanitizedPostalCode = postalCode.replaceAll(/\s/g, '');
    return `${sanitizedPostalCode.slice(0, 3)} ${sanitizedPostalCode.slice(3)}`.toUpperCase();
  }

  if (countryCode === USA_COUNTRY_ID) {
    const sanitizedPostalCode = postalCode.replaceAll(/\D/g, '');
    return sanitizedPostalCode.length === 9 ? `${sanitizedPostalCode.slice(0, 5)}-${sanitizedPostalCode.slice(5)}` : sanitizedPostalCode;
  }

  return postalCode;
}
