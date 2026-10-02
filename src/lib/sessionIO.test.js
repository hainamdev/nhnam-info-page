import { sanitizeVideo, buildExportPayload } from "./sessionIO";

const ID = "ZcKxZfyEFBc";

const validRaw = () => ({
  schemaVersion: 1,
  videoId: ID,
  url: `https://www.youtube.com/watch?v=${ID}`,
  title: "日本の電車",
  titleVi: "Tàu điện ở Nhật",
  level: "N4",
  tags: ["daily-life"],
  durationSec: 163,
  lines: [
    {
      id: 1,
      start: 0,
      end: 6,
      jp: "日本の電車は",
      kana: "にほんのでんしゃは",
      romaji: "nihon no densha wa",
      vi: "Tàu điện ở Nhật thì…",
      tokens: [{ t: "日本", r: "にほん" }, { t: "の" }, { t: "電車", r: "でんしゃ" }, { t: "は" }],
    },
  ],
});

describe("sanitizeVideo — file hợp lệ", () => {
  test("nhận đúng dữ liệu", () => {
    const { video, problems } = sanitizeVideo(validRaw());
    expect(problems).toEqual([]);
    expect(video.videoId).toBe(ID);
    expect(video.lines).toHaveLength(1);
    expect(video.lineCount).toBe(1);
    expect(video.lines[0].tokens).toHaveLength(4);
  });

  test("chấp nhận câu đang mở (end null) từ phiên soạn dở", () => {
    const raw = validRaw();
    raw.lines[0].end = null;
    const { video, problems } = sanitizeVideo(raw);
    expect(problems).toEqual([]);
    expect(video.lines[0].end).toBeNull();
  });

  test("điền url và thumbnail khi file thiếu", () => {
    const raw = validRaw();
    delete raw.url;
    delete raw.thumbnail;
    const { video } = sanitizeVideo(raw);
    expect(video.url).toContain(ID);
    expect(video.thumbnail).toContain(ID);
  });
});

describe("sanitizeVideo — phải từ chối", () => {
  test("videoId sai định dạng (chống nhét tham số vào URL iframe)", () => {
    const raw = validRaw();
    raw.videoId = "abc&autoplay=1";
    const { video, problems } = sanitizeVideo(raw);
    expect(video).toBeNull();
    expect(problems.join(" ")).toMatch(/videoId/);
  });

  test("thiếu videoId", () => {
    const raw = validRaw();
    delete raw.videoId;
    expect(sanitizeVideo(raw).video).toBeNull();
  });

  test("lines không phải mảng", () => {
    const raw = validRaw();
    raw.lines = "không phải mảng";
    const { video, problems } = sanitizeVideo(raw);
    expect(video).toBeNull();
    expect(problems.join(" ")).toMatch(/lines/);
  });

  test("end <= start", () => {
    const raw = validRaw();
    raw.lines[0].end = 0;
    const { video, problems } = sanitizeVideo(raw);
    expect(video).toBeNull();
    expect(problems.join(" ")).toMatch(/end/);
  });

  test("thiếu jp", () => {
    const raw = validRaw();
    raw.lines[0].jp = "";
    expect(sanitizeVideo(raw).video).toBeNull();
  });

  test("id trùng nhau", () => {
    const raw = validRaw();
    raw.lines.push({ ...raw.lines[0], start: 6, end: 10 });
    const { video, problems } = sanitizeVideo(raw);
    expect(video).toBeNull();
    expect(problems.join(" ")).toMatch(/trùng/);
  });

  test("không phải object", () => {
    expect(sanitizeVideo(null).video).toBeNull();
    expect(sanitizeVideo([]).video).toBeNull();
    expect(sanitizeVideo("chuỗi").video).toBeNull();
  });

  test("quá nhiều câu", () => {
    const raw = validRaw();
    raw.lines = Array.from({ length: 2001 }, (_, i) => ({
      id: i + 1,
      start: i,
      end: i + 0.5,
      jp: "あ",
    }));
    const { video, problems } = sanitizeVideo(raw);
    expect(video).toBeNull();
    expect(problems.join(" ")).toMatch(/Quá nhiều câu/);
  });
});

describe("sanitizeVideo — chép theo danh sách trường cho phép", () => {
  test("bỏ trường lạ ở cấp line", () => {
    const raw = validRaw();
    raw.lines[0].evil = "<script>alert(1)</script>";
    raw.lines[0].onclick = "boom()";
    const { video } = sanitizeVideo(raw);
    expect(video.lines[0]).not.toHaveProperty("evil");
    expect(video.lines[0]).not.toHaveProperty("onclick");
  });

  test("không để khoá __proto__ trong file làm hỏng object", () => {
    const parsed = JSON.parse('{"videoId":"ZcKxZfyEFBc","lines":[],"__proto__":{"polluted":true}}');
    const { video } = sanitizeVideo(parsed);
    expect(video).not.toBeNull();
    expect({}.polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });

  test("bỏ token sai cấu trúc", () => {
    const raw = validRaw();
    raw.lines[0].tokens = [{ t: "日本", r: "にほん" }, { nope: 1 }, "chuỗi", null];
    const { video } = sanitizeVideo(raw);
    expect(video.lines[0].tokens).toEqual([{ t: "日本", r: "にほん" }]);
  });

  test("level lạ thì bỏ trống thay vì giữ nguyên", () => {
    const raw = validRaw();
    raw.level = "N9";
    expect(sanitizeVideo(raw).video.level).toBe("");
  });
});

describe("buildExportPayload", () => {
  test("đồng bộ lại lineCount và không mang theo metadata của phiên", () => {
    const { video } = sanitizeVideo(validRaw());
    video.lineCount = 999; // cố tình để lệch
    const payload = buildExportPayload(video);

    expect(payload.lineCount).toBe(1);
    expect(payload).not.toHaveProperty("autoFlags");
    expect(payload).not.toHaveProperty("sourceName");
    expect(payload.updatedAt).toEqual(expect.any(String));
  });

  test("xuất rồi nhập lại ra đúng dữ liệu cũ", () => {
    const { video } = sanitizeVideo(validRaw());
    const payload = buildExportPayload(video);

    // Mô phỏng ghi file rồi đọc lại
    const roundTripped = sanitizeVideo(JSON.parse(JSON.stringify(payload)));

    expect(roundTripped.problems).toEqual([]);
    expect(roundTripped.video.videoId).toBe(video.videoId);
    expect(roundTripped.video.lines).toEqual(video.lines);
    expect(roundTripped.video.title).toBe(video.title);
  });
});
