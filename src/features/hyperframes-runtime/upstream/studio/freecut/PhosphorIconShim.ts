import { createElement, type ComponentType } from 'react'
import {
  ArrowLeft,
  AudioLines,
  ChevronRight,
  Copy as CopyIcon,
  File as FileIcon,
  FileCode,
  FileImage,
  FilePlus as FilePlusIcon,
  FileText,
  FileVideo as FileVideoIcon,
  Folder,
  FolderPlus,
  Image,
  Pencil,
  Plus as PlusIcon,
  Trash2,
  Type,
} from 'lucide-react'

type IconProps = {
  size?: number
  color?: string
  className?: string
  weight?: string
}

type LucideIcon = ComponentType<{
  size?: number
  color?: string
  className?: string
  strokeWidth?: number
}>

function createIcon(Icon: LucideIcon) {
  return function StudioIcon({ size = 14, color, className }: IconProps) {
    return createElement(Icon, { size, color, className, strokeWidth: 1.8 })
  }
}

export const ArrowLeftIcon = createIcon(ArrowLeft)
export const CaretRight = createIcon(ChevronRight)
export const Copy = createIcon(CopyIcon)
export const File = createIcon(FileIcon)
export const FileCodeIcon = createIcon(FileCode)
export const FileCss = createIcon(FileCode)
export const FileHtml = createIcon(FileCode)
export const FileJs = createIcon(FileCode)
export const FileJsx = createIcon(FileCode)
export const FileTs = createIcon(FileCode)
export const FileTsx = createIcon(FileCode)
export const FileMd = createIcon(FileText)
export const FileTxt = createIcon(FileText)
export const FileSvg = createIcon(FileImage)
export const FilePng = createIcon(FileImage)
export const FileJpg = createIcon(FileImage)
export const FileVideo = createIcon(FileVideoIcon)
export const FolderSimple = createIcon(Folder)
export const FolderSimplePlus = createIcon(FolderPlus)
export const ImageIcon = createIcon(Image)
export const PencilSimple = createIcon(Pencil)
export const PhImage = createIcon(Image)
export const Plus = createIcon(PlusIcon)
export const TextAa = createIcon(Type)
export const Trash = createIcon(Trash2)
export const Waveform = createIcon(AudioLines)
export const FilePlus = createIcon(FilePlusIcon)

export { ArrowLeftIcon as ArrowLeft }
export { FileCodeIcon as FileCode }
export { ImageIcon as Image }
