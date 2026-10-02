import { useMemo, useRef } from "react";

/**
 * Map thời gian hiện tại của video sang câu phụ đề đang hiển thị.
 *
 * Dùng con trỏ tăng dần thay vì quét lại từ đầu mỗi lần. Thuật toán vẫn cho kết quả
 * đúng với bất kỳ giá trị gợi ý nào (kể cả khi React render lại hai lần ở StrictMode):
 * nếu currentTime < lines[hint].start thì reset về 0; còn nếu currentTime >=
 * lines[hint].start thì do lines sắp tăng dần và không chồng lấn, câu đúng chắc chắn
 * nằm từ hint trở đi.
 *
 * @param {Array} lines
 * @param {number} currentTime
 */
export function useActiveLine(lines, currentTime) {
  const hintRef = useRef(0);

  return useMemo(() => {
    const empty = {
      index: -1,
      line: null,
      isInside: false,
      elapsed: 0,
      duration: 0,
      progress: 0,
      hasPrev: false,
      hasNext: false,
    };

    if (!Array.isArray(lines) || lines.length === 0) return empty;

    // Câu đang soạn dở chưa có end -> coi như kéo dài vô tận, nếu không `t >= null`
    // sẽ thành `t >= 0` và luôn đúng, làm con trỏ nhảy qua mất
    const endOf = (line) => (typeof line.end === "number" ? line.end : Infinity);

    let i = hintRef.current;
    if (i < 0 || i >= lines.length || currentTime < lines[i].start) i = 0;
    while (i < lines.length - 1 && currentTime >= endOf(lines[i])) i++;
    hintRef.current = i;

    const line = lines[i];
    const rawDuration = endOf(line) - line.start;
    const duration = Number.isFinite(rawDuration) ? rawDuration : 0;
    const elapsed = duration > 0 ? Math.min(Math.max(currentTime - line.start, 0), duration) : 0;

    return {
      index: i,
      line,
      // false khi đang ở khoảng lặng giữa hai câu -> UI làm mờ câu cũ thay vì để trống
      isInside: currentTime >= line.start && currentTime < endOf(line),
      elapsed,
      duration,
      progress: duration > 0 ? elapsed / duration : 0,
      hasPrev: i > 0,
      hasNext: i < lines.length - 1,
    };
  }, [lines, currentTime]);
}
