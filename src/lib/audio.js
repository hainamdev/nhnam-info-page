/**
 * Tiện ích xử lý audio cho shadowing: gộp chunk, Float32 -> Int16, đóng gói WAV,
 * và encode base64 để gửi lên Speech-to-Text.
 *
 * Vì sao LINEAR16 chứ không phải webm/opus của MediaRecorder:
 * Safari (macOS + iOS) xuất audio/mp4 (AAC) mà Google Speech-to-Text KHÔNG hỗ trợ.
 * Thu PCM thô rồi tự đóng WAV chạy được mọi trình duyệt và đúng định dạng
 * LINEAR16 16kHz mono mà Google khuyến nghị. Xem docs/shadowing-feature.md §8.2
 */

/**
 * Nối nhiều Float32Array thành một.
 * @param {Float32Array[]} chunks
 * @returns {Float32Array}
 */
export function mergeFloat32(chunks) {
  let total = 0;
  for (let i = 0; i < chunks.length; i++) total += chunks[i].length;

  const out = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    out.set(chunks[i], offset);
    offset += chunks[i].length;
  }
  return out;
}

/**
 * Float32 [-1, 1] -> Int16 PCM.
 * @param {Float32Array} input
 * @returns {Int16Array}
 */
export function floatToInt16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Đóng gói Int16 PCM thành file WAV (RIFF) mono.
 * @param {Int16Array} pcm
 * @param {number} sampleRate
 * @returns {Blob}
 */
export function encodeWav(pcm, sampleRate) {
  const bytesPerSample = 2;
  const channels = 1;
  const dataSize = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");

  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // kích thước block fmt
  view.setUint16(20, 1, true); // 1 = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
  view.setUint16(32, channels * bytesPerSample, true); // block align
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample

  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) view.setInt16(offset, pcm[i], true);

  return new Blob([view], { type: "audio/wav" });
}

/**
 * Uint8Array -> base64.
 * Phải chia khối: String.fromCharCode(...bytes) với mảng lớn sẽ tràn call stack.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase64(bytes) {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return window.btoa(binary);
}

/**
 * Int16 PCM -> base64 (raw, không header) để nhét vào `audio.content` của STT.
 * @param {Int16Array} pcm
 * @returns {string}
 */
export function pcmToBase64(pcm) {
  return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

/**
 * Định dạng giây thành mm:ss (hoặc h:mm:ss nếu dài hơn 1 tiếng).
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
