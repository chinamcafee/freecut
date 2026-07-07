import type { Project } from '@/types/project'

export function createHyperFramesConverterTestProject(): Project {
  return {
    id: 'project-1',
    name: 'Launch Cut',
    description: '',
    createdAt: 1,
    updatedAt: 2,
    duration: 120,
    metadata: {
      width: 1920,
      height: 1080,
      fps: 30,
      backgroundColor: '#101010',
    },
    timeline: {
      tracks: [
        {
          id: 'video-track',
          name: 'Video',
          kind: 'video',
          height: 80,
          locked: false,
          visible: true,
          muted: false,
          solo: false,
          order: 0,
        },
      ],
      items: [
        {
          id: 'title',
          trackId: 'video-track',
          from: 15,
          durationInFrames: 45,
          label: 'Title',
          type: 'text',
          text: 'Ship faster',
          fontSize: 48,
          fontFamily: 'Inter',
          color: '#ffffff',
          transform: {
            x: 120,
            y: 160,
            opacity: 0.85,
          },
        },
        {
          id: 'clip',
          trackId: 'video-track',
          from: 60,
          durationInFrames: 60,
          label: 'Clip',
          type: 'video',
          src: '/media/launch.mp4',
          sourceWidth: 1920,
          sourceHeight: 1080,
          sourceDuration: 300,
          sourceFps: 30,
          audioEqLowGainDb: 2,
          volume: 0.7,
        },
      ],
      keyframes: [
        {
          itemId: 'title',
          properties: [
            {
              property: 'x',
              keyframes: [
                { id: 'kf-1', frame: 15, value: 120, easing: 'linear' },
                { id: 'kf-2', frame: 60, value: 320, easing: 'ease-out' },
              ],
            },
          ],
        },
      ],
    },
  }
}
