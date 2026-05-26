// AudioWorklet that turns the mic's Float32 input into 16 kHz mono PCM16 frames
// for AssemblyAI's streaming API. Downsamples from the context sample rate (a
// no-op when the context already runs at 16 kHz) via linear interpolation and
// posts ~50 ms Int16 chunks to the main thread as transferable ArrayBuffers.
class AssemblyAIPCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    // `sampleRate` is a global available inside the AudioWorkletGlobalScope.
    this.ratio = sampleRate / this.targetRate;
    this.frameSize = 1600; // 100 ms @ 16 kHz (comfortably within AssemblyAI's 50–1000 ms)
    this.leftover = new Float32Array(0); // unconsumed input tail
    this.readPos = 0; // fractional read cursor into `leftover`
    this.out = []; // accumulated Int16 samples awaiting a full frame
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (!channel || channel.length === 0) return true;

    // Prepend any leftover input from the previous block.
    const merged = new Float32Array(this.leftover.length + channel.length);
    merged.set(this.leftover, 0);
    merged.set(channel, this.leftover.length);

    // Resample to 16 kHz with linear interpolation.
    let pos = this.readPos;
    while (pos + 1 < merged.length) {
      const i = pos | 0;
      const frac = pos - i;
      const sample = merged[i] * (1 - frac) + merged[i + 1] * frac;
      const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      this.out.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      pos += this.ratio;
    }

    // Retain the unconsumed tail (we still need merged[consumed] next block).
    const consumed = Math.min(pos | 0, merged.length);
    this.leftover = merged.slice(consumed);
    this.readPos = pos - consumed;

    // Emit complete 50 ms frames.
    while (this.out.length >= this.frameSize) {
      const frame = this.out.splice(0, this.frameSize);
      const pcm = new Int16Array(frame);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor('assemblyai-pcm-worklet', AssemblyAIPCMWorklet);
