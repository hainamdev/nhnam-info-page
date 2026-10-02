/**
 * Thao tác trên mảng lines khi soạn bài.
 *
 * Mọi hàm ở đây đều THUẦN: nhận mảng cũ, trả mảng mới. Không sửa tại chỗ để React
 * nhận ra thay đổi và để undo sau này (nếu làm) không phải viết lại.
 */

/** Khoảng tối thiểu giữa hai câu (giây). Ngắn hơn là chắc chắn bấm nhầm. */
export const MIN_LINE_SECONDS = 0.3;

const round2 = (n) => Math.round(n * 100) / 100;

/** Câu "đang mở" = chưa chốt end. */
export function isOpenLine(line) {
  return !!line && (line.end === null || line.end === undefined);
}

export function findOpenLine(lines) {
  return (lines || []).find(isOpenLine) || null;
}

export function nextLineId(lines) {
  // id không bao giờ dùng lại — shadowing_attempts tham chiếu tới nó
  return (lines || []).reduce((max, line) => Math.max(max, Number(line.id) || 0), 0) + 1;
}

export function emptyLine(id, start) {
  return {
    id,
    start: round2(start),
    end: null,
    jp: "",
    kana: "",
    romaji: "",
    vi: "",
    tokens: [],
    note: "",
  };
}

/**
 * Thêm câu tại thời điểm hiện tại của video.
 * Câu phía trên (nếu có) được đóng lại tại đúng thời điểm này.
 *
 * @returns {{lines: Array, error: string|null, addedId: number|null}}
 */
export function addLineAtTime(lines, currentTime) {
  const list = Array.isArray(lines) ? lines : [];
  const t = round2(currentTime);
  const last = list[list.length - 1];

  if (last) {
    if (t <= last.start) {
      return {
        lines: list,
        addedId: null,
        error: `Thời điểm hiện tại (${t.toFixed(2)}s) không sau câu cuối (bắt đầu ${last.start.toFixed(
          2
        )}s). Tua tới quá câu cuối rồi thêm, hoặc sửa mốc trong bảng.`,
      };
    }
    if (t - last.start < MIN_LINE_SECONDS) {
      return {
        lines: list,
        addedId: null,
        error: `Khoảng quá ngắn (< ${MIN_LINE_SECONDS}s). Để video chạy thêm rồi bấm.`,
      };
    }
  }

  const id = nextLineId(list);
  const closed = last ? list.map((l, i) => (i === list.length - 1 ? { ...l, end: t } : l)) : list;

  return { lines: [...closed, emptyLine(id, t)], addedId: id, error: null };
}

/**
 * Chốt end cho câu đang mở mà KHÔNG tạo câu mới.
 * Dùng cho câu cuối, hoặc khi sau câu này là khoảng lặng.
 */
export function closeOpenLineAtTime(lines, currentTime) {
  const list = Array.isArray(lines) ? lines : [];
  const open = findOpenLine(list);
  if (!open) return { lines: list, error: "Không có câu nào đang mở." };

  const t = round2(currentTime);
  if (t <= open.start) {
    return {
      lines: list,
      error: `Thời điểm hiện tại (${t.toFixed(2)}s) phải sau lúc câu bắt đầu (${open.start.toFixed(
        2
      )}s).`,
    };
  }

  return {
    lines: list.map((l) => (l.id === open.id ? { ...l, end: t } : l)),
    error: null,
  };
}

export function updateLine(lines, id, patch) {
  return (lines || []).map((line) => (line.id === id ? { ...line, ...patch } : line));
}

/**
 * Xoá câu. KHÔNG tự nối end của câu trước sang câu sau — để nguyên và báo thành
 * khoảng trống trong bảng kiểm. Tự sửa dữ liệu lân cận là loại hành vi gây mất niềm tin.
 */
export function removeLine(lines, id) {
  return (lines || []).filter((line) => line.id !== id);
}

export function sortLines(lines) {
  return [...(lines || [])].sort((a, b) => a.start - b.start);
}

/** Ghép tokens lại thành chuỗi — dùng để kiểm bất biến jp === tokens.join("") */
export function joinTokens(tokens) {
  return (tokens || []).map((token) => token.t).join("");
}

/** Tokens có khớp với jp không. Không có tokens thì coi như hợp lệ (sẽ render thẳng jp). */
export function tokensMatchJp(line) {
  if (!line || !Array.isArray(line.tokens) || line.tokens.length === 0) return true;
  return joinTokens(line.tokens) === line.jp;
}
