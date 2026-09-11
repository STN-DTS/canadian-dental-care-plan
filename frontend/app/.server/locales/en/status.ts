const ns = {
  pageTitle: "Status Checker",
  statusCheckerHeading: "What is the Status Checker?",
  statusCheckerContent: "The Status Checker is a tool that lets you check the status of your Canadian Dental Care Plan application.",
  onlineStatusHeading: "Who can check their application status online?",
  onlineStatusContent: "If you applied for the Canadian Dental Care Plan, you can check your status online.",
  termsConditions: "By using the Status Checker you agree to the following Terms and Conditions of Use and Privacy Notice Statement.",
  statusHeading: "Status",
  emptyStatus: "The information you gave us doesn't match the information in our system.",
  termsOfUse: {
    summary: "Terms and Conditions of Use",
    heading: "Terms of Use for the Canadian Dental Care Plan Status Checker",
    thankYou: 'Thank you for using the Canadian Dental Care Plan (CDCP) Online Status Checker ("the Status Checker"). We have developed important terms and conditions for using this service ("Terms"). Please read them carefully.',
    legalTerms:
      "<strong>PLEASE READ CAREFULLY.</strong> These Terms for the Online Status Checker contain information about your legal rights and obligations and regulate your use of the Status Checker. These Terms should be read in conjunction with the <canadaTermsConditions>Canada.ca website Terms and Conditions</canadaTermsConditions>. In case they are differing, the present Terms take precedence over Canada.ca Terms and Conditions.",
    accessTerms:
      "Your access to and use of the Online Status Checker, including any and all content, is subject to (1) your acceptance of, and (2) your compliance with these Terms. Every time you use the Status Checker, these Terms will apply. By using the Online Status Checker, you agree to abide by the following Terms. It is your responsibility to understand and retain these Terms.",
    maintenance: "There will be times when the system might be down for maintenance.",
    inactive: "If you are inactive for 15 minutes on the Status Checker, your session will end and you will lose any information you entered.",
    termsRejectionPolicy: "At any time you may decide not to accept the Terms, in which case you will not be permitted to access and use the Status Checker.",
    esdcDefinitionClarification: 'In these Terms, "ESDC" refers to the Minister of Employment and Social Development, representing His Majesty the King in Right of Canada.',
    statusChecker: {
      heading: "Terms of Use of the Online Status Checker:",
      selfAgreement: "Using the Status Checker means that you have read and agree to these Terms of Use and the Privacy Notice Statement. If, at any time, you withdraw your agreement to any of the Terms you must stop use of the Online Status Checker.",
      onBehalfOfSomeoneElse:
        "If you are using the Status Checker on behalf of a child, by using the Status Checker, you certify that you have all the necessary authority to agree to the Terms on behalf of that individual, and that you agree to the Terms on behalf of the individual you are representing.",
      atYourOwnRisk:
        "If you are using a shared computer or shared internet connection, you are using this service at your own risk, and you will need to keep any personal information safe. If you are using a public computer make sure to close the browser or log out when you are done.",
      onlyUse: "Only use the Status Checker to check the status of your application to the Canadian Dental Care Plan.",
      msdc: "ESDC uses services from Microsoft Corporation to run the Online Status Checker. The Microsoft data centres used by ESDC are in Canada in accordance with <microsoftServiceAgreement>Microsoft Corporation's Terms of Service Agreement</microsoftServiceAgreement>.",
      antibot: "ESDC uses hCaptcha anti-bot services for our online tools in accordance with hCaptcha's <hcaptchaTermsOfService>Terms of Service</hcaptchaTermsOfService>.",
    },
    changesToTheseTermsOfUse: {
      heading: "Changes to these Terms of Use",
      esdcTermsAmendmentPolicy:
        "ESDC may amend these Terms of Use at any time and without notice. Such changes shall be effective immediately on the date they are published. By using the Status Checker, you agree to abide by the amended Terms. You are responsible to ensure you understand and retain the amended Terms.",
    },
  },
  privacyNoticeStatement: {
    summary: "Privacy Notice Statement",
    collectionOfUse:
      "The collection and use of your personal information is authorized under the <cite>Department of Health Act</cite>, the <cite>Dental Care Measures Act</cite>, the <cite>Department of Employment and Social Development Act</cite>, and other applicable laws.",
    providedInformation: "The provided information will never result in administrative decisions being made about you.",
    thirdPartyProvider:
      "ESDC carries out this application using services from third-party provider Microsoft Corporation, which may be subject to foreign laws. For more information, see <microsoftDataPrivacyPolicy>Microsoft Data Privacy Policy & Privacy Principles</microsoftDataPrivacyPolicy>.",
    personalInformation:
      "Your personal information is administered in accordance with the <cite>Department of Employment and Social Development Act</cite>, <cite>Privacy Act</cite> and other applicable laws. Under the <cite>Privacy Act</cite>, you have the right to the protection of, access to, and where applicable, the correction of your personal information when you believe there is an error or omission.",
    reportAConcern:
      "If you are not satisfied with our response to your privacy, you have the right to file a complaint with the Privacy Commissioner of Canada regarding Service Canada's handling of your personal information at: <fileacomplaint>Report a concern</fileacomplaint>.",
  },
  links: {
    fileComplaint: "https://www.priv.gc.ca/en/report-a-concern/",
    hcaptcha: "https://www.hcaptcha.com/terms",
    microsoftDataPrivacyPolicy: "https://www.microsoft.com/en-ca/trust-center/privacy",
    microsoftServiceAgreement: "https://www.microsoft.com/en-ca/servicesagreement",
    canadaTermsConditions: "https://www.canada.ca/en/transparency/terms.html",
  },
  form: {
    completeFields: "Complete all fields.",
    radioLegend: "Are you checking the status for yourself or for your child?",
    radioText: {
      myself: "I am checking the status for <strong>myself</strong>",
      child: "I am checking the status for <strong>my child</strong>",
    },
    applicationCodeLabel: "Application Code or Client Number",
    applicationCodeDescription: "This code or number is found in the upper right-hand corner of the letter you received from Service Canada",
    sinLabel: "Social Insurance Number (SIN)",
    continue: "Continue",
    submit: "Check status",
    errorMessage: {
      selectionRequired: "Select whether you are checking the status for yourself or your child",
    },
  },
  myself: {
    pageTitle: "Status Checker",
    statusHeading: "Status",
    form: {
      completeFields: "Complete all fields.",
      applicationCodeLabel: "Application Code or Client Number",
      applicationCodeDescription: "Enter the number you received after applying online, or the number found in the upper right-hand corner from the letter you may have received from Service Canada",
      sinLabel: "Social Insurance Number (SIN)",
      sinDescription: "Enter the 9-digit SIN",
      submit: "Check status",
      backBtn: "Back",
      errorMessage: {
        sinRequired: "Enter 9-digit SIN, for example 123 456 789",
        sinValid: "The SIN entered does not exist",
        applicationCodeRequired: "Enter Application Code or Client Number",
        applicationCodeValid: "Must be a valid Application Code or Client Number. Your input must be 6, 11 or 13 digits long.",
      },
    },
  },
  child: {
    pageTitle: "Status Checker",
    statusHeading: "Status",
    form: {
      completeFields: "Complete all fields.",
      applicationCodeLabel: "Application Code or Client Number",
      applicationCodeDescription: "The number you received after applying, or your child's Client Number in the right-hand corner of the CDCP letter they received from Service Canada",
      radioLegend: "Does the child have a Social Insurance Number (SIN)?",
      sinLabel: "Social Insurance Number (SIN)",
      sinDescription: "Enter the 9-digit SIN",
      optionYes: "<strong>Yes</strong>, the child has a SIN",
      optionNo: "<strong>No</strong>, the child does not have a SIN",
      ifChildSummary: "If the child has a single legal name",
      ifChildDesc: "If the child goes by a single legal name, leave the first name field blank",
      lastName: "Child's last name",
      firstName: "Child's first name",
      dateOfBirthLabel: "Child's date of birth",
      submit: "Check status",
      backBtn: "Back",
      errorMessage: {
        radioRequired: "Select whether the child has a SIN",
        sinRequired: "Enter 9-digit SIN, for example 123 456 789",
        sinValid: "The SIN entered does not exist",
        applicationCodeRequired: "Enter Application Code or Client Number",
        applicationCodeValid: "Must be a valid Application Code or Client Number. Your input must be 6, 11 or 13 digits long.",
        firstNameTooLong: "First name too long",
        lastNameRequired: "Enter last name",
        dateOfBirthDayNumber: "Day must be a number",
        dateOfBirthDayRequired: "Date of birth must include a day",
        dateOfBirthIsPast: "Date of birth must be in the past",
        dateOfBirthIsPastValid: "Date of birth too far in the past",
        dateOfBirthMonthRequired: "Date of birth must include a month",
        dateOfBirthValid: "Day must be valid for the given month and year",
        dateOfBirthYearNumber: "Year must be a number, for example 1950",
        dateOfBirthYearRequired: "Date of birth must include a year",
        charactersValid: "Only letters, numbers and the following characters are accepted: apostrophe ('), comma (,), period (.), hyphen (-) and bracket ()",
      },
    },
  },
  result: {
    pageTitle: "Status Checker",
    statusHeading: "Status",
    checkAnother: "Check another status",
    exitBtn: "Exit status checker",
    exitLink: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan/apply.html#status",
    statusNotFound: {
      heading: "We could not find your application status with the information you gave us.",
      pleaseReview: "Please make sure the information you entered is correct. If you applied recently, try again in 48 hours.",
      ifSubmitted: "If you have submitted more than one application for yourself, your children, or both, use the last application code you received.",
      contactServiceCanada: "Contact Service Canada if this issue continues by calling <noWrap>1-833-537-4342</noWrap>.",
    },
  },
} as const;

export default ns;
