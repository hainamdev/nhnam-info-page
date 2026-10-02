import {
  addLineAtTime,
  closeOpenLineAtTime,
  findOpenLine,
  isOpenLine,
  joinTokens,
  nextLineId,
  removeLine,
  tokensMatchJp,
  updateLine,
} from "./lines";

const line = (id, start, end, jp = "") => ({ id, start, end, jp, tokens: [] });

describe("addLineAtTime", () => {
  test("câu đầu tiên: start = thời điểm hiện tại, end để mở", () => {
    const { lines, error, addedId } = addLineAtTime([], 3.456);
    expect(error).toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines[0].start).toBe(3.46); // làm tròn 2 chữ số
    expect(lines[0].end).toBeNull();
    expect(addedId).toBe(1);
  });

  test("câu tiếp theo đóng câu trước lại tại đúng thời điểm đó", () => {
    const start = addLineAtTime([], 0).lines;
    const { lines, error } = addLineAtTime(start, 11.5);

    expect(error).toBeNull();
    expect(lines).toHaveLength(2);
    expect(lines[0].end).toBe(11.5); // câu trước được đóng
    expect(lines[1].start).toBe(11.5); // câu mới bắt đầu
    expect(lines[1].end).toBeNull();
  });

  test("chặn khi tua lùi trước câu cuối", () => {
    const existing = [line(1, 10, null)];
    const { lines, error, addedId } = addLineAtTime(existing, 5);

    expect(error).toMatch(/không sau câu cuối/);
    expect(addedId).toBeNull();
    expect(lines).toBe(existing); // không đụng vào dữ liệu
  });

  test("chặn khi khoảng quá ngắn (bấm nhầm hai lần)", () => {
    const existing = [line(1, 10, null)];
    const { error, addedId } = addLineAtTime(existing, 10.1);

    expect(error).toMatch(/quá ngắn/);
    expect(addedId).toBeNull();
  });

  test("id không bao giờ dùng lại, kể cả sau khi xoá", () => {
    let lines = addLineAtTime([], 0).lines;
    lines = addLineAtTime(lines, 5).lines;
    lines = addLineAtTime(lines, 10).lines;
    expect(lines.map((l) => l.id)).toEqual([1, 2, 3]);

    lines = removeLine(lines, 3);
    lines = addLineAtTime(lines, 15).lines;
    expect(lines[lines.length - 1].id).toBe(3 + 1 - 1); // max còn lại là 2 -> id mới là 3
  });

  test("không sinh ra câu vi phạm bất biến end > start", () => {
    let lines = [];
    for (const t of [0, 4, 9, 13.5]) {
      const result = addLineAtTime(lines, t);
      if (!result.error) lines = result.lines;
    }
    lines.forEach((l) => {
      if (l.end !== null) expect(l.end).toBeGreaterThan(l.start);
    });
  });
});

describe("closeOpenLineAtTime", () => {
  test("đóng câu đang mở mà không tạo câu mới", () => {
    const existing = [line(1, 0, 6), line(2, 6, null)];
    const { lines, error } = closeOpenLineAtTime(existing, 11.5);

    expect(error).toBeNull();
    expect(lines).toHaveLength(2); // không thêm câu
    expect(lines[1].end).toBe(11.5);
  });

  test("báo lỗi khi không có câu nào đang mở", () => {
    const { error } = closeOpenLineAtTime([line(1, 0, 6)], 10);
    expect(error).toMatch(/Không có câu nào đang mở/);
  });

  test("chặn khi thời điểm không sau lúc câu bắt đầu", () => {
    const existing = [line(1, 10, null)];
    const { lines, error } = closeOpenLineAtTime(existing, 8);
    expect(error).toMatch(/phải sau/);
    expect(lines).toBe(existing);
  });
});

describe("isOpenLine / findOpenLine", () => {
  test("end null hoặc undefined là đang mở", () => {
    expect(isOpenLine({ end: null })).toBe(true);
    expect(isOpenLine({})).toBe(true);
    expect(isOpenLine({ end: 0 })).toBe(false);
    expect(isOpenLine({ end: 6 })).toBe(false);
  });

  test("tìm đúng câu đang mở", () => {
    const lines = [line(1, 0, 6), line(2, 6, null)];
    expect(findOpenLine(lines).id).toBe(2);
    expect(findOpenLine([line(1, 0, 6)])).toBeNull();
  });
});

describe("updateLine / removeLine", () => {
  test("updateLine chỉ sửa đúng câu, trả mảng mới", () => {
    const before = [line(1, 0, 6, "A"), line(2, 6, 10, "B")];
    const after = updateLine(before, 2, { jp: "B2" });

    expect(after).not.toBe(before);
    expect(after[0]).toBe(before[0]); // câu không đổi giữ nguyên tham chiếu
    expect(after[1].jp).toBe("B2");
    expect(before[1].jp).toBe("B"); // không sửa tại chỗ
  });

  test("removeLine KHÔNG tự nối end của câu trước sang câu sau", () => {
    const before = [line(1, 0, 6), line(2, 6, 10), line(3, 10, 15)];
    const after = removeLine(before, 2);

    expect(after.map((l) => l.id)).toEqual([1, 3]);
    expect(after[0].end).toBe(6); // giữ nguyên, để bảng kiểm báo khoảng trống
    expect(after[1].start).toBe(10);
  });
});

describe("tokens", () => {
  test("joinTokens ghép đúng thứ tự", () => {
    expect(joinTokens([{ t: "日本", r: "にほん" }, { t: "の" }, { t: "電車", r: "でんしゃ" }])).toBe(
      "日本の電車"
    );
  });

  test("tokensMatchJp phát hiện lệch", () => {
    expect(tokensMatchJp({ jp: "日本の電車は", tokens: [{ t: "日本の電車は" }] })).toBe(true);
    expect(tokensMatchJp({ jp: "日本の電車は", tokens: [{ t: "日本の電車" }] })).toBe(false);
  });

  test("không có tokens thì coi như hợp lệ (render thẳng jp)", () => {
    expect(tokensMatchJp({ jp: "日本", tokens: [] })).toBe(true);
    expect(tokensMatchJp({ jp: "日本" })).toBe(true);
  });
});

describe("nextLineId", () => {
  test("lớn hơn id lớn nhất hiện có", () => {
    expect(nextLineId([])).toBe(1);
    expect(nextLineId([line(1, 0, 1), line(7, 1, 2)])).toBe(8);
  });
});
