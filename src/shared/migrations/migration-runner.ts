/**
 * 项目数据迁移系统
 *
 * 管理项目schema版本升级和数据迁移
 */

import type { Project } from '@/types/project'

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 当前Schema版本
 * 每次添加新的迁移时需要增加这个版本号
 */
export const CURRENT_SCHEMA_VERSION = 2

/**
 * 默认Schema版本（用于没有版本号的旧项目）
 */
export const DEFAULT_SCHEMA_VERSION = 1

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 迁移函数接口
 */
export type MigrationFn = (project: Project) => Project | Promise<Project>

/**
 * 迁移定义
 */
export interface Migration {
  /** 目标版本号 */
  version: number
  /** 迁移描述 */
  description: string
  /** 迁移函数 */
  migrate: MigrationFn
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean
  /** 原始版本 */
  fromVersion: number
  /** 目标版本 */
  toVersion: number
  /** 应用的迁移数量 */
  migrationsApplied: number
  /** 错误信息 */
  error?: string
}

// ============================================================================
// 迁移注册表
// ============================================================================

/**
 * 所有已注册的迁移
 * 按版本号从小到大排序
 */
const MIGRATIONS: Migration[] = []

/**
 * 注册一个迁移
 */
export function registerMigration(migration: Migration): void {
  MIGRATIONS.push(migration)
  // 按版本号排序
  MIGRATIONS.sort((a, b) => a.version - b.version)
}

// ============================================================================
// MigrationRunner类
// ============================================================================

/**
 * 迁移运行器
 *
 * 负责执行项目数据的版本迁移
 */
export class MigrationRunner {
  /**
   * 获取项目的当前schema版本
   */
  static getProjectVersion(project: Project): number {
    return project.schemaVersion ?? DEFAULT_SCHEMA_VERSION
  }

  /**
   * 检查项目是否需要迁移
   */
  static needsMigration(project: Project): boolean {
    const currentVersion = this.getProjectVersion(project)
    return currentVersion < CURRENT_SCHEMA_VERSION
  }

  /**
   * 获取适用于项目的迁移列表
   */
  static getApplicableMigrations(project: Project): Migration[] {
    const currentVersion = this.getProjectVersion(project)
    return MIGRATIONS.filter(
      (m) => m.version > currentVersion && m.version <= CURRENT_SCHEMA_VERSION,
    )
  }

  /**
   * 运行所有需要的迁移
   *
   * @param project - 要迁移的项目
   * @returns 迁移结果
   */
  static async migrate(project: Project): Promise<MigrationResult> {
    const fromVersion = this.getProjectVersion(project)

    // 如果已经是最新版本，直接返回
    if (!this.needsMigration(project)) {
      return {
        success: true,
        fromVersion,
        toVersion: fromVersion,
        migrationsApplied: 0,
      }
    }

    // 获取需要应用的迁移
    const migrations = this.getApplicableMigrations(project)

    if (migrations.length === 0) {
      return {
        success: true,
        fromVersion,
        toVersion: fromVersion,
        migrationsApplied: 0,
      }
    }

    try {
      // 创建项目的副本，避免修改原始对象
      let migratedProject = { ...project }

      // 按顺序应用每个迁移
      for (const migration of migrations) {
        console.log(`应用迁移: v${migration.version} - ${migration.description}`)
        migratedProject = await migration.migrate(migratedProject)
        migratedProject.schemaVersion = migration.version
      }

      // 更新项目引用
      Object.assign(project, migratedProject)

      return {
        success: true,
        fromVersion,
        toVersion: CURRENT_SCHEMA_VERSION,
        migrationsApplied: migrations.length,
      }
    } catch (error) {
      console.error('迁移失败:', error)
      return {
        success: false,
        fromVersion,
        toVersion: fromVersion,
        migrationsApplied: 0,
        error: error instanceof Error ? error.message : '迁移失败',
      }
    }
  }
}
