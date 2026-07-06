/**
 * HyperFrames Composition存储服务
 *
 * 负责管理HyperFrames compositions的持久化存储
 * 使用OPFS（Origin Private File System）存储composition数据
 */

import type { HyperFramesComposition } from '@/types/hyperframes'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Composition存储元数据
 */
export interface CompositionStorageMetadata {
  /** Composition ID */
  id: string
  /** Composition名称 */
  name: string
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 文件大小（字节） */
  fileSize: number
  /** OPFS路径 */
  opfsPath: string
}

/**
 * 存储操作结果
 */
export interface StorageResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// CompositionStorage类
// ============================================================================

/**
 * HyperFrames Composition存储管理器
 *
 * 提供composition的CRUD操作，使用OPFS作为底层存储
 */
export class CompositionStorage {
  /** 存储根目录路径 */
  private static readonly STORAGE_ROOT = 'hyperframes/compositions'

  /** 元数据索引文件名 */
  private static readonly INDEX_FILE = 'index.json'

  /** OPFS根目录句柄缓存 */
  private rootHandle: FileSystemDirectoryHandle | null = null

  /** 元数据索引缓存 */
  private metadataIndex: Map<string, CompositionStorageMetadata> = new Map()

  /**
   * 构造函数
   */
  constructor() {
    // 延迟初始化，在首次使用时获取OPFS访问权限
  }

  /**
   * 初始化存储（获取OPFS根目录）
   */
  private async initialize(): Promise<void> {
    if (this.rootHandle) {
      return
    }

    try {
      // 获取OPFS根目录
      const root = await navigator.storage.getDirectory()

      // 创建hyperframes/compositions目录结构
      const hyperframesDir = await root.getDirectoryHandle('hyperframes', {
        create: true,
      })
      this.rootHandle = await hyperframesDir.getDirectoryHandle('compositions', {
        create: true,
      })

      // 加载元数据索引
      await this.loadMetadataIndex()
    } catch (error) {
      console.error('Failed to initialize CompositionStorage:', error)
      throw new Error('无法初始化存储系统')
    }
  }

  /**
   * 加载元数据索引
   */
  private async loadMetadataIndex(): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('存储未初始化')
    }

    try {
      // 尝试读取索引文件
      const indexFile = await this.rootHandle.getFileHandle(CompositionStorage.INDEX_FILE, {
        create: false,
      })
      const file = await indexFile.getFile()
      const text = await file.text()
      const index = JSON.parse(text) as CompositionStorageMetadata[]

      // 构建索引缓存
      this.metadataIndex.clear()
      for (const metadata of index) {
        this.metadataIndex.set(metadata.id, metadata)
      }
    } catch (error) {
      // 索引文件不存在或读取失败，使用空索引
      console.warn('元数据索引不存在或读取失败，使用空索引')
      this.metadataIndex.clear()
    }
  }

  /**
   * 保存元数据索引
   */
  private async saveMetadataIndex(): Promise<void> {
    if (!this.rootHandle) {
      throw new Error('存储未初始化')
    }

    const index = Array.from(this.metadataIndex.values())
    const text = JSON.stringify(index, null, 2)

    const indexFile = await this.rootHandle.getFileHandle(CompositionStorage.INDEX_FILE, {
      create: true,
    })
    const writable = await indexFile.createWritable()
    await writable.write(text)
    await writable.close()
  }

  /**
   * 保存composition到存储
   *
   * @param composition - 要保存的composition
   * @returns 保存操作结果
   */
  async save(composition: HyperFramesComposition): Promise<StorageResult<string>> {
    try {
      await this.initialize()

      if (!this.rootHandle) {
        return {
          success: false,
          error: '存储未初始化',
        }
      }

      // 生成文件名：{id}.json
      const fileName = `${composition.id}.json`
      const opfsPath = `${CompositionStorage.STORAGE_ROOT}/${fileName}`

      // 序列化composition
      const data = JSON.stringify(composition, null, 2)
      const fileSize = new Blob([data]).size

      // 写入文件
      const fileHandle = await this.rootHandle.getFileHandle(fileName, {
        create: true,
      })
      const writable = await fileHandle.createWritable()
      await writable.write(data)
      await writable.close()

      // 更新元数据索引
      const now = Date.now()
      const metadata: CompositionStorageMetadata = {
        id: composition.id,
        name: composition.name,
        createdAt: composition.createdAt || now,
        updatedAt: now,
        fileSize,
        opfsPath,
      }

      this.metadataIndex.set(composition.id, metadata)
      await this.saveMetadataIndex()

      return {
        success: true,
        data: opfsPath,
      }
    } catch (error) {
      console.error('Failed to save composition:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存失败',
      }
    }
  }

  /**
   * 从存储加载composition
   *
   * @param id - Composition ID
   * @returns 加载操作结果
   */
  async load(id: string): Promise<StorageResult<HyperFramesComposition>> {
    try {
      await this.initialize()

      if (!this.rootHandle) {
        return {
          success: false,
          error: '存储未初始化',
        }
      }

      // 检查元数据索引
      const metadata = this.metadataIndex.get(id)
      if (!metadata) {
        return {
          success: false,
          error: `Composition不存在: ${id}`,
        }
      }

      // 读取文件
      const fileName = `${id}.json`
      const fileHandle = await this.rootHandle.getFileHandle(fileName, {
        create: false,
      })
      const file = await fileHandle.getFile()
      const text = await file.text()
      const composition = JSON.parse(text) as HyperFramesComposition

      return {
        success: true,
        data: composition,
      }
    } catch (error) {
      console.error('Failed to load composition:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '加载失败',
      }
    }
  }

  /**
   * 删除composition
   *
   * @param id - Composition ID
   * @returns 删除操作结果
   */
  async delete(id: string): Promise<StorageResult> {
    try {
      await this.initialize()

      if (!this.rootHandle) {
        return {
          success: false,
          error: '存储未初始化',
        }
      }

      // 检查是否存在
      if (!this.metadataIndex.has(id)) {
        return {
          success: false,
          error: `Composition不存在: ${id}`,
        }
      }

      // 删除文件
      const fileName = `${id}.json`
      await this.rootHandle.removeEntry(fileName)

      // 从元数据索引中移除
      this.metadataIndex.delete(id)
      await this.saveMetadataIndex()

      return {
        success: true,
      }
    } catch (error) {
      console.error('Failed to delete composition:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      }
    }
  }

  /**
   * 列出所有compositions的元数据
   *
   * @returns 所有compositions的元数据列表
   */
  async list(): Promise<StorageResult<CompositionStorageMetadata[]>> {
    try {
      await this.initialize()

      const metadataList = Array.from(this.metadataIndex.values())

      // 按更新时间倒序排列（最新的在前）
      metadataList.sort((a, b) => b.updatedAt - a.updatedAt)

      return {
        success: true,
        data: metadataList,
      }
    } catch (error) {
      console.error('Failed to list compositions:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '列表获取失败',
      }
    }
  }

  /**
   * 检查composition是否存在
   *
   * @param id - Composition ID
   * @returns 是否存在
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.initialize()
      return this.metadataIndex.has(id)
    } catch (error) {
      console.error('Failed to check composition existence:', error)
      return false
    }
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

/**
 * CompositionStorage单例实例
 */
export const compositionStorage = new CompositionStorage()
