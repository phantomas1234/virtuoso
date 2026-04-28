import { SoundTouch, SimpleFilter } from '/soundtouch.js'

class StreamingSource {
  constructor() {
    this.queue = []
    this.position = 0
  }

  extract(target, numFrames) {
    let written = 0
    while (written < numFrames && this.queue.length > 0) {
      const chunk = this.queue[0]
      const chunkFrames = chunk.length / 2
      const take = Math.min(numFrames - written, chunkFrames)
      for (let i = 0; i < take; i++) {
        target[(written + i) * 2] = chunk[i * 2]
        target[(written + i) * 2 + 1] = chunk[i * 2 + 1]
      }
      if (take === chunkFrames) this.queue.shift()
      else this.queue[0] = chunk.slice(take * 2)
      written += take
    }
    this.position += written
    return written
  }

  push(inL, inR) {
    const n = inL.length
    const buf = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      buf[i * 2] = inL[i]
      buf[i * 2 + 1] = inR[i]
    }
    this.queue.push(buf)
  }

  flush() {
    this.queue = []
    this.position = 0
  }
}

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._pitchSemitones = 0
    this._src = new StreamingSource()
    this._st = new SoundTouch()
    this._st.pitchSemitones = 0
    this._st.tempo = 1
    this._filter = new SimpleFilter(this._src, this._st)
    this._outBuf = new Float32Array(128 * 2)

    this.port.onmessage = ({ data }) => {
      if (data.type === 'pitch') {
        this._pitchSemitones = data.semitones
        this._rebuild(data.semitones)
      } else if (data.type === 'flush') {
        this._rebuild(this._pitchSemitones)
      }
    }
  }

  _rebuild(semitones) {
    this._src.flush()
    this._st = new SoundTouch()
    this._st.pitchSemitones = semitones
    this._st.tempo = 1
    this._filter = new SimpleFilter(this._src, this._st)
  }

  process(inputs, outputs) {
    const inp = inputs[0]
    const out = outputs[0]
    if (!inp?.[0]?.length) return true

    const inL = inp[0]
    const inR = inp[1] ?? inp[0]

    this._src.push(inL, inR)
    const extracted = this._filter.extract(this._outBuf, 128)

    const outL = out[0]
    const outR = out[1]
    for (let i = 0; i < extracted; i++) {
      outL[i] = this._outBuf[i * 2]
      if (outR) outR[i] = this._outBuf[i * 2 + 1]
    }
    for (let i = extracted; i < 128; i++) {
      outL[i] = 0
      if (outR) outR[i] = 0
    }

    return true
  }
}

registerProcessor('pitch-processor', PitchProcessor)
