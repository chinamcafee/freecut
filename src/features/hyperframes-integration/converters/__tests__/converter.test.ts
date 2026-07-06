/**
 * FreeCutToHyperFramesConverter 基础测试
 */

import { describe, expect, it } from 'vite-plus/test'
import { FreeCutToHyperFramesConverter } from '../FreeCutToHyperFramesConverter'

describe('FreeCutToHyperFramesConverter', () => {
  const converter = new FreeCutToHyperFramesConverter()

  describe('基础功能', () => {
    it('应该能创建转换器实例', () => {
      expect(converter).toBeDefined()
    })

    it('应该有convert方法', () => {
      expect(typeof converter.convert).toBe('function')
    })
  })
})
