import { SoundTouch } from '/soundtouch.js'

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._pitchSemitones = 0
    this._st = this._makeST(0)
    this._inBuf = new Float32Array(128 * 2)
    this._outBuf = new Float32Array(128 * 2)

    this.port.onmessage = ({ data }) => {
      if (data.type === 'pitch') {
        this._pitchSemitones = data.semitones
        this._st = this._makeST(data.semitones)
      } else if (data.type === 'flush') {
        this._st = this._makeST(this._pitchSemitones)
      }
    }
  }

  _makeST(semitones) {
    const st = new SoundTouch()
    st.pitchSemitones = semitones
    return st
  }

  process(inputs, outputs) {
    const inp = inputs[0]
    const out = outputs[0]
    if (!inp?.[0]?.length) return true

    const inL = inp[0]
    const inR = inp[1] ?? inp[0]
    const n = inL.length

    for (let i = 0; i < n; i++) {
      this._inBuf[i * 2] = inL[i]
      this._inBuf[i * 2 + 1] = inR[i]
    }
    this._st.inputBuffer.putSamples(this._inBuf, 0, n)
    this._st.process()

    const available = this._st.outputBuffer.frameCount
    const outL = out[0]
    const outR = out[1]

    if (available >= n) {
      this._st.outputBuffer.receiveSamples(this._outBuf, n)
      for (let i = 0; i < n; i++) {
        outL[i] = this._outBuf[i * 2]
        if (outR) outR[i] = this._outBuf[i * 2 + 1]
      }
    } else {
      outL.fill(0)
      if (outR) outR.fill(0)
    }

    return true
  }
}

registerProcessor('pitch-processor', PitchProcessor)
