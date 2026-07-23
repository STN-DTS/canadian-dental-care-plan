export type ClientFriendlyStatusResponseEntity = Readonly<{
  value: ReadonlyArray<ClientFriendlyStatusEntity>;
}>;

export type ClientFriendlyStatusEntity = Readonly<{
  esdc_clientfriendlystatusid: string;
  esdc_descriptionenglish: string;
  esdc_descriptionfrench: string;
}>;
