/**
 * AudioWorklet thu PCM thô cho tính năng shadowing.
 *
 * PHẢI nằm trong public/ — AudioWorklet.addModule() tải file này qua HTTP.
 * Nếu đặt trong src/ thì webpack sẽ bundle và URL không còn tồn tại.
 *
 * Gom mẫu thành khối BLOCK_SIZE rồi mới postMessage, thay vì bắn từng render
 * quantum (128 mẫu ≈ 8ms ở 16kHz) — bắn mỗi quantum sẽ là ~125 message/giây,
 * quá nhiều cho việc cập nhật state React.
 */

const BLOCK_SIZE = 2048; // ≈ 128ms ở 16kHz

class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(BLOCK_SIZE);
    this._len = 0;
    this._closed = false;

    this.port.onmessage = (event) => {
      if (event.data === "flush") {
        // Đẩy nốt phần đuôi chưa đủ BLOCK_SIZE rồi báo đã xong
        this._flush(true);
        this._closed = true;
      }
    };
  }

  _flush(final) {
    if (this._len === 0 && !final) return;

    const samples = this._buf.slice(0, this._len);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] < 0 ? -samples[i] : samples[i];
      if (v > peak) peak = v;
    }
    this._len = 0;

    // Transfer buffer để không phải copy
    this.port.postMessage({ samples: samples, peak: peak, final: !!final }, [samples.buffer]);
  }

  process(inputs) {
    if (this._closed) return false;

    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this._buf[this._len++] = channel[i];
      if (this._len === BLOCK_SIZE) this._flush(false);
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorder);
