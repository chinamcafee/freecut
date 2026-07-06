/**
 * 迁移系统入口
 *
 * 导出所有迁移相关的功能和类型
 */

// 导出迁移运行器
export {
  MigrationRunner,
  registerMigration,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SCHEMA_VERSION,
} from './migration-runner'
export type { Migration, MigrationFn, MigrationResult } from './migration-runner'

// 导入所有迁移脚本（确保它们被注册）
import './v1-to-v2'
