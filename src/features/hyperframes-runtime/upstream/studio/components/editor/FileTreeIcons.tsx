import {
  FileHtml,
  FileCss,
  FileJs,
  FileJsx,
  FileTs,
  FileTsx,
  FileTxt,
  FileMd,
  FileSvg,
  FilePng,
  FileJpg,
  FileVideo,
  FileCode,
  File,
  Waveform,
  TextAa,
  PhImage,
} from "../../freecut/PhosphorIconShim";

const SZ = 14;
const W = "duotone" as const;

export function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const c = "flex-shrink-0";
  if (ext === "html") return <FileHtml size={SZ} weight={W} color="#E44D26" className={c} />;
  if (ext === "css") return <FileCss size={SZ} weight={W} color="#264DE4" className={c} />;
  if (ext === "js" || ext === "mjs" || ext === "cjs")
    return <FileJs size={SZ} weight={W} color="#F0DB4F" className={c} />;
  if (ext === "jsx") return <FileJsx size={SZ} weight={W} color="#61DAFB" className={c} />;
  if (ext === "ts" || ext === "mts")
    return <FileTs size={SZ} weight={W} color="#3178C6" className={c} />;
  if (ext === "tsx") return <FileTsx size={SZ} weight={W} color="#3178C6" className={c} />;
  if (ext === "json") return <FileCode size={SZ} weight={W} color="#4ADE80" className={c} />;
  if (ext === "svg") return <FileSvg size={SZ} weight={W} color="#F97316" className={c} />;
  if (ext === "md" || ext === "mdx")
    return <FileMd size={SZ} weight={W} color="#9CA3AF" className={c} />;
  if (ext === "txt") return <FileTxt size={SZ} weight={W} color="#9CA3AF" className={c} />;
  if (ext === "png") return <FilePng size={SZ} weight={W} color="#22C55E" className={c} />;
  if (ext === "jpg" || ext === "jpeg")
    return <FileJpg size={SZ} weight={W} color="#22C55E" className={c} />;
  if (ext === "webp" || ext === "gif" || ext === "ico")
    return <PhImage size={SZ} weight={W} color="#22C55E" className={c} />;
  if (ext === "mp4" || ext === "webm" || ext === "mov")
    return <FileVideo size={SZ} weight={W} color="#A855F7" className={c} />;
  if (ext === "mp3" || ext === "wav" || ext === "ogg" || ext === "m4a")
    return <Waveform size={SZ} weight={W} color="#3CE6AC" className={c} />;
  if (ext === "woff" || ext === "woff2" || ext === "ttf" || ext === "otf")
    return <TextAa size={SZ} weight={W} color="#6B7280" className={c} />;
  return <File size={SZ} weight={W} color="#6B7280" className={c} />;
}
