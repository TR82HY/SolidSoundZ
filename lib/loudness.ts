// Integrated loudness per ITU-R BS.1770 / EBU R128 (K-weighting, 400 ms blocks, absolute + relative gating).
export async function measureLoudness(buf: AudioBuffer) {
  const rate = buf.sampleRate
  const off = new OfflineAudioContext(buf.numberOfChannels, buf.length, rate)
  const src = off.createBufferSource()
  src.buffer = buf
  const shelf = off.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1681.97; shelf.gain.value = 4
  const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38.13; hp.Q.value = 0.5
  src.connect(shelf).connect(hp).connect(off.destination)
  src.start()
  const k = await off.startRendering()

  // Sum squares per 100 ms hop; a 400 ms block is 4 consecutive hops.
  const hop = Math.round(rate * 0.1)
  const hops = Math.floor(k.length / hop)
  const hopSums = new Float64Array(hops)
  for (let c = 0; c < k.numberOfChannels; c++) {
    const d = k.getChannelData(c)
    for (let h = 0; h < hops; h++) {
      let s = 0
      for (let i = h * hop, end = i + hop; i < end; i++) s += d[i] * d[i]
      hopSums[h] += s
    }
  }
  const blocks: number[] = []
  for (let h = 0; h + 4 <= hops; h++) blocks.push((hopSums[h] + hopSums[h + 1] + hopSums[h + 2] + hopSums[h + 3]) / (hop * 4))
  const lufsOf = (ms: number) => -0.691 + 10 * Math.log10(ms || 1e-12)

  const abs = blocks.filter(b => lufsOf(b) > -70)
  let lufs = -70
  if (abs.length) {
    const rel = lufsOf(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
    const gated = abs.filter(b => lufsOf(b) > rel)
    if (gated.length) lufs = lufsOf(gated.reduce((a, b) => a + b, 0) / gated.length)
  }

  let peak = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v }
  }
  return { lufs, peakDb: 20 * Math.log10(peak || 1e-9) }
}
