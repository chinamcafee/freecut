export interface TimelineElement {
  id: string
  label?: string
  start: number
  duration: number
  track?: number
  domId?: string
  expandedParentStart?: number
}
