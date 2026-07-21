# Application Routes Reference

## Table of Contents

- [CANADA.CA - PUBLIC](#canadaca---public)
  - [Public Application](#public-application)
    - [Public Entry Points](#public-entry-points)
    - [Public Spokes](#public-spokes)
    - [Full Model](#full-model)
      - [Full Model - Adult](#full-model---adult)
      - [Full Model - Children](#full-model---children)
      - [Full Model - Family](#full-model---family)
    - [Simplified Model](#simplified-model)
      - [Simplified Model - Adult](#simplified-model---adult)
      - [Simplified Model - Children](#simplified-model---children)
      - [Simplified Model - Family](#simplified-model---family)
  - [Status Checker](#status-checker)
- [MSCA - PROTECTED](#msca---protected)
  - [Protected Application](#protected-application)
    - [Protected Entry Points](#protected-entry-points)
    - [Protected Spokes](#protected-spokes)
    - [Intake](#intake)
      - [Intake - Adult](#intake---adult)
      - [Intake - Children](#intake---children)
      - [Intake - Family](#intake---family)
    - [Renewal](#renewal)
      - [Renewal - Adult](#renewal---adult)
      - [Renewal - Children](#renewal---children)
      - [Renewal - Family](#renewal---family)
  - [Documents](#documents)
  - [Letters](#letters)
  - [Profile](#profile)
  - [Error & Special Pages](#error--special-pages)

---

## CANADA.CA - PUBLIC

Public-facing application portal available to all users without authentication. Supports both new applicants and returning members during renewal periods.

### Public Application

> **Hub & Spoke Architecture:** The application uses a hub-and-spoke model where "spokes" (individual question pages) are shared across all flows and intelligently route to the appropriate "hub" (flow-specific coordinator page) based on the user's context (input model + applicant type).

#### Public Entry Points

These are the main entry points that all users encounter regardless of which application model or applicant type they select. They serve as the foundation for the application journey.

| English URL                                    | English Title            | French URL                               | French Title             |
| ---------------------------------------------- | ------------------------ | ---------------------------------------- | ------------------------ |
| `/en/application`                              | Application              | `/fr/demande`                            | Demande                  |
| `/en/application/:id/eligibility-requirements` | Eligibility requirements | `/fr/demande/:id/criteres-admissibilite` | Critères d'admissibilité |
| `/en/application/:id/your-application`         | Your application         | `/fr/demande/:id/votre-demande`          | Votre demande            |

---

#### Public Spokes

Shared question pages reused across all application models and applicant types. These handle common information collection like personal details, contact information, and dental insurance status. Spokes intelligently route back to the appropriate flow hub based on context.

| English URL                                                                     | English Title                                                          | French URL                                                                                   | French Title                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/en/application/:id/marital-status`                                            | Marital status                                                         | `/fr/demande/:id/etat-civil`                                                                 | État civil                                                                                       |
| `/en/application/:id/type-application`                                          | Type of application                                                    | `/fr/demande/:id/type-demande`                                                               | Type de demande                                                                                  |
| `/en/application/:id/dental-insurance`                                          | Access to private dental insurance                                     | `/fr/demande/:id/assurance-dentaire`                                                         | Accès à une assurance dentaire privée                                                            |
| `/en/application/:id/application-delegate`                                      | Applying on behalf of someone as a legal delegate or Power of Attorney | `/fr/demande/:id/delegue-demande`                                                            | Présenter une demande au nom d'une autre personne à titre de représentant légal ou de mandataire |
| `/en/application/:id/personal-information`                                      | Personal information                                                   | `/fr/demande/:id/renseignements-personnels`                                                  | Renseignements personnels                                                                        |
| `/en/application/:id/phone-number`                                              | Phone number                                                           | `/fr/demande/:id/numero-telephone`                                                           | Numéro de téléphone                                                                              |
| `/en/application/:id/mailing-address`                                           | Mailing address                                                        | `/fr/demande/:id/adresse-postale`                                                            | Adresse postale                                                                                  |
| `/en/application/:id/home-address`                                              | Home address                                                           | `/fr/demande/:id/adresse-domicile`                                                           | Adresse à domicile                                                                               |
| `/en/application/:id/email`                                                     | Email address                                                          | `/fr/demande/:id/adresse-courriel`                                                           | Adresse courriel                                                                                 |
| `/en/application/:id/verify-email`                                              | Verification code                                                      | `/fr/demande/:id/verifier-adresse-courriel`                                                  | Code de vérification                                                                             |
| `/en/application/:id/communication-preferences`                                 | Communication preferences                                              | `/fr/demande/:id/preference-communication`                                                   | Préférences de communication                                                                     |
| `/en/application/:id/federal-provincial-territorial-benefits`                   | Other federal, provincial or territorial dental benefits               | `/fr/demande/:id/prestations-dentaires-federales-provinciales-territoriales`                 | Autres prestations dentaires fédérales, provinciales ou territoriales                            |
| `/en/application/:id/living-independently`                                      | Living independently                                                   | `/fr/demande/:id/vivre-maniere-independante`                                                 | Personne vivant de manière indépendante                                                          |
| `/en/application/:id/parent-or-guardian`                                        | Parent or legal guardian needs to apply                                | `/fr/demande/:id/parent-ou-tuteur`                                                           | Le parent ou le tuteur légal doit présenter la demande                                           |
| `/en/application/:id/children/:childId/information`                             | Child information                                                      | `/fr/demande/:id/enfant/:childId/information`                                                | Renseignements sur l'enfant                                                                      |
| `/en/application/:id/children/:childId/parent-or-guardian`                      | You must be a parent or legal guardian                                 | `/fr/demande/:id/enfant/:childId/parent-ou-tuteur`                                           | Vous devez être le parent ou le tuteur légal                                                     |
| `/en/application/:id/children/:childId/cannot-apply-child`                      | Your child must apply                                                  | `/fr/demande/:id/enfant/:childId/pas-demande-enfant`                                         | Votre enfant doit présenter une demande                                                          |
| `/en/application/:id/children/:childId/federal-provincial-territorial-benefits` | Other federal, provincial or territorial dental benefits               | `/fr/demande/:id/enfant/:childId/prestations-dentaires-federales-provinciales-territoriales` | Autres prestations dentaires fédérales, provinciales ou territoriales                            |
| `/en/application/:id/children/:childId/dental-insurance`                        | Access to private dental insurance                                     | `/fr/demande/:id/enfant/:childId/assurance-dentaire`                                         | Accès à une assurance dentaire privée                                                            |
| `/en/application/:id/new-or-returning-member`                                   | New or returning member                                                | `/fr/demande/:id/membre-nouveau-ou-actuel`                                                   | Nouveau membre ou membre existant                                                                |
| `/en/application/:id/dental-insurance-exit-application`                         | We may ask you for additional information                              | `/fr/demande/:id/quitter-demande-assurance-dentaire`                                         | Nous pourrions vous demander des renseignements supplémentaires                                  |

---

#### Full Model

The **Full Model** captures comprehensive application information. It asks all eligibility questions including marital status, dental insurance access, and government benefits. This model is typically used for new applicants or when a complete application review is needed.

##### Full Model - Adult

Hub and spoke journey for individual adults applying for themselves.

| English URL                                          | English Title                      | French URL                                           | French Title                         |
| ---------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| `/en/application/:id/full/adult/marital-status`      | Your marital status                | `/fr/demande/:id/complete/adulte/etat-civil`         | Votre état civil                     |
| `/en/application/:id/full/adult/dental-insurance`    | Your access to dental insurance    | `/fr/demande/:id/complete/adulte/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/application/:id/full/adult/contact-information` | Your contact information           | `/fr/demande/:id/complete/adulte/coordonnees`        | Vos coordonnées                      |
| `/en/application/:id/full/adult/submit`              | Submit your application            | `/fr/demande/:id/complete/adulte/soumettre`          | Soumettre votre demande              |
| `/en/application/:id/full/adult/exit-application`    | Exiting the application            | `/fr/demande/:id/complete/adulte/quitter-demande`    | Quitter la demande                   |
| `/en/application/:id/full/adult/confirmation`        | Application successfully submitted | `/fr/demande/:id/complete/adulte/confirmation`       | Demande soumise avec succès          |

---

##### Full Model - Children

Hub and spoke journey for parents/guardians applying for their children only.

| English URL                                               | English Title                           | French URL                                          | French Title                                           |
| --------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `/en/application/:id/full/children/parent-or-guardian`    | Parent or legal guardian needs to apply | `/fr/demande/:id/complete/enfants/parent-ou-tuteur` | Le parent ou le tuteur légal doit présenter la demande |
| `/en/application/:id/full/children/childrens-application` | Children's application                  | `/fr/demande/:id/complete/enfants/demande-enfants`  | Demande des enfants                                    |
| `/en/application/:id/full/children/submit`                | Submit your application                 | `/fr/demande/:id/complete/enfants/soumettre`        | Soumettre votre demande                                |
| `/en/application/:id/full/children/exit-application`      | Exiting the application                 | `/fr/demande/:id/complete/enfants/quitter-demande`  | Quitter la demande                                     |
| `/en/application/:id/full/children/confirmation`          | Application successfully submitted      | `/fr/demande/:id/complete/enfants/confirmation`     | Demande soumise avec succès                            |

---

##### Full Model - Family

Hub and spoke journey for parents/guardians applying for themselves and their children.

| English URL                                             | English Title                      | French URL                                            | French Title                         |
| ------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `/en/application/:id/full/family/marital-status`        | Your marital status                | `/fr/demande/:id/complete/famille/etat-civil`         | Votre état civil                     |
| `/en/application/:id/full/family/contact-information`   | Your contact information           | `/fr/demande/:id/complete/famille/coordonnees`        | Vos coordonnées                      |
| `/en/application/:id/full/family/dental-insurance`      | Your access to dental insurance    | `/fr/demande/:id/complete/famille/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/application/:id/full/family/childrens-application` | Children's application             | `/fr/demande/:id/complete/famille/demande-enfants`    | Demande des enfants                  |
| `/en/application/:id/full/family/confirmation`          | Application successfully submitted | `/fr/demande/:id/complete/famille/confirmation`       | Demande soumise avec succès          |
| `/en/application/:id/full/family/submit`                | Submit your application            | `/fr/demande/:id/complete/famille/soumettre`          | Soumettre votre demande              |
| `/en/application/:id/full/family/exit-application`      | Exiting the application            | `/fr/demande/:id/complete/famille/quitter-demande`    | Quitter la demande                   |

---

#### Simplified Model

The **Simplified Model** streamlines the application for returning members during renewal periods or when minimal information updates are needed. It skips some eligibility questions and focuses on current status verification and contact information updates.

##### Simplified Model - Adult

Streamlined hub and spoke journey for individual adults renewing or updating information.

| English URL                                                | English Title                      | French URL                                            | French Title                         |
| ---------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `/en/application/:id/simplified/adult/contact-information` | Your contact information           | `/fr/demande/:id/simplifie/adulte/coordonnees`        | Vos coordonnées                      |
| `/en/application/:id/simplified/adult/dental-insurance`    | Your access to dental insurance    | `/fr/demande/:id/simplifie/adulte/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/application/:id/simplified/adult/submit`              | Submit your application            | `/fr/demande/:id/simplifie/adulte/soumettre`          | Soumettre votre demande              |
| `/en/application/:id/simplified/adult/exit-application`    | Exiting the application            | `/fr/demande/:id/simplifie/adulte/quitter-demande`    | Quitter la demande                   |
| `/en/application/:id/simplified/adult/confirmation`        | Application successfully submitted | `/fr/demande/:id/simplifie/adulte/confirmation`       | Demande soumise avec succès          |

---

##### Simplified Model - Children

Streamlined hub and spoke journey for parents/guardians renewing for their children.

| English URL                                                     | English Title                           | French URL                                           | French Title                                           |
| --------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `/en/application/:id/simplified/children/parent-or-guardian`    | Parent or legal guardian needs to apply | `/fr/demande/:id/simplifie/enfants/parent-ou-tuteur` | Le parent ou le tuteur légal doit présenter la demande |
| `/en/application/:id/simplified/children/childrens-application` | Children's application                  | `/fr/demande/:id/simplifie/enfants/demande-enfants`  | Demande des enfants                                    |
| `/en/application/:id/simplified/children/submit`                | Submit your application                 | `/fr/demande/:id/simplifie/enfants/soumettre`        | Soumettre votre demande                                |
| `/en/application/:id/simplified/children/exit-application`      | Exiting the application                 | `/fr/demande/:id/simplifie/enfants/quitter-demande`  | Quitter la demande                                     |
| `/en/application/:id/simplified/children/confirmation`          | Application successfully submitted      | `/fr/demande/:id/simplifie/enfants/confirmation`     | Demande soumise avec succès                            |

---

##### Simplified Model - Family

Streamlined hub and spoke journey for parents/guardians renewing for themselves and their children.

| English URL                                                   | English Title                      | French URL                                             | French Title                         |
| ------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| `/en/application/:id/simplified/family/contact-information`   | Your contact information           | `/fr/demande/:id/simplifie/famille/coordonnees`        | Vos coordonnées                      |
| `/en/application/:id/simplified/family/dental-insurance`      | Your access to dental insurance    | `/fr/demande/:id/simplifie/famille/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/application/:id/simplified/family/childrens-application` | Children's application             | `/fr/demande/:id/simplifie/famille/demande-enfants`    | Demande des enfants                  |
| `/en/application/:id/simplified/family/submit`                | Submit your application            | `/fr/demande/:id/simplifie/famille/soumettre`          | Soumettre votre demande              |
| `/en/application/:id/simplified/family/confirmation`          | Application successfully submitted | `/fr/demande/:id/simplifie/famille/confirmation`       | Demande soumise avec succès          |
| `/en/application/:id/simplified/family/exit-application`      | Exiting the application            | `/fr/demande/:id/simplifie/famille/quitter-demande`    | Quitter la demande                   |

---

### Status Checker

Public tool allowing applicants and members to check the status of their CDCP application without authentication. Users can check their own status or their child's status.

| English URL         | English Title  | French URL          | French Title           |
| ------------------- | -------------- | ------------------- | ---------------------- |
| `/en/status`        | Status Checker | `/fr/etat`          | Vérificateur de l'état |
| `/en/status/myself` | Status Checker | `/fr/etat/moi-meme` | Vérificateur de l'état |
| `/en/status/child`  | Status Checker | `/fr/etat/enfant`   | Vérificateur de l'état |
| `/en/status/result` | Status Checker | `/fr/etat/resultat` | Vérificateur de l'état |

---

## MSCA - PROTECTED

Authenticated portal accessible through My Service Canada Account (MSCA). Reserved for current members and returning applicants during renewal periods. Requires login and provides personalized application journeys.

### Protected Application

> **Hub & Spoke Architecture:** Uses the same hub-and-spoke model as the public application. Spokes are shared across intake and renewal flows, routing intelligently to the appropriate flow hub.

#### Protected Entry Points

Main entry points for authenticated users accessing the protected application portal. Users start here before selecting their application context (new intake or renewal).

| English URL                                              | English Title            | French URL                                       | French Title             |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------ | ------------------------ |
| `/en/protected/application`                              | Application              | `/fr/protege/demande`                            | Demande                  |
| `/en/protected/application/:id/eligibility-requirements` | Eligibility requirements | `/fr/protege/demande/:id/criteres-admissibilite` | Critères d'admissibilité |
| `/en/protected/application/:id/your-application`         | Your application         | `/fr/protege/demande/:id/votre-demande`          | Votre demande            |
| `/en/protected/application/:id/renew`                    | Renew                    | `/fr/protege/demande/:id/renouveler`             | Renouveler               |

---

#### Protected Spokes

Reusable question pages available across intake and renewal journeys. These handle common information collection and intelligently route back to the appropriate flow context.

| English URL                                                                               | English Title                                                          | French URL                                                                                           | French Title                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/en/protected/application/:id/marital-status`                                            | Marital status                                                         | `/fr/protege/demande/:id/etat-civil`                                                                 | État civil                                                                                       |
| `/en/protected/application/:id/type-application`                                          | Type of application                                                    | `/fr/protege/demande/:id/type-demande`                                                               | Type de demande                                                                                  |
| `/en/protected/application/:id/dental-insurance`                                          | Access to private dental insurance                                     | `/fr/protege/demande/:id/assurance-dentaire`                                                         | Accès à une assurance dentaire privée                                                            |
| `/en/protected/application/:id/personal-information`                                      | Personal information                                                   | `/fr/protege/demande/:id/renseignements-personnels`                                                  | Renseignements personnels                                                                        |
| `/en/protected/application/:id/phone-number`                                              | Phone number                                                           | `/fr/protege/demande/:id/numero-telephone`                                                           | Numéro de téléphone                                                                              |
| `/en/protected/application/:id/mailing-address`                                           | Mailing address                                                        | `/fr/protege/demande/:id/adresse-postale`                                                            | Adresse postale                                                                                  |
| `/en/protected/application/:id/home-address`                                              | Home address                                                           | `/fr/protege/demande/:id/adresse-domicile`                                                           | Adresse à domicile                                                                               |
| `/en/protected/application/:id/email`                                                     | Email address                                                          | `/fr/protege/demande/:id/adresse-courriel`                                                           | Adresse courriel                                                                                 |
| `/en/protected/application/:id/verify-email`                                              | Verification code                                                      | `/fr/protege/demande/:id/verifier-adresse-courriel`                                                  | Code de vérification                                                                             |
| `/en/protected/application/:id/communication-preferences`                                 | Communication preferences                                              | `/fr/protege/demande/:id/preference-communication`                                                   | Préférences de communication                                                                     |
| `/en/protected/application/:id/federal-provincial-territorial-benefits`                   | Other federal, provincial or territorial dental benefits               | `/fr/protege/demande/:id/prestations-dentaires-federales-provinciales-territoriales`                 | Autres prestations dentaires fédérales, provinciales ou territoriales                            |
| `/en/protected/application/:id/living-independently`                                      | Living independently                                                   | `/fr/protege/demande/:id/vivre-maniere-independante`                                                 | Personne vivant de manière indépendante                                                          |
| `/en/protected/application/:id/parent-or-guardian`                                        | Parent or legal guardian needs to apply                                | `/fr/protege/demande/:id/parent-ou-tuteur`                                                           | Le parent ou le tuteur légal doit présenter la demande                                           |
| `/en/protected/application/:id/new-or-returning-member`                                   | New or returning member                                                | `/fr/protege/demande/:id/membre-nouveau-ou-actuel`                                                   | Nouveau membre ou membre existant                                                                |
| `/en/protected/application/:id/renewal-selection`                                         | Renewal selection                                                      | `/fr/protege/demande/:id/selection-renouvellement`                                                   | Sélection de renouvellement                                                                      |
| `/en/protected/application/:id/application-delegate`                                      | Applying on behalf of someone as a legal delegate or Power of Attorney | `/fr/protege/demande/:id/delegue-demande`                                                            | Présenter une demande au nom d'une autre personne à titre de représentant légal ou de mandataire |
| `/en/protected/application/:id/dental-insurance-exit-application`                         | We may ask you for additional information                              | `/fr/protege/demande/:id/quitter-demande-assurance-dentaire`                                         | Nous pourrions vous demander des renseignements supplémentaires                                  |
| `/en/protected/application/:id/children/:childId/information`                             | Child information                                                      | `/fr/protege/demande/:id/enfant/:childId/information`                                                | Renseignements sur l'enfant                                                                      |
| `/en/protected/application/:id/children/:childId/parent-or-guardian`                      | You must be a parent or legal guardian                                 | `/fr/protege/demande/:id/enfant/:childId/parent-ou-tuteur`                                           | Vous devez être le parent ou le tuteur légal                                                     |
| `/en/protected/application/:id/children/:childId/cannot-apply-child`                      | Your child must apply                                                  | `/fr/protege/demande/:id/enfant/:childId/pas-demande-enfant`                                         | Votre enfant doit présenter une demande                                                          |
| `/en/protected/application/:id/children/:childId/federal-provincial-territorial-benefits` | Other federal, provincial or territorial dental benefits               | `/fr/protege/demande/:id/enfant/:childId/prestations-dentaires-federales-provinciales-territoriales` | Autres prestations dentaires fédérales, provinciales ou territoriales                            |
| `/en/protected/application/:id/children/:childId/dental-insurance`                        | Access to private dental insurance                                     | `/fr/protege/demande/:id/enfant/:childId/assurance-dentaire`                                         | Accès à une assurance dentaire privée                                                            |
| `/en/protected/application/:id/children/:childId/parent-guardian`                         | Parent or legal guardian                                               | `/fr/protege/demande/:id/enfant/:childId/parent-tuteur`                                              | Parent ou tuteur légal                                                                           |
| `/en/protected/application/:id/children/:childId/social-insurance-number`                 | Child's Social Insurance Number                                        | `/fr/protege/demande/:id/enfant/:childId/numero-assurance-sociale`                                   | Numéro d'assurance sociale de l'enfant                                                           |

---

#### Intake

**Intake journeys** are for new authenticated applicants. These collect comprehensive information similar to the public Full Model but within a secure, personalized environment.

##### Intake - Adult

Comprehensive hub and spoke intake journey for individual adults applying for the first time as authenticated users.

| English URL                                                      | English Title                      | French URL                                                    | French Title                         |
| ---------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `/en/protected/application/:id/intake/adult/marital-status`      | Your marital status                | `/fr/protege/demande/:id/admission/adulte/etat-civil`         | Votre état civil                     |
| `/en/protected/application/:id/intake/adult/dental-insurance`    | Your access to dental insurance    | `/fr/protege/demande/:id/admission/adulte/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/protected/application/:id/intake/adult/contact-information` | Your contact information           | `/fr/protege/demande/:id/admission/adulte/coordonnees`        | Vos coordonnées                      |
| `/en/protected/application/:id/intake/adult/submit`              | Submit your application            | `/fr/protege/demande/:id/admission/adulte/soumettre`          | Soumettre votre demande              |
| `/en/protected/application/:id/intake/adult/exit-application`    | Exiting the application            | `/fr/protege/demande/:id/admission/adulte/quitter-demande`    | Quitter la demande                   |
| `/en/protected/application/:id/intake/adult/confirmation`        | Application successfully submitted | `/fr/protege/demande/:id/admission/adulte/confirmation`       | Demande soumise avec succès          |

---

##### Intake - Children

Comprehensive hub and spoke intake journey for parents/guardians applying for their children for the first time as authenticated users.

| English URL                                                           | English Title                           | French URL                                                   | French Title                                           |
| --------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `/en/protected/application/:id/intake/children/parent-or-guardian`    | Parent or legal guardian needs to apply | `/fr/protege/demande/:id/admission/enfants/parent-ou-tuteur` | Le parent ou le tuteur légal doit présenter la demande |
| `/en/protected/application/:id/intake/children/childrens-application` | Children's application                  | `/fr/protege/demande/:id/admission/enfants/demande-enfants`  | Demande des enfants                                    |
| `/en/protected/application/:id/intake/children/submit`                | Submit your application                 | `/fr/protege/demande/:id/admission/enfants/soumettre`        | Soumettre votre demande                                |
| `/en/protected/application/:id/intake/children/exit-application`      | Exiting the application                 | `/fr/protege/demande/:id/admission/enfants/quitter-demande`  | Quitter la demande                                     |
| `/en/protected/application/:id/intake/children/confirmation`          | Application successfully submitted      | `/fr/protege/demande/:id/admission/enfants/confirmation`     | Demande soumise avec succès                            |

---

##### Intake - Family

Comprehensive hub and spoke intake journey for parents/guardians applying for themselves and their children for the first time as authenticated users.

| English URL                                                         | English Title                      | French URL                                                     | French Title                         |
| ------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `/en/protected/application/:id/intake/family/marital-status`        | Your marital status                | `/fr/protege/demande/:id/admission/famille/etat-civil`         | Votre état civil                     |
| `/en/protected/application/:id/intake/family/contact-information`   | Your contact information           | `/fr/protege/demande/:id/admission/famille/coordonnees`        | Vos coordonnées                      |
| `/en/protected/application/:id/intake/family/dental-insurance`      | Your access to dental insurance    | `/fr/protege/demande/:id/admission/famille/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/protected/application/:id/intake/family/childrens-application` | Children's application             | `/fr/protege/demande/:id/admission/famille/demande-enfants`    | Demande des enfants                  |
| `/en/protected/application/:id/intake/family/submit`                | Submit your application            | `/fr/protege/demande/:id/admission/famille/soumettre`          | Soumettre votre demande              |
| `/en/protected/application/:id/intake/family/exit-application`      | Exiting the application            | `/fr/protege/demande/:id/admission/famille/quitter-demande`    | Quitter la demande                   |
| `/en/protected/application/:id/intake/family/confirmation`          | Application successfully submitted | `/fr/protege/demande/:id/admission/famille/confirmation`       | Demande soumise avec succès          |

---

#### Renewal

**Renewal journeys** are available during the annual renewal period (typically April-June). Current CDCP members use these to update information and confirm continued eligibility. Available only to authenticated users.

##### Renewal - Adult

Streamlined hub and spoke renewal journey for individual adult members updating their information.

| English URL                                                       | English Title                      | French URL                                                         | French Title                         |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `/en/protected/application/:id/renewal/adult/marital-status`      | Your marital status                | `/fr/protege/demande/:id/renouvellement/adulte/etat-civil`         | Votre état civil                     |
| `/en/protected/application/:id/renewal/adult/contact-information` | Your contact information           | `/fr/protege/demande/:id/renouvellement/adulte/coordonnees`        | Vos coordonnées                      |
| `/en/protected/application/:id/renewal/adult/dental-insurance`    | Your access to dental insurance    | `/fr/protege/demande/:id/renouvellement/adulte/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/protected/application/:id/renewal/adult/submit`              | Submit your application            | `/fr/protege/demande/:id/renouvellement/adulte/soumettre`          | Soumettre votre demande              |
| `/en/protected/application/:id/renewal/adult/exit-application`    | Exiting the application            | `/fr/protege/demande/:id/renouvellement/adulte/quitter-demande`    | Quitter la demande                   |
| `/en/protected/application/:id/renewal/adult/confirmation`        | Application successfully submitted | `/fr/protege/demande/:id/renouvellement/adulte/confirmation`       | Demande soumise avec succès          |

---

##### Renewal - Children

Streamlined hub and spoke renewal journey for members renewing coverage for their children.

| English URL                                                            | English Title                           | French URL                                                        | French Title                                           |
| ---------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `/en/protected/application/:id/renewal/children/parent-or-guardian`    | Parent or legal guardian needs to apply | `/fr/protege/demande/:id/renouvellement/enfants/parent-ou-tuteur` | Le parent ou le tuteur légal doit présenter la demande |
| `/en/protected/application/:id/renewal/children/childrens-application` | Children's application                  | `/fr/protege/demande/:id/renouvellement/enfants/demande-enfants`  | Demande des enfants                                    |
| `/en/protected/application/:id/renewal/children/submit`                | Submit your application                 | `/fr/protege/demande/:id/renouvellement/enfants/soumettre`        | Soumettre votre demande                                |
| `/en/protected/application/:id/renewal/children/exit-application`      | Exiting the application                 | `/fr/protege/demande/:id/renouvellement/enfants/quitter-demande`  | Quitter la demande                                     |
| `/en/protected/application/:id/renewal/children/confirmation`          | Application successfully submitted      | `/fr/protege/demande/:id/renouvellement/enfants/confirmation`     | Demande soumise avec succès                            |

---

##### Renewal - Family

Streamlined hub and spoke renewal journey for members renewing coverage for themselves and their children.

| English URL                                                          | English Title                      | French URL                                                          | French Title                         |
| -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `/en/protected/application/:id/renewal/family/marital-status`        | Your marital status                | `/fr/protege/demande/:id/renouvellement/famille/etat-civil`         | Votre état civil                     |
| `/en/protected/application/:id/renewal/family/contact-information`   | Your contact information           | `/fr/protege/demande/:id/renouvellement/famille/coordonnees`        | Vos coordonnées                      |
| `/en/protected/application/:id/renewal/family/dental-insurance`      | Your access to dental insurance    | `/fr/protege/demande/:id/renouvellement/famille/assurance-dentaire` | Votre accès à une assurance dentaire |
| `/en/protected/application/:id/renewal/family/childrens-application` | Children's application             | `/fr/protege/demande/:id/renouvellement/famille/demande-enfants`    | Demande des enfants                  |
| `/en/protected/application/:id/renewal/family/submit`                | Submit your application            | `/fr/protege/demande/:id/renouvellement/famille/soumettre`          | Soumettre votre demande              |
| `/en/protected/application/:id/renewal/family/exit-application`      | Exiting the application            | `/fr/protege/demande/:id/renouvellement/famille/quitter-demande`    | Quitter la demande                   |
| `/en/protected/application/:id/renewal/family/confirmation`          | Application successfully submitted | `/fr/protege/demande/:id/renouvellement/famille/confirmation`       | Demande soumise avec succès          |

---

### Documents

Section for authenticated users to manage required documentation. Users can upload supporting documents for their application or view information about documents not required.

| English URL                            | English Title          | French URL                         | French Title         |
| -------------------------------------- | ---------------------- | ---------------------------------- | -------------------- |
| `/en/protected/documents`              | Documents              | `/fr/protege/documents`            | Documents            |
| `/en/protected/documents/upload`       | Upload                 | `/fr/protege/documents/televerser` | Téléverser           |
| `/en/protected/documents/not-required` | Documents not required | `/fr/protege/documents/non-requis` | Documents non requis |

For upload flow implementation details, see [Document Upload Feature](./document-upload-feature.md).

---

### Letters

Archive of official correspondence sent to the member from the Government of Canada regarding their CDCP application and membership.

| English URL                          | English Title | French URL                            | French Title |
| ------------------------------------ | ------------- | ------------------------------------- | ------------ |
| `/en/protected/letters`              | Letters       | `/fr/protege/lettres`                 | Lettres      |
| `/en/protected/letters/:id/download` | Letters       | `/fr/protege/lettres/:id/telecharger` | Lettres      |

---

### Profile

Personal information hub where authenticated members can view and update their account details, eligibility status, communication preferences, and contact information. Provides a centralized location for all profile-related management.

| English URL                                            | English Title             | French URL                                                   | French Title                       |
| ------------------------------------------------------ | ------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `/en/protected/profile/eligibility`                    | Eligibility               | `/fr/protege/profil/admissibilite`                           | Admissibilité                      |
| `/en/protected/profile/applicant`                      | Applicant information     | `/fr/protege/profil/demandeur`                               | Renseignements sur le demandeur    |
| `/en/protected/profile/dental-benefits`                | Dental benefits           | `/fr/protege/profil/prestations-dentaires`                   | Prestations dentaires              |
| `/en/protected/profile/dental-benefits/edit`           | Edit dental benefits      | `/fr/protege/profil/prestations-dentaires/modifier`          | Modifier les prestations dentaires |
| `/en/protected/profile/dental-benefits/:childId/edit`  | Edit dental benefits      | `/fr/protege/profil/prestations-dentaires/:childId/modifier` | Modifier les prestations dentaires |
| `/en/protected/profile/communication-preferences`      | Communication preferences | `/fr/protege/profil/preferences-communication`               | Préférences de communication       |
| `/en/protected/profile/communication-preferences/edit` | Communication preferences | `/fr/protege/profil/preferences-communication/modifier`      | Préférences de communication       |
| `/en/protected/profile/contact`                        | Contact information       | `/fr/protege/profil/coordonnees`                             | Coordonnées                        |
| `/en/protected/profile/contact/phone`                  | Phone number              | `/fr/protege/profil/coordonnees/telephone`                   | Numéro de téléphone                |
| `/en/protected/profile/contact/email-address`          | Email address             | `/fr/protege/profil/coordonnees/adresse-courriel`            | Adresse courriel                   |
| `/en/protected/profile/contact/email-address/verify`   | Verification code         | `/fr/protege/profil/coordonnees/adresse-courriel/verifier`   | Code de vérification               |
| `/en/protected/profile/contact/mailing-address`        | Mailing address           | `/fr/protege/profil/coordonnees/adresse-postale`             | Adresse postale                    |
| `/en/protected/profile/contact/home-address`           | Home address              | `/fr/protege/profil/coordonnees/adresse-domicile`            | Adresse à domicile                 |

---

### Error & Special Pages

System and error pages that handle edge cases, data unavailability, processing issues, and special application states.

| English URL                                   | English Title                 | French URL                                     | French Title                           |
| --------------------------------------------- | ----------------------------- | ---------------------------------------------- | -------------------------------------- |
| `/en/protected/application/renewal-submitted` | Renewal application submitted | `/fr/protege/demande/renouvellement-soumise`   | Demande de renouvellement déjà soumise |
| `/en/protected/data-unavailable`              | Data unavailable              | `/fr/protege/donnees-indisponibles`            | Données indisponibles                  |
| `/en/protected/unable-to-process-request`     | Unable to process request     | `/fr/protege/impossible-de-traiter-la-demande` | Impossible de traiter la demande       |
| `/en/unable-to-process-request`               | Unable to process request     | `/fr/impossible-de-traiter-la-demande`         | Impossible de traiter la demande       |
