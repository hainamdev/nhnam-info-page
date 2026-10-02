import { normalizeJa, diffJa, scoreTranscript } from "./diff";

describe("normalizeJa", () => {
  test("bỏ khoảng trắng thường và full-width", () => {
    expect(normalizeJa("日本 の　電車")).toBe("日本の電車");
  });

  test("bỏ dấu câu tiếng Nhật và Latin", () => {
    expect(normalizeJa("とても、正確です。")).toBe("とても正確です");
    expect(normalizeJa("Hello, world!")).toBe("Helloworld");
  });

  test("NFKC gộp full-width và half-width về một dạng", () => {
    expect(normalizeJa("ＡＢＣ")).toBe("ABC");
  });

  test("chuỗi rỗng / null không làm vỡ", () => {
    expect(normalizeJa("")).toBe("");
    expect(normalizeJa(null)).toBe("");
  });
});

describe("diffJa", () => {
  test("hai chuỗi giống hệt -> distance 0, accuracy 1", () => {
    const { distance, accuracy, ops } = diffJa("日本の電車は", "日本の電車は");
    expect(distance).toBe(0);
    expect(accuracy).toBe(1);
    expect(ops).toEqual([{ op: "equal", text: "日本の電車は" }]);
  });

  test("thay một cụm -> op replace kèm expected", () => {
    const { distance, ops } = diffJa("日本の電車は", "日本の電卓は");
    expect(distance).toBe(1);
    expect(ops.map((o) => o.op)).toEqual(["equal", "replace", "equal"]);

    const replaced = ops.find((o) => o.op === "replace");
    expect(replaced.text).toBe("卓");
    expect(replaced.expected).toBe("車");
  });

  test("thiếu ký tự cuối -> op delete", () => {
    const { ops } = diffJa("日本の電車は", "日本の電車");
    expect(ops[ops.length - 1]).toEqual({ op: "delete", text: "は" });
  });

  test("thừa ký tự -> op insert", () => {
    const { ops } = diffJa("電車", "電車です");
    expect(ops[ops.length - 1]).toEqual({ op: "insert", text: "です" });
  });

  test("gộp các op liên tiếp cùng loại thành một", () => {
    const { ops } = diffJa("あいうえお", "あいう");
    expect(ops).toEqual([
      { op: "equal", text: "あいう" },
      { op: "delete", text: "えお" },
    ]);
  });

  test("ops ghép lại đúng chuỗi đọc được (bỏ phần thiếu)", () => {
    const hyp = "日本の電卓は";
    const { ops } = diffJa("日本の電車は", hyp);
    const rebuilt = ops
      .filter((o) => o.op !== "delete")
      .map((o) => o.text)
      .join("");
    expect(rebuilt).toBe(hyp);
  });

  test("transcript rỗng -> accuracy 0", () => {
    const { accuracy, distance } = diffJa("日本の電車は", "");
    expect(distance).toBe(6);
    expect(accuracy).toBe(0);
  });

  test("tách đúng ký tự ngoài BMP (surrogate pair)", () => {
    // 𠮟 nằm ngoài BMP; split("") sẽ cắt đôi surrogate và cho kết quả sai
    const { distance } = diffJa("𠮟る", "𠮟る");
    expect(distance).toBe(0);
  });

  test("cả hai rỗng -> accuracy 1", () => {
    expect(diffJa("", "")).toEqual({ distance: 0, accuracy: 1, ops: [] });
  });
});

describe("scoreTranscript", () => {
  test("khác nhau chỉ ở dấu câu thì vẫn tính là khớp hoàn toàn", () => {
    const score = scoreTranscript("とても時間に正確です。", "とても時間に正確です");
    expect(score.accuracy).toBe(1);
    expect(score.distance).toBe(0);
  });

  test("trả về cả chuỗi đã chuẩn hoá để UI đối chiếu", () => {
    const score = scoreTranscript("日本 の電車は", "日本の電車は");
    expect(score.refNormalized).toBe("日本の電車は");
    expect(score.hypNormalized).toBe("日本の電車は");
    expect(score.diff).toHaveLength(1);
  });

  test("accuracy không bao giờ âm dù transcript dài hơn nhiều", () => {
    const score = scoreTranscript("はい", "まったくちがうぶんしょうです");
    expect(score.accuracy).toBeGreaterThanOrEqual(0);
  });
});
