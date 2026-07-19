import { parseHyperFramesSkillsCatalog } from '../bridges/skills-bridge/skillDirectoryParser'

const skillModules = import.meta.glob<string>('../upstream/skills/*/SKILL.md', {
  eager: true,
  import: 'default',
  query: '?raw',
})

export const hyperFramesUiSkillCatalog = parseHyperFramesSkillsCatalog({
  rootPath: 'src/features/hyperframes-runtime/upstream/skills',
  files: Object.entries(skillModules).map(([path, content]) => ({
    path: path.replace('../upstream/skills/', ''),
    content,
  })),
})
