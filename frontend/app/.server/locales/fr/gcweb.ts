const ns = {
  meta: {
    author: "Emploi et Développement social Canada",
    description: "Le Régime canadien de soins dentaires (RCSD) permet de couvrir une partie du coût de divers services de santé buccodentaire pour les résidents canadiens éligibles.",
    siteName: "Régime canadien de soins dentaires - Canada.ca",
    subject: "Économie et industrie;Assurance;Assurance dentaire",
    title: {
      default: "Régime canadien de soins dentaires - Canada.ca",
      template: "{{title}} - Régime canadien de soins dentaires - Canada.ca",
      mscaTemplate: "{{title}} - Mon dossier Service Canada - Régime canadien de soins dentaires - Canada.ca",
    },
  },
  nav: {
    skipToContent: "Passer au contenu principal",
    skipToAbout: "Passer à « À propos de ce site »",
  },
  header: {
    applicationTitle: "Régime canadien de soins dentaires",
    applicationTitleMsca: "Mon dossier Service Canada",
    languageSelection: "Sélection de la langue",
    govtOfCanadaText: "Gouvernement du Canada",
    govtOfCanadaHref: "https://www.canada.ca/fr.html",
    menuTitle: "Compte",
    menuInboxText: "Boîte de réception",
    menuInboxHref: "{{baseUri}}/fr/boite-reception",
    menuDashboardText: "Mon tableau de bord",
    menuDashboardHref: "{{baseUri}}/fr/mon-tableau-de-bord",
    menuMscaHomeHref: "{{baseUri}}/sc/msca-mdsc/portal-portail/pro/home-accueil?Lang=fra",
    menuProfileText: "Profil",
    menuProfileHref: "{{baseUri}}/fr/profil",
    menuSecuritySettingsText: "Paramètres de sécurité",
    menuSecuritySettingsHref: "{{baseUri}}/fr/parametres-securite",
    menuContactUsText: "Contactez-nous",
    menuContactUsHref: "{{baseUri}}/fr/contactez-nous",
    menuSignOutText: "Se déconnecter",
    banner: {
      alert: "Alpha",
      desc: "Il s'agit d'un environnement prototype. Aucune donnée n'est conservée.",
    },
  },
  footer: {
    aboutSite: "À propos de ce site",
    gcCorporate: "Organisation du gouvernement du Canada",
    termsConditions: {
      text: "Avis",
      publicHref: "https://www.canada.ca/fr/transparence/avis.html",
      protectedHref: "{{baseUri}}/TC.aspx?mode=ReadOnly&lang=fra#terms",
    },
    privacy: {
      text: "Confidentialité",
      publicHref: "https://www.canada.ca/fr/transparence/confidentialite.html",
      protectedHref: "{{baseUri}}/TC.aspx?mode=ReadOnly&lang=fra#privacy",
    },
    gcSymbol: "Symbole du gouvernement du Canada",
    mainBand: {
      header: {
        public: "Service Canada",
        protected: "Mon dossier Service Canada",
      },
      links: {
        contactUs: {
          content: "Contactez-nous",
          publicHref: "https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires/contactez.html",
          protectedHref: "{{baseUri}}/fr/contactez-nous",
        },
      },
    },
  },
  languageSwitcher: {
    altLang: "English",
    altLangAbbr: "EN",
    altLangAbbrProp: "en",
  },
  breadcrumbs: {
    youAreHere: "Vous êtes ici\u00A0:",
    home: "Mon dossier Service Canada",
    dashboard: "Mon tableau de bord",
    canadaCa: "Canada.ca",
    canadaCaUrl: "https://www.canada.ca/fr.html",
    benefits: "Prestations",
    benefitsUrl: "https://www.canada.ca/fr/services/prestations.html",
    dentalCoverage: "Couverture dentaire",
    dentalCoverageUrl: "https://www.canada.ca/fr/services/prestations/dentaire.html",
    canadianDentalCarePlan: "Régime canadien de soins dentaires",
    canadianDentalCarePlanUrl: "https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires.html",
  },
  pageDetails: {
    pageDetails: "Détails de la page",
    dateModfied: "Date de modification\u00A0:",
    screenId: "Identificateur d'écran\u00A0:",
    version: "Version\u00A0:",
  },
  protectedNotFound: {
    documentTitle: "Page introuvable",
    pageTitle: "Nous ne pouvons trouver cette page",
    pageSubtitle: "(Erreur 404)",
    pageMessage: "Nous sommes désolés que vous ayez abouti ici. Il arrive parfois qu'une page ait été déplacée ou supprimée. Heureusement, nous pouvons vous aider à trouver ce que vous cherchez.",
    pageLink: "Retour au <dashboard>tableau de bord</dashboard>",
  },
  publicNotFound: {
    documentTitle: "Page introuvable",
    pageTitle: "Nous ne pouvons trouver cette page",
    pageSubtitle: "(Erreur 404)",
    pageMessage: "Nous sommes désolés que vous ayez abouti ici. Il arrive parfois qu'une page ait été déplacée ou supprimée. Heureusement, nous pouvons vous aider à trouver ce que vous cherchez.",
    unilingualReturnCdcp: "Retournez à la page d'accueil du <cdcpLink>Régime canadien de soins dentaires</cdcpLink>.",
    returnCdcp: "Retournez à la page d'accueil du <frenchCdcpLink>Régime canadien de soins dentaires</frenchCdcpLink>.",
    cdcpLink: "https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires.html",
  },
  serverError: {
    documentTitle: "Erreur interne du serveur",
    pageTitle: "Nous éprouvons des difficultés avec cette page",
    pageSubtitle: "(Erreur 500)",
    pageMessage: "Nous espérons résoudre le problème sous peu. Il ne s'agit pas d'un problème avec votre ordinateur ou Internet, mais plutôt avec le serveur de notre site Web. Que faire?",
    option01: "Actualisez la page ou réessayez plus tard",
    option02: "Retournez à la <home>page d'accueil</home>",
  },
  inputLabel: {
    required: "requis",
  },
  inputLegend: {
    required: "requis",
  },
  errorSummary: {
    header_one: "L'erreur suivante a été trouvée dans le formulaire\u00A0:",
    header_other: "Les {{count}} erreurs suivantes ont été trouvées dans le formulaire\u00A0:",
  },
  asteriskIndicatesRequiredField: "Un astérisque (*) indique un champ requis",
  sessionTimeout: {
    continueSession: "Continuer la session",
    description: "Votre session expirera automatiquement dans {{timeRemaining}}. Sélectionnez «\u00A0Continuer la session\u00A0» pour prolonger votre session.",
    endSession: "Mettre fin à la session",
    header: "Avertissement d'expiration de la session",
  },
  dialog: {
    close: "Fermer",
  },
  datePicker: {
    day: {
      label: "Jour (JJ)",
    },
    month: {
      label: "Mois",
      placeholder: "Sélectionnez le mois",
    },
    year: {
      label: "Année (AAAA)",
    },
  },
  screenReader: {
    newTab: "s'ouvre dans un nouvel onglet",
  },
  browserCompatibilityBanner: {
    content:
      "Vous utilisez un navigateur plus ancien qui n'est pas compatible avec ce site Web. Certaines fonctions importantes pourraient ne pas fonctionner correctement et il se peut que vous ayez de la difficulté à remplir le formulaire. Pour améliorer votre expérience, nous vous recommandons de mettre à jour votre navigateur vers une version plus récente. Il est possible que vous deviez mettre à jour votre appareil ou en utiliser un autre.",
    contact: "Si le problème persiste, contactez Service Canada en appelant le <noWrap>1-833-537-4342</noWrap>.",
    dismiss: "Fermer",
    title: "Mettez à niveau votre navigateur",
  },
} as const;

export default ns;
