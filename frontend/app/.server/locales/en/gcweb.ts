const ns = {
  meta: {
    author: "Employment and Social Development Canada",
    description: "The Canadian Dental Care Plan (CDCP) will help cover some of the cost of various oral health care services for eligible Canadian residents.",
    siteName: "Canadian Dental Care Plan - Canada.ca",
    subject: "Economics and Industry;Insurance;Dental insurance",
    title: {
      default: "Canadian Dental Care Plan - Canada.ca",
      template: "{{title}} - Canadian Dental Care Plan - Canada.ca",
      mscaTemplate: "{{title}} - Canadian Dental Care Plan - My Service Canada Account - Canada.ca",
    },
  },
  nav: {
    skipToContent: "Skip to main content",
    skipToAbout: "Skip to About this site",
  },
  header: {
    applicationTitle: "Canadian Dental Care Plan",
    applicationTitleMsca: "My Service Canada Account",
    languageSelection: "Language selection",
    govtOfCanadaText: "Government of Canada",
    govtOfCanadaHref: "https://www.canada.ca/en.html",
    menuTitle: "Account",
    menuInboxText: "Inbox",
    menuInboxHref: "{{baseUri}}/en/inbox",
    menuDashboardText: "My dashboard",
    menuDashboardHref: "{{baseUri}}/en/my-dashboard",
    menuMscaHomeHref: "{{baseUri}}/sc/msca-mdsc/portal-portail/pro/home-accueil?Lang=eng",
    menuProfileText: "Profile",
    menuProfileHref: "{{baseUri}}/en/profile",
    menuSecuritySettingsText: "Security Settings",
    menuSecuritySettingsHref: "{{baseUri}}/en/security-settings",
    menuContactUsText: "Contact Us",
    menuContactUsHref: "{{baseUri}}/en/contact-us",
    menuSignOutText: "Sign Out",
    banner: {
      alert: "Alpha",
      desc: "This is a prototype environment. No data is kept.",
    },
  },
  footer: {
    aboutSite: "About this site",
    gcCorporate: "Government of Canada Corporate",
    termsConditions: {
      text: "Terms and conditions",
      publicHref: "https://www.canada.ca/en/transparency/terms.html",
      protectedHref: "{{baseUri}}/TC.aspx?mode=ReadOnly&lang=eng#terms",
    },
    privacy: {
      text: "Privacy",
      publicHref: "https://www.canada.ca/en/transparency/privacy.html",
      protectedHref: "{{baseUri}}/TC.aspx?mode=ReadOnly&lang=eng#privacy",
    },
    gcSymbol: "Symbol of the Government of Canada",
    mainBand: {
      header: {
        public: "Service Canada",
        protected: "My Service Canada Account",
      },
      links: {
        contactUs: {
          content: "Contact us",
          publicHref: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan/contact.html",
          protectedHref: "{{baseUri}}/en/contact-us",
        },
      },
    },
  },
  languageSwitcher: {
    altLang: "Français",
    altLangAbbr: "FR",
    altLangAbbrProp: "fr",
  },
  breadcrumbs: {
    youAreHere: "You are here:",
    home: "My Service Canada Account",
    dashboard: "My dashboard",
    canadaCa: "Canada.ca",
    canadaCaUrl: "https://www.canada.ca/en.html",
    benefits: "Benefits",
    benefitsUrl: "https://www.canada.ca/en/services/benefits.html",
    dentalCoverage: "Dental coverage",
    dentalCoverageUrl: "https://www.canada.ca/en/services/benefits/dental.html",
    canadianDentalCarePlan: "Canadian Dental Care Plan",
    canadianDentalCarePlanUrl: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html",
  },
  pageDetails: {
    pageDetails: "Page details",
    dateModfied: "Date modified:",
    screenId: "Screen identifier:",
    version: "Version:",
  },
  protectedNotFound: {
    documentTitle: "Not found",
    pageTitle: "We couldn't find that web page",
    pageSubtitle: "(Error 404)",
    pageMessage: "We're sorry you ended up here. Sometimes a page gets moved or deleted, but hopefully we can help you find what you're looking for.",
    pageLink: "Return to <dashboard>dashboard</dashboard>",
  },
  publicNotFound: {
    documentTitle: "Not found",
    pageTitle: "We couldn't find that web page",
    pageSubtitle: "(Error 404)",
    pageMessage: "We're sorry you ended up here. Sometimes a page gets moved or deleted, but hopefully we can help you find what you're looking for.",
    unilingualReturnCdcp: "Return to the <cdcpLink>Canadian Dental Care Plan</cdcpLink> home page.",
    returnCdcp: "Return to the <englishCdcpLink>Canadian Dental Care Plan</englishCdcpLink> home page.",
    cdcpLink: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html",
  },
  serverError: {
    documentTitle: "Internal server error",
    pageTitle: "We're having a problem with that page",
    pageSubtitle: "(Error 500)",
    pageMessage: "We expect the problem to be fixed shortly. It's not your computer or Internet connection but a problem with our website's server. What next?",
    option01: "Try refreshing the page or try again later",
    option02: "Return to the <home>home page</home>",
  },
  inputLabel: {
    required: "required",
  },
  inputLegend: {
    required: "required",
  },
  errorSummary: {
    header_one: "The following error was found in the form:",
    header_other: "The following {{count}} errors were found in the form:",
  },
  asteriskIndicatesRequiredField: "An asterisk (*) indicates a required field",
  sessionTimeout: {
    continueSession: "Continue session",
    description: 'Your session will expire automatically in {{timeRemaining}}. Select "Continue Session" to extend your session.',
    endSession: "End session now",
    header: "Session timeout warning",
  },
  dialog: {
    close: "Close",
  },
  datePicker: {
    day: {
      label: "Day (DD)",
    },
    month: {
      label: "Month",
      placeholder: "Select month",
    },
    year: {
      label: "Year (YYYY)",
    },
  },
  screenReader: {
    newTab: "opens in a new tab",
  },
  browserCompatibilityBanner: {
    content:
      "You are using an older browser that is incompatible with this website. Some important features might not work, and you could have trouble completing the form. Try updating your browser to a newer version for a better experience. You may need to update your device or use a different one.",
    contact: "If the issue continues, contact Service Canada by calling <noWrap>1-833-537-4342</noWrap>.",
    dismiss: "Dismiss",
    title: "Update your browser",
  },
} as const;

export default ns;
