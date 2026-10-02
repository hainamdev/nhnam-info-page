/**
 * Dữ liệu bài học shadowing.
 *
 * ⚠️  NỘI DUNG PHỤ ĐỀ DƯỚI ĐÂY LÀ MẪU — CHƯA PHẢI TRANSCRIPT THẬT CỦA VIDEO.
 *     Mốc thời gian và câu chữ được đặt tạm để dựng giao diện. Hãy mở /shadowing ở
 *     chế độ dev, dùng panel "Công cụ dò mốc" ở cuối trang để chép mốc thật rồi
 *     thay vào đây.
 *
 * Shape của object này KHỚP CHÍNH XÁC document Firestore `shadowing_videos/{videoId}`
 * (xem docs/shadowing-feature.md §7). Nhờ vậy khi chuyển sang Firestore chỉ phải đổi
 * `useShadowingSession`, không component nào phải sửa.
 *
 * Bất biến bắt buộc (được kiểm bằng validateVideo() ở dev):
 *   - lines sắp tăng dần theo start, end > start, không chồng lấn
 *   - jp === tokens.map(t => t.t).join("")
 */

/**
 * @typedef {Object} ShadowingToken
 * @property {string} t  - đoạn text
 * @property {string} [r] - furigana, chỉ có khi t là kanji
 */

/**
 * @typedef {Object} ShadowingLine
 * @property {number} id
 * @property {number} start - giây
 * @property {number} end   - giây
 * @property {string} jp
 * @property {string} [kana]
 * @property {string} [romaji]
 * @property {string} [vi]
 * @property {ShadowingToken[]} [tokens]
 * @property {string} [note]
 */

export const SCHEMA_VERSION = 1;

const trainVideo = {
  schemaVersion: SCHEMA_VERSION,

  videoId: "ZcKxZfyEFBc",
  provider: "youtube",
  url: "https://www.youtube.com/watch?v=ZcKxZfyEFBc",
  thumbnail: "https://i.ytimg.com/vi/ZcKxZfyEFBc/hqdefault.jpg",
  durationSec: 0, // 0 = lấy từ player khi onReady

  title: "日本の電車",
  titleVi: "Tàu điện ở Nhật",
  level: "N4",
  tags: ["daily-life", "transport"],
  sourceChannel: "",

  lines: [
    {
      id: 1,
      start: 0,
      end: 6,
      jp: "日本の電車は",
      kana: "にほんのでんしゃは",
      romaji: "nihon no densha wa",
      vi: "Tàu điện ở Nhật thì…",
      tokens: [
        { t: "日本", r: "にほん" },
        { t: "の" },
        { t: "電車", r: "でんしゃ" },
        { t: "は" },
      ],
      note: "",
    },
    {
      id: 2,
      start: 6,
      end: 11.5,
      jp: "とても時間に正確です。",
      kana: "とてもじかんにせいかくです",
      romaji: "totemo jikan ni seikaku desu",
      vi: "rất đúng giờ.",
      tokens: [
        { t: "とても" },
        { t: "時間", r: "じかん" },
        { t: "に" },
        { t: "正確", r: "せいかく" },
        { t: "です。" },
      ],
      note: "正確（せいかく）= chính xác, đúng",
    },
    {
      id: 3,
      start: 11.5,
      end: 17.2,
      jp: "一分でも遅れると、お詫びの放送が流れます。",
      kana: "いっぷんでもおくれると、おわびのほうそうがながれます",
      romaji: "ippun demo okureru to, owabi no housou ga nagaremasu",
      vi: "Chỉ cần trễ một phút là có thông báo xin lỗi phát ra.",
      tokens: [
        { t: "一分", r: "いっぷん" },
        { t: "でも" },
        { t: "遅", r: "おく" },
        { t: "れると、" },
        { t: "お" },
        { t: "詫", r: "わ" },
        { t: "びの" },
        { t: "放送", r: "ほうそう" },
        { t: "が" },
        { t: "流", r: "なが" },
        { t: "れます。" },
      ],
      note: "Okurigana: chỉ gắn furigana cho phần kanji 遅 / 流",
    },
    {
      id: 4,
      start: 17.2,
      end: 23,
      jp: "朝のラッシュは本当に混みます。",
      kana: "あさのラッシュはほんとうにこみます",
      romaji: "asa no rasshu wa hontou ni komimasu",
      vi: "Giờ cao điểm buổi sáng thì đông kinh khủng.",
      tokens: [
        { t: "朝", r: "あさ" },
        { t: "のラッシュは" },
        { t: "本当", r: "ほんとう" },
        { t: "に" },
        { t: "混", r: "こ" },
        { t: "みます。" },
      ],
      note: "",
    },
    {
      id: 5,
      start: 23,
      end: 29.5,
      jp: "駅員さんが乗客を押して乗せることもあります。",
      kana: "えきいんさんがじょうきゃくをおしてのせることもあります",
      romaji: "ekiin san ga joukyaku wo oshite noseru koto mo arimasu",
      vi: "Có khi nhân viên nhà ga còn đẩy khách lên tàu.",
      tokens: [
        { t: "駅員", r: "えきいん" },
        { t: "さんが" },
        { t: "乗客", r: "じょうきゃく" },
        { t: "を" },
        { t: "押", r: "お" },
        { t: "して" },
        { t: "乗", r: "の" },
        { t: "せることもあります。" },
      ],
      note: "",
    },
  ],

  visibility: "private",
  ownerUid: "",
  createdAt: null,
  updatedAt: null,
};

// lineCount denormalize — giữ đồng bộ tự động để không lệch với mảng lines
trainVideo.lineCount = trainVideo.lines.length;

export const shadowingVideos = [trainVideo];
export const defaultVideoId = trainVideo.videoId;

/**
 * Kiểm tra các bất biến của data. Chỉ chạy ở dev — lỗi mốc thời gian nhập tay
 * rất khó phát hiện bằng mắt nên để máy soi hộ.
 * @param {object} video
 * @returns {string[]} danh sách cảnh báo (rỗng = hợp lệ)
 */
export function validateVideo(video) {
  const problems = [];
  if (!video || !Array.isArray(video.lines)) return ["Video không có mảng lines"];

  video.lines.forEach((line, i) => {
    const tag = `line ${line.id ?? i}`;

    if (typeof line.start !== "number") {
      problems.push(`${tag}: start phải là number`);
    } else if (line.end === null || line.end === undefined) {
      // Câu "đang mở" trong lúc soạn — hợp lệ tạm thời, nhưng chưa xuất được
      problems.push(`${tag}: chưa có end (dòng đang mở)`);
    } else if (typeof line.end !== "number") {
      problems.push(`${tag}: end phải là number`);
    } else if (line.end <= line.start) {
      problems.push(`${tag}: end (${line.end}) <= start (${line.start})`);
    }

    if (!line.jp) problems.push(`${tag}: thiếu jp`);

    if (Array.isArray(line.tokens) && line.tokens.length) {
      const joined = line.tokens.map((t) => t.t).join("");
      if (joined !== line.jp) {
        problems.push(`${tag}: tokens ghép lại ("${joined}") khác jp ("${line.jp}")`);
      }
    }

    const next = video.lines[i + 1];
    if (next) {
      if (next.start < line.start) problems.push(`${tag}: lines không sắp tăng dần theo start`);
      if (typeof line.end === "number" && line.end > next.start) {
        problems.push(`${tag}: chồng lấn với line ${next.id} (${line.end} > ${next.start})`);
      }
    }
  });

  const ids = video.lines.map((l) => l.id);
  if (new Set(ids).size !== ids.length) problems.push("id của lines bị trùng");

  return problems;
}
