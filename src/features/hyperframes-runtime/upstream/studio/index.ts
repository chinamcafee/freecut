export { FileTree } from './components/editor/FileTree'
export { DomEditOverlay, type DomEditOverlayProps } from './components/editor/DomEditOverlay'
export { LayersPanel, type LayersPanelProps } from './components/editor/LayersPanel'
export { PropertyPanel, type PropertyPanelProps } from './components/editor/PropertyPanel'
export { SourceEditor } from './components/editor/SourceEditor'
export {
  CompositionBreadcrumb,
  type CompositionLevel,
} from './components/nle/CompositionBreadcrumb'
export { NLELayout, type NLELayoutProps } from './components/nle/NLELayout'
export { NLEPreview } from './components/nle/NLEPreview'
export { getPreviewPlayerKey, resolvePreviewStageSize } from './components/nle/previewSizing'
export { useTimelinePlayer, type StudioTimelinePlayer } from './player'
export {
  applyPatch,
  applyPatchByTarget,
  findTagByTarget,
  readAttributeByTarget,
  readTagSnippetByTarget,
  resolveSourceFile,
  type PatchOperation,
  type PatchTarget,
} from './utils/sourcePatcher'
export { findElementBlock, mergeStyleIntoTag, parseStyleString } from './utils/htmlEditor'
export {
  applyDomEditOperationsToHtml,
  buildInlineStylePatch,
  buildManualMovePatch,
  buildMotionPathPatch,
  buildTextContentPatch,
  extractDomEditLayers,
  snapPointToGuides,
  sortLayersByVisualStack,
  type DomEditLayerGeometry,
  type DomEditLayerItem,
  type DomEditPatchResult,
  type StudioMotionPathPoint,
  type StudioSnapGuide,
  type StudioSnapResult,
} from './components/editor/studioAdvancedEditing'
