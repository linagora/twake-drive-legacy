import type ora from "ora";

export default interface ReindexerOptions {
  spinner: ora.Ora;
  repairEntities: boolean;
  filterDocumentsByUserEMail: string[];
}
