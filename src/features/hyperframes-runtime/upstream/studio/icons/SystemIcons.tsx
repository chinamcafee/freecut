import { ChevronDown as ChevronDownIcon, ChevronRight as ChevronRightIcon } from 'lucide-react'

interface SystemIconProps {
  size?: number
  className?: string
}

export function ChevronDown({ size = 14, className }: SystemIconProps) {
  return <ChevronDownIcon size={size} className={className} strokeWidth={1.8} />
}

export function ChevronRight({ size = 14, className }: SystemIconProps) {
  return <ChevronRightIcon size={size} className={className} strokeWidth={1.8} />
}
