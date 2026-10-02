import { parseYouTubeId, isValidVideoId } from "./youtubeUrl";

const ID = "ZcKxZfyEFBc";

describe("parseYouTubeId — các dạng link hợp lệ", () => {
  test.each([
    ["ID trần", ID],
    ["watch", `https://www.youtube.com/watch?v=${ID}`],
    ["watch không www", `https://youtube.com/watch?v=${ID}`],
    ["watch kèm tham số khác", `https://www.youtube.com/watch?v=${ID}&t=42s&list=PLabc`],
    ["tham số v không đứng đầu", `https://www.youtube.com/watch?t=42s&v=${ID}`],
    ["youtu.be", `https://youtu.be/${ID}`],
    ["youtu.be kèm tham số", `https://youtu.be/${ID}?t=42`],
    ["embed", `https://www.youtube.com/embed/${ID}`],
    ["shorts", `https://www.youtube.com/shorts/${ID}`],
    ["live", `https://www.youtube.com/live/${ID}`],
    ["mobile", `https://m.youtube.com/watch?v=${ID}`],
    ["nocookie", `https://www.youtube-nocookie.com/embed/${ID}`],
    ["thiếu scheme", `youtube.com/watch?v=${ID}`],
    ["thiếu scheme youtu.be", `youtu.be/${ID}`],
    ["có khoảng trắng thừa", `  https://youtu.be/${ID}  `],
  ])("%s", (_label, input) => {
    expect(parseYouTubeId(input)).toBe(ID);
  });
});

describe("parseYouTubeId — phải từ chối", () => {
  test.each([
    ["rỗng", ""],
    ["null", null],
    ["undefined", undefined],
    ["chuỗi linh tinh", "không phải link"],
    ["id quá ngắn", "abc123"],
    ["id quá dài", "ZcKxZfyEFBcXXXX"],
    ["id có ký tự lạ", "ZcKxZfyEFB!"],
    ["host khác", "https://vimeo.com/123456789"],
    ["host giả mạo", "https://youtube.com.evil.com/watch?v=ZcKxZfyEFBc"],
    ["watch thiếu v", "https://www.youtube.com/watch"],
    ["đường dẫn lạ", "https://www.youtube.com/feed/subscriptions"],
  ])("%s", (_label, input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });

  test("từ chối scheme javascript", () => {
    expect(parseYouTubeId("javascript:alert(1)")).toBeNull();
  });

  test("không nhận id chứa ký tự làm hỏng URL nhúng", () => {
    // Nếu lọt, videoId sẽ ghép vào URL iframe và nhét thêm được tham số
    expect(parseYouTubeId("abc&autoplay=1")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=abc&autoplay=1")).toBeNull();
  });
});

describe("isValidVideoId", () => {
  test("đúng 11 ký tự hợp lệ", () => {
    expect(isValidVideoId(ID)).toBe(true);
    expect(isValidVideoId("a_b-c1234_5")).toBe(true);
  });

  test("từ chối mọi thứ khác", () => {
    expect(isValidVideoId("")).toBe(false);
    expect(isValidVideoId("abc")).toBe(false);
    expect(isValidVideoId(null)).toBe(false);
    expect(isValidVideoId(12345678901)).toBe(false);
    expect(isValidVideoId("ZcKxZfyEFB/")).toBe(false);
  });
});
