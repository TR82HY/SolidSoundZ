export type Settings = {
  inputGain: number      // dB
  lowCut: number         // Hz (20 = off)
  eq: number[]           // dB per band
  megaBass: number       // dB boost around 55 Hz
  drive: number          // saturation 0..100
  satMix: number         // saturation wet %
  compThreshold: number  // dB
  compRatio: number
  compAttack: number     // ms
  compRelease: number    // ms
  compKnee: number       // dB
  makeup: number         // dB
  width: number          // stereo width %
  outputGain: number     // dB (set by loudness matching)
  ceiling: number        // dBFS limiter ceiling
}

export const EQ_BANDS = [
  { f: 60, type: 'lowshelf', label: 'Sub/Low' },
  { f: 250, type: 'peaking', label: 'Low-Mid' },
  { f: 1000, type: 'peaking', label: 'Mid' },
  { f: 4000, type: 'peaking', label: 'Presence' },
  { f: 12000, type: 'highshelf', label: 'Air' },
] as const

export const DEFAULTS: Settings = {
  inputGain: 0, lowCut: 20, eq: [0, 0, 0, 0, 0], megaBass: 0, drive: 0, satMix: 100,
  compThreshold: -18, compRatio: 2, compAttack: 20, compRelease: 200, compKnee: 6, makeup: 0,
  width: 100, outputGain: 0, ceiling: -1,
}

export function parseStudioSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved Studio settings')
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  const settings = { ...DEFAULTS, eq: [...DEFAULTS.eq] }
  const bounds = [
    ['inputGain', -12, 12], ['lowCut', 20, 200], ['megaBass', 0, 12],
    ['drive', 0, 100], ['satMix', 0, 100], ['compThreshold', -48, 0],
    ['compRatio', 1, 20], ['compAttack', 0.5, 100], ['compRelease', 20, 1000],
    ['compKnee', 0, 30], ['makeup', -12, 12], ['width', 0, 200],
    ['outputGain', -12, 24], ['ceiling', -3, 0],
  ] as const
  for (const [key, min, max] of bounds) {
    if (!(key in data)) continue
    const number = data[key]
    if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max) {
      throw new Error('Invalid saved Studio settings')
    }
    settings[key] = number
  }
  if ('eq' in data) {
    if (!Array.isArray(data.eq) || data.eq.length !== EQ_BANDS.length
      || data.eq.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < -12 || value > 12)) {
      throw new Error('Invalid saved Studio equalizer settings')
    }
    settings.eq = data.eq.map(value => Number(value))
  }
  return settings
}

export const PRESETS: Record<string, Partial<Settings>> = {
  Transparent: { lowCut: 25, eq: [0.5, 0, 0, 0.5, 1], drive: 0, compThreshold: -16, compRatio: 1.5, compAttack: 30, compRelease: 250, width: 100 },
  'Hip-Hop': { lowCut: 28, eq: [3, -1.5, 0, 1.5, 2], megaBass: 2, drive: 20, satMix: 60, compThreshold: -20, compRatio: 3, compAttack: 15, compRelease: 180, width: 110 },
  Trap: { lowCut: 25, eq: [4, -2, -0.5, 2, 3], megaBass: 5, drive: 30, satMix: 60, compThreshold: -22, compRatio: 4, compAttack: 10, compRelease: 120, width: 120 },
  EDM: { lowCut: 30, eq: [3, -1, 0, 2, 3.5], megaBass: 3, drive: 35, satMix: 55, compThreshold: -22, compRatio: 4, compAttack: 8, compRelease: 100, width: 130 },
  Pop: { lowCut: 30, eq: [1.5, -1, 0.5, 2, 3], drive: 15, satMix: 50, compThreshold: -18, compRatio: 2.5, compAttack: 20, compRelease: 160, width: 115 },
  'Lo-Fi': { lowCut: 40, eq: [2, 1, 0, -2, -5], drive: 45, satMix: 70, compThreshold: -20, compRatio: 3, compAttack: 30, compRelease: 300, width: 85 },
  Rock: { lowCut: 35, eq: [1.5, -1, 1, 2.5, 1.5], drive: 30, satMix: 50, compThreshold: -18, compRatio: 3, compAttack: 15, compRelease: 150, width: 110 },
  'Vocal/Podcast': { lowCut: 80, eq: [-2, -1.5, 1, 3, 1.5], drive: 5, satMix: 40, compThreshold: -24, compRatio: 4, compAttack: 5, compRelease: 120, width: 60 },
}

export const TARGETS = [
  { label: 'Spotify / YouTube (-14 LUFS)', lufs: -14 },
  { label: 'Apple Music (-16 LUFS)', lufs: -16 },
  { label: 'Loud (-11 LUFS)', lufs: -11 },
  { label: 'Club (-8 LUFS)', lufs: -8 },
]

export const dbToLin = (db: number) => 10 ** (db / 20)

function satCurve(drive: number) {
  const n = 2048, k = 1 + (drive / 100) * 8, norm = Math.tanh(k)
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm }
  return c
}

// Hard clip at the ceiling as a final safety net after the limiter.
function clipCurve(ceiling: number) {
  const n = 4097, c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.max(-ceiling, Math.min(ceiling, x)) }
  return c
}

export type Chain = { input: GainNode, output: GainNode, trim: GainNode, set: (s: Settings) => void }

// Input -> low cut -> 5-band EQ -> mega bass -> saturation -> compressor -> makeup -> stereo width -> output gain -> limiter -> clipper -> trim
export function buildChain(ctx: BaseAudioContext): Chain {
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n }
  const input = g()
  input.channelCount = 2; input.channelCountMode = 'explicit'; input.channelInterpretation = 'speakers'

  const lowCut = ctx.createBiquadFilter(); lowCut.type = 'highpass'; lowCut.Q.value = 0.707
  const eq = EQ_BANDS.map(b => { const f = ctx.createBiquadFilter(); f.type = b.type; f.frequency.value = b.f; if (b.type === 'peaking') f.Q.value = 0.9; return f })
  const sub = ctx.createBiquadFilter(); sub.type = 'peaking'; sub.frequency.value = 55; sub.Q.value = 1.1

  const satIn = g(), satDry = g(), satWet = g(0), satOut = g()
  const shaper = ctx.createWaveShaper(); shaper.oversample = '4x'

  const comp = ctx.createDynamicsCompressor()
  const makeup = g()

  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2)
  const ll = g(), lr = g(0), rl = g(0), rr = g()

  const out = g()
  const limiter = ctx.createDynamicsCompressor(); limiter.ratio.value = 20; limiter.knee.value = 0; limiter.attack.value = 0.001; limiter.release.value = 0.08
  const clipper = ctx.createWaveShaper()
  const trim = g(), output = g()

  input.connect(lowCut)
  let node: AudioNode = lowCut
  for (const f of eq) { node.connect(f); node = f }
  node.connect(sub).connect(satIn)
  satIn.connect(satDry).connect(satOut)
  satIn.connect(shaper).connect(satWet).connect(satOut)
  satOut.connect(comp).connect(makeup).connect(split)
  split.connect(ll, 0); split.connect(lr, 0); split.connect(rl, 1); split.connect(rr, 1)
  ll.connect(merge, 0, 0); rl.connect(merge, 0, 0); lr.connect(merge, 0, 1); rr.connect(merge, 0, 1)
  merge.connect(out).connect(limiter).connect(clipper).connect(trim).connect(output)

  let lastDrive = -1, lastCeiling = NaN
  const set = (s: Settings) => {
    input.gain.value = dbToLin(s.inputGain)
    lowCut.frequency.value = s.lowCut
    eq.forEach((f, i) => { f.gain.value = s.eq[i] ?? 0 })
    sub.gain.value = s.megaBass
    if (s.drive !== lastDrive) { shaper.curve = satCurve(s.drive); lastDrive = s.drive }
    const wet = s.drive > 0 ? s.satMix / 100 : 0
    satWet.gain.value = wet; satDry.gain.value = 1 - wet
    comp.threshold.value = s.compThreshold; comp.ratio.value = s.compRatio
    comp.attack.value = s.compAttack / 1000; comp.release.value = s.compRelease / 1000; comp.knee.value = s.compKnee
    makeup.gain.value = dbToLin(s.makeup)
    const w = s.width / 100, a = (1 + w) / 2, b = (1 - w) / 2
    ll.gain.value = a; rr.gain.value = a; lr.gain.value = b; rl.gain.value = b
    out.gain.value = dbToLin(s.outputGain)
    limiter.threshold.value = s.ceiling - 0.5
    if (s.ceiling !== lastCeiling) { clipper.curve = clipCurve(dbToLin(s.ceiling)); lastCeiling = s.ceiling }
  }
  return { input, output, trim, set }
}

export async function renderMaster(buf: AudioBuffer, s: Settings) {
  const off = new OfflineAudioContext(2, buf.length, buf.sampleRate)
  const src = off.createBufferSource()
  src.buffer = buf
  const chain = buildChain(off)
  chain.set(s)
  src.connect(chain.input)
  chain.output.connect(off.destination)
  src.start()
  return off.startRendering()
}
