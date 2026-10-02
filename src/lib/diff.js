/**
 * So khớp transcript Speech-to-Text với câu gốc tiếng Nhật.
 *
 * ⚠️ Điểm accuracy CHỈ MANG TÍNH THAM KHẢO, không phải thước đo phát âm.
 * Google STT trả về kanji và có thể chọn chữ khác với câu gốc dù người đọc phát âm
 * hoàn toàn đúng (下さい ↔ ください, 時 ↔ とき). Luôn hiện transcript thô cạnh câu gốc
 * để người dùng tự đối chiếu. Xem docs/shadowing-feature.md §8.5
 */

/**
 * Chuẩn hoá trước khi so: bỏ khoảng trắng (kể cả full-width), bỏ dấu câu,
 * thống nhất full-width/half-width. Không chuẩn hoá thì sai oan chỉ vì dấu chấm.
 * @param {string} input
 * @returns {string}
 */
export function normalizeJa(input) {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[、。！？「」『』・,.!?;:]/g, "");
}

/**
 * Levenshtein trên ký tự + backtrace ra danh sách thao tác để tô màu.
 *
 * ref = câu gốc, hyp = transcript nhận dạng được.
 *   equal   : đọc đúng
 *   replace : đọc thành chữ khác
 *   insert  : thừa so với câu gốc
 *   delete  : thiếu, chưa đọc
 *
 * @param {string} ref
 * @param {string} hyp
 * @returns {{distance: number, accuracy: number, ops: Array<{op: string, text: string, expected?: string}>}}
 */
export function diffJa(ref, hyp) {
  // Array.from để tách đúng ký tự Unicode (surrogate pair), không dùng split("")
  const a = Array.from(ref);
  const b = Array.from(hyp);
  const m = a.length;
  const n = b.length;

  if (m === 0 && n === 0) return { distance: 0, accuracy: 1, ops: [] };

  const d = [];
  for (let i = 0; i <= m; i++) {
    d.push(new Uint32Array(n + 1));
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] =
        a[i - 1] === b[j - 1]
          ? d[i - 1][j - 1]
          : 1 + Math.min(d[i - 1][j - 1], d[i - 1][j], d[i][j - 1]);
    }
  }

  const raw = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.push({ op: "equal", ch: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      raw.push({ op: "replace", ch: b[j - 1], expected: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      raw.push({ op: "insert", ch: b[j - 1] });
      j--;
    } else {
      raw.push({ op: "delete", ch: a[i - 1] });
      i--;
    }
  }
  raw.reverse();

  // Gộp các thao tác liên tiếp cùng loại để render ít span hơn
  const ops = [];
  for (const item of raw) {
    const last = ops[ops.length - 1];
    if (last && last.op === item.op) {
      last.text += item.ch;
      if (item.expected) last.expected = (last.expected || "") + item.expected;
    } else {
      ops.push({
        op: item.op,
        text: item.ch,
        ...(item.expected ? { expected: item.expected } : {}),
      });
    }
  }

  const distance = d[m][n];
  const accuracy = Math.max(0, 1 - distance / Math.max(m, 1));
  return { distance, accuracy, ops };
}

/**
 * Chuẩn hoá rồi so — đây là hàm nên dùng từ UI.
 * @param {string} refRaw câu gốc (line.jp)
 * @param {string} hypRaw transcript thô từ STT
 */
export function scoreTranscript(refRaw, hypRaw) {
  const refNormalized = normalizeJa(refRaw);
  const hypNormalized = normalizeJa(hypRaw);
  const { distance, accuracy, ops } = diffJa(refNormalized, hypNormalized);
  return { refNormalized, hypNormalized, distance, accuracy, diff: ops };
}
