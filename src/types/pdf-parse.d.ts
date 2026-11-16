declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfTextItem {
    str: string;
    transform: number[];
  }
  interface PdfPageData {
    getTextContent: (opts: { normalizeWhitespace?: boolean; disableCombineTextItems?: boolean }) => Promise<{ items: PdfTextItem[] }>;
  }
  interface PdfParseOptions {
    pagerender?: (pageData: PdfPageData) => Promise<string>;
    max?: number;
  }
  interface PdfParseResult {
    text: string;
    numpages: number;
  }
  const pdf: (data: Buffer, opts?: PdfParseOptions) => Promise<PdfParseResult>;
  export default pdf;
}
