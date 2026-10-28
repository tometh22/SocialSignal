export type DocumentPreviewKind = "pdf" | "image" | "text" | "download";

/** Only fetch local documents with the app's session; never forward it elsewhere. */
export function localDocumentPath(fileUrl: string, origin: string): string {
  const url = new URL(fileUrl, origin);
  if (url.origin !== origin || !["https:", "http:"].includes(url.protocol)) {
    throw new Error("Este comprobante usa un enlace externo. No se puede cargar como documento privado de Mind.");
  }
  return url.pathname + url.search;
}

/** HTML, SVG and unknown types are download-only, never embedded as active content. */
export function documentPreviewKind(contentType: string): DocumentPreviewKind {
  const mime = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) return "image";
  if (mime === "text/plain") return "text";
  return "download";
}
