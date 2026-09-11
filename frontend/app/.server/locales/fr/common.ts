const ns = {
  dialog: {
    addressSuggestion: {
      addressSelectionLegend: "Veuillez sélectionner une option d'adresse ci\u2011dessous\u00A0:",
      cancelButton: "Retour",
      description: "L'adresse fournie présente un problème. Sélectionnez l'adresse que vous souhaitez utiliser. Si vous habitez dans un appartement ou une chambre, assurez-vous d'inclure cette information.",
      enteredAddressOption: "Adresse saisie",
      header: "Confirmer votre adresse",
      suggestedAddressOption: "Adresse suggérée",
      useSelectedAddressButton: "Utiliser l'adresse sélectionnée",
    },
    addressInvalid: {
      closeButton: "Retour",
      description: "Nous n'avons pas pu confirmer votre adresse. Vérifiez-la de nouveau et assurez-vous <strong>d'inclure votre numéro d'appartement ou de chambre</strong>, s'il y a lieu.",
      important: "Il est important que votre adresse soit exacte. Si nous ne pouvons pas communiquer avec vous par la poste, vous pourriez subir des retards dans la réception de vos prestations.",
      enteredAddress: "Adresse saisie",
      header: "Adresse introuvable",
      continueButton: "Continuer",
      checkbox: "Je confirme que l'adresse que j'ai entrée est exacte.",
      context: {
        homeAddress: "Adresse du domicile",
        mailingAddress: "Adresse postale",
      },
    },
  },
  errorMessage: {
    mailing: {
      addressRequired: "Entrez l'adresse postale, normalement le numéro et le nom de la rue",
      charactersValid: "Seuls les lettres, les chiffres et les caractères suivants sont acceptés\u00A0: apostrophe ('), virgule (,), point (.), trait d'union (-) et parenthèse ()",
      cityRequired: "Entrez une ville ou une municipalité pour votre adresse postale",
      countryRequired: "Sélectionnez un pays pour votre adresse postale",
      invalidPostalZipCodeForCountry: "Un code postal canadien a été entré dans l'adresse postale mais le Canada n'a pas été choisi comme pays. Veuillez choisir Canada, et la bonne province, ou changer le code postal",
      invalidPostalZipCodeForProvince: "Le code postal ne correspond pas à la province ou au territoire que vous avez sélectionné",
      postalZipCodeRequired: "Entrez un code postal ou un code postal américain pour votre adresse postale",
      postalZipCodeValid: "Entrez un code postal pour l'adresse postale dans le bon format, par exemple A1A 1A1. Les lettres D, F, I, O, Q ou U ne peuvent pas être utilisées.",
      provinceStateRequired: "Sélectionnez une province, un territoire, un état ou une région pour votre adresse postale",
      zipCodeValid: "Entrez un code postal américain pour l'adresse postale dans le bon format, par exemple 12345 ou 12345-6789",
    },
    home: {
      addressRequired: "Entrez l'adresse du domicile, normalement le numéro et le nom de la rue",
      charactersValid: "Seuls les lettres, les chiffres et les caractères suivants sont acceptés\u00A0: apostrophe ('), virgule (,), point (.), trait d'union (-) et parenthèse ()",
      cityRequired: "Entrez une ville ou une municipalité pour votre adresse du domicile",
      countryRequired: "Sélectionnez un pays pour votre adresse du domicile",
      invalidPostalZipCodeForCountry: "Un code postal canadien a été saisi pour l'adresse du domicile, mais le Canada n'a pas été choisi comme pays. Veuillez choisir Canada, et la bonne province, ou changer le code postal",
      invalidPostalZipCodeForProvince: "Le code postal ne correspond pas à la province ou au territoire que vous avez sélectionné",
      postalZipCodeRequired: "Entrez un code postal ou un code postal américain pour votre adresse du domicile",
      postalZipCodeValid: "Entrez un code postal pour l'adresse du domicile dans le bon format, par exemple A1A 1A1. Les lettres D, F, I, O, Q ou U ne peuvent pas être utilisées.",
      provinceStateRequired: "Sélectionnez une province, un territoire, un état ou une région pour votre adresse du domicile",
      zipCodeValid: "Entrez un code postal américain pour l'adresse du domicile dans le bon format, par exemple 12345 ou 12345-6789",
    },
  },
  killswitch: {
    title: "Veuillez patienter",
    overloaded: "Nous recevons beaucoup de visiteurs en ce moment, ce qui ralentit le processus. Vous pourrez continuer lorsque le minuteur atteindra zéro.",
    dontWorryBeHappy: "Ne vous inquiétez pas\u2014vos renseignements sont enregistrés. Ne fermez pas votre navigateur, sinon vous devrez recommencer l'application.",
    remainingTime: "Accéder à l'application dans\u00A0: {{mins}} min {{secs}} sec",
  },
  status: {
    complete: "Terminé",
    error: "Erreur",
    new: "Nouveau",
    optional: "Facultatif",
  },
  navigation: {
    previous: "Précédent",
    next: "Suivant",
  },
  eligibility: {
    eligible: {
      title: "Vous êtes admissible",
      description: "Continuez d'utiliser vos prestations, mais tenez compte des changements possibles à votre niveau de couverture.",
      instructions:
        "Vous pouvez vérifier votre niveau de couverture dans la lettre d'invitation au renouvellement envoyée par Service Canada. Cette lettre peut également être consultée dans <mscaLink>Mon dossier Service Canada (MDSC)</mscaLink>. Aucune autre communication ne sera envoyée.",
    },
    ineligible: {
      title: "Vous n'êtes pas admissible",
      description: "Nous vous enverrons une lettre confirmant cette décision. La lettre indiquera la date de votre dernier jour de couverture. Les services dentaires reçus après cette date ne seront pas couverts ni remboursés.",
    },
    eligibleProof: {
      title: "Vous êtes admissible - des pièces justificatives pourraient être exigées",
      description:
        "L'un ou plusieurs de vos feuillets T4 ou T4A de 2025 indiquent que vous avez accès à une assurance dentaire privée au 31 décembre 2025. Nous pourrions vous demander une preuve démontrant que vous n'avez pas accès à une assurance ou à une couverture dentaire privée. Le cas échéant, nous communiquerons avec vous.",
      continue: "Si vous n'avez pas accès à une assurance ou à une couverture dentaire privée, continuez d'utiliser vos prestations actuelles, tout en tenant compte de tout changement éventuel dans votre niveau de couverture.",
      instructions:
        "Vous pouvez vérifier votre niveau de couverture dans la lettre d'invitation au renouvellement envoyée par Service Canada. Cette lettre peut également être consultée dans <mscaLink>Mon dossier Service Canada (MDSC)</mscaLink>. Aucune autre communication ne sera envoyée.",
    },
    mscaLink: "https://www.canada.ca/en/employment-social-development/services/my-account.html",
  },
  stepper: {
    status: {
      completed: "\u0020completé",
      upcoming: "\u0020non complété",
    },
  },
  sectionsCompleted_one: "{{number}} sur {{count}} section remplie.",
  sectionsCompleted_other: "{{number}} sur {{count}} sections remplies.",
} as const;

export default ns;
