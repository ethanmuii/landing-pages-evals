/** Offline fixture input; a future adapter can supply the same content from an API. */
export interface ContentAndTokenStrategy {
  readBaselineContractText(): Promise<string>;
  readCleanPageHtml(): Promise<string>;
}
