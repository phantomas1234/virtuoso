declare module "soundtouchjs" {
  export class SoundTouch {
    pitch: number
    pitchOctaves: number
    pitchSemitones: number
    tempo: number
    rate: number
  }

  export interface SoundTouchSource {
    extract(target: Float32Array, numFrames: number, position?: number): number
    position: number
  }

  export class SimpleFilter {
    constructor(sourceSound: SoundTouchSource, pipe: SoundTouch, callback?: () => void)
    extract(target: Float32Array, numFrames: number): number
    sourcePosition: number
  }
}
