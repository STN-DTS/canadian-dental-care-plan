const ns = {
  address: {
    countryChangedAnnouncement: "The address form has been updated for {{country}}.",
    provinceFieldRequiredAnnouncement: "The province, territory, state, or region field is now required.",
    provinceFieldNotRequiredAnnouncement: "The province, territory, state, or region field is not required for the selected country.",
    postalCodeRequiredAnnouncement: "The postal code or ZIP field is now required.",
    postalCodeOptionalAnnouncement: "The postal code or ZIP field is now optional.",
  },
  dialog: {
    addressSuggestion: {
      addressSelectionLegend: "Please select an address option below:",
      cancelButton: "Back",
      description: "There's a problem with the address you provided. Select the address you want to use. If you live in an apartment or suite, make sure to include that information.",
      enteredAddressOption: "Entered address",
      header: "Confirm your address",
      suggestedAddressOption: "Suggested address",
      useSelectedAddressButton: "Use selected address",
    },
    addressInvalid: {
      closeButton: "Back",
      description: "We couldn't confirm your address. Please check it again and make sure to <strong>include your apartment or suite number</strong>, if you have one.",
      important: "It is important that your address is correct. If we are not able to contact you by mail you may experience a delay in receiving benefits.",
      enteredAddress: "Entered address",
      header: "Address not found",
      continueButton: "Continue",
      checkbox: "I confirm that the address I entered is correct.",
      context: {
        homeAddress: "Home address",
        mailingAddress: "Mailing address",
      },
    },
  },
  errorMessage: {
    mailing: {
      addressRequired: "Enter mailing address, typically number and street",
      charactersValid: "Only letters, numbers and the following characters are accepted: apostrophe ('), comma (,), period (.), hyphen (-) and bracket ()",
      cityRequired: "Enter a city or town for your mailing address",
      countryRequired: "Select a country for your mailing address",
      invalidPostalZipCodeForCountry: "A Canadian postal code in the mailing address was entered but Canada was not selected as the country. Please select Canada, and the proper province, or change the postal code",
      invalidPostalZipCodeForProvince: "The postal code does not match the province or territory you selected",
      postalZipCodeRequired: "Enter postal code or zip code for your mailing address",
      postalZipCodeValid: "Enter mailing address postal code in the correct format, such as A1A 1A1. Letters D, F, I, O, Q, or U can not be used.",
      provinceStateRequired: "Select a province, territory, state or region for your mailing address",
      zipCodeValid: "Enter mailing address zip code in the correct format, such as 12345 or 12345-6789",
    },
    home: {
      addressRequired: "Enter home address, typically number and street",
      charactersValid: "Only letters, numbers and the following characters are accepted: apostrophe ('), comma (,), period (.), hyphen (-) and bracket ()",
      cityRequired: "Enter a city or town for your home address",
      countryRequired: "Select a country for your home address",
      invalidPostalZipCodeForCountry: "A Canadian postal code in the home address was entered but Canada was not selected as the country. Please select Canada, and the proper province, or change the postal code",
      invalidPostalZipCodeForProvince: "The postal code does not match the province or territory you selected",
      postalZipCodeRequired: "Enter postal code or zip code for your home address",
      postalZipCodeValid: "Enter home address postal code in the correct format, such as A1A 1A1. Letters D, F, I, O, Q, or U can not be used.",
      provinceStateRequired: "Select a province, territory, state or region for your home address",
      zipCodeValid: "Enter home address zip code in the correct format, such as 12345 or 12345-6789",
    },
  },
  killswitch: {
    title: "Please hold on",
    overloaded: "We're getting a lot of visitors right now, which is slowing things down. You will be able to continue when the timer reaches zero.",
    dontWorryBeHappy: "Don't worry\u2014your information is saved. Do not close your browser, or you will have to start the application over again.",
    remainingTime: "Continuing to application in: {{mins}} min {{secs}} sec",
  },
  status: {
    complete: "Complete",
    error: "Error",
    new: "New",
    optional: "Optional",
  },
  navigation: {
    previous: "Previous",
    next: "Next",
  },
  eligibility: {
    eligible: {
      title: "You are eligible",
      description: "Continue to use your benefits but be aware of any changes in your coverage level.",
      instructions: "You can confirm your coverage level on the invitation to renew letter sent by Service Canada. This letter can also be viewed in <mscaLink>My Service Canada Account (MSCA)</mscaLink>. No further communication will be sent.",
    },
    ineligible: {
      title: "You are ineligible",
      description: "We'll send you a letter to confirm this decision. The letter will include the date of your last day of coverage. Dental services after that date will not be covered or paid back.",
    },
    eligibleProof: {
      title: "You are eligible - Proof may be required",
      description:
        "One or more of your 2025 T4 or T4A documents shows that you have access to private dental insurance, as of December 31, 2025. We may ask you to provide proof that you do not have access to private dental insurance or coverage. We'll contact you again if this is the case.",
      continue: "If you do not have access to private dental insurance or coverage, continue to use your benefits but be aware of any changes in your coverage level.",
      instructions: "You can confirm your coverage level on the invitation to renew letter sent by Service Canada. This letter can also be viewed in <mscaLink>My Service Canada Account (MSCA)</mscaLink>. No further communication will be sent.",
    },
    mscaLink: "https://www.canada.ca/en/employment-social-development/services/my-account.html",
  },
  stepper: {
    status: {
      completed: "\u0020completed",
      upcoming: "\u0020not completed",
    },
  },
  sectionsCompleted_one: "{{number}} out of {{count}} section completed",
  sectionsCompleted_other: "{{number}} out of {{count}} sections completed",
} as const;

export default ns;
