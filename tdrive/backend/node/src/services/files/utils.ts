import { File, PublicFile } from "./entities/file";

export const formatPublicFile = (file: Partial<File | PublicFile>): PublicFile => {
  if ((file as Partial<File>).getPublicObject) file = (file as Partial<File>).getPublicObject();
  return {
    ...file,
    thumbnails: [
      ...file.thumbnails.map(thumbnail => ({
        ...thumbnail,
        full_url: thumbnail.url.match(/https?:\/\//)
          ? "/internal/services/files/v1/" + thumbnail.url.replace(/^\//, "")
          : thumbnail.url,
      })),
    ],
  } as PublicFile;
};

export const fileIsMedia = (file: Partial<File>): boolean => {
  return (
    file.metadata?.mime?.startsWith("video/") ||
    file.metadata?.mime?.startsWith("audio/") ||
    file.metadata?.mime?.startsWith("image/")
  );
};

/**
 * Generate RFC 5987 UTF-8 encoding compliant header value for `Content-Disposition`
 * to make a browser download a reponse to a file with the provided name
 */
export const formatAttachmentContentDispositionHeader = (filename: string) => {
  const encoded = encodeURIComponent(filename.replace(/[^\p{L}0-9 _.-]/gu, ""));
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;
};
