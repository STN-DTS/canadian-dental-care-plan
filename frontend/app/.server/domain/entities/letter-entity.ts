export type LetterEntity = Readonly<{
  LetterId: string;
  LetterDate: string;
  LetterName: string;
}>;

export type PdfEntity = Readonly<{
  documentBytes: string;
}>;
