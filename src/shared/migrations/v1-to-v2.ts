/**
 * 项目Schema v1 到 v2 的迁移
 *
 * 变更内容：
 * - 添加hyperframes字段支持
 * - 初始化空的hyperframes配置
 */

import type { Project } from '@/types/project'
import { registerMigration } from './migration-runner'

/**
 * v1 到 v2 迁移函数
 *
 * 为现有项目添加hyperframes字段的初始化结构
 */
function migrateV1ToV2(project: Project): Project {
  // 如果已经有hyperframes字段，直接返回
  if (project.hyperframes) {
    return project
  }

  // 添加空的hyperframes配置
  return {
    ...project,
    hyperframes: {
      compositions: {},
      skills: {
        enabled: [],
        history: [],
      },
      renderConfig: {
        engine: 'freecut',
        quality: 'production',
      },
    },
  }
}

// 注册迁移
registerMigration({
  version: 2,
  description: '添加HyperFrames集成支持',
  migrate: migrateV1ToV2,
})
