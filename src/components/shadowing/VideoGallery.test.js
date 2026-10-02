import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { VideoGallery } from "./VideoGallery";
import { listVideos, deleteVideo } from "../../lib/videoStore";

// Gallery chỉ chạy được khi có Firebase thật, nên giả lập tầng truy cập dữ liệu
jest.mock("../../lib/videoStore", () => ({
  listVideos: jest.fn(),
  deleteVideo: jest.fn(),
}));

const sample = [
  {
    videoId: "ZcKxZfyEFBc",
    title: "日本の電車",
    titleVi: "Tàu điện ở Nhật",
    level: "N4",
    tags: ["daily-life"],
    thumbnail: "https://i.ytimg.com/vi/ZcKxZfyEFBc/hqdefault.jpg",
    durationSec: 163,
    lineCount: 5,
    updatedAt: "2026-10-03T00:00:00.000Z",
  },
  {
    videoId: "AbCdEfGhIjK",
    title: "",
    titleVi: "",
    level: "",
    tags: [],
    thumbnail: "https://i.ytimg.com/vi/AbCdEfGhIjK/hqdefault.jpg",
    durationSec: 0,
    lineCount: 0,
    updatedAt: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test("hiện danh sách thẻ với tiêu đề, level, số câu và thời lượng", async () => {
  listVideos.mockResolvedValue(sample);
  render(<VideoGallery onPick={() => {}} onBack={() => {}} />);

  expect(screen.getByText("Đang tải danh sách…")).toBeInTheDocument();

  await waitFor(() => expect(screen.getByText("日本の電車")).toBeInTheDocument());
  expect(screen.getByText("Tàu điện ở Nhật")).toBeInTheDocument();
  expect(screen.getByText("N4")).toBeInTheDocument();
  expect(screen.getByText("5 câu")).toBeInTheDocument();
  expect(screen.getByText("02:43")).toBeInTheDocument(); // 163s
});

test("bài không có tiêu đề thì hiện videoId thay thế", async () => {
  listVideos.mockResolvedValue(sample);
  render(<VideoGallery onPick={() => {}} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText("AbCdEfGhIjK")).toBeInTheDocument());
});

test("bấm vào thẻ thì gọi onPick với đúng videoId", async () => {
  listVideos.mockResolvedValue(sample);
  const onPick = jest.fn();
  render(<VideoGallery onPick={onPick} onBack={() => {}} />);

  await waitFor(() => expect(screen.getByText("日本の電車")).toBeInTheDocument());
  fireEvent.click(screen.getByText("日本の電車"));
  expect(onPick).toHaveBeenCalledWith("ZcKxZfyEFBc");
});

test("danh sách rỗng thì hướng dẫn cách tạo, không hiện lưới trống", async () => {
  listVideos.mockResolvedValue([]);
  render(<VideoGallery onPick={() => {}} onBack={() => {}} />);

  await waitFor(() => expect(screen.getByText(/Chưa có bài nào trên Firebase/)).toBeInTheDocument());
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("lỗi tải thì hiện nguyên văn thông báo, không nuốt lỗi", async () => {
  listVideos.mockRejectedValue(new Error("Cần đăng nhập trước khi dùng Firebase."));
  render(<VideoGallery onPick={() => {}} onBack={() => {}} />);

  await waitFor(() => expect(screen.getByText("Không tải được danh sách")).toBeInTheDocument());
  expect(screen.getByText("Cần đăng nhập trước khi dùng Firebase.")).toBeInTheDocument();
});

test("xoá thẻ: có hỏi lại, và KHÔNG mở bài khi bấm nút xoá", async () => {
  listVideos.mockResolvedValue(sample);
  deleteVideo.mockResolvedValue();
  const onPick = jest.fn();
  const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);

  render(<VideoGallery onPick={onPick} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText("日本の電車")).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText("Xoá 日本の電車"));

  await waitFor(() => expect(deleteVideo).toHaveBeenCalledWith("ZcKxZfyEFBc"));
  expect(confirmSpy).toHaveBeenCalled();
  expect(onPick).not.toHaveBeenCalled(); // nút xoá không được kích hoạt thẻ
  await waitFor(() => expect(screen.queryByText("日本の電車")).not.toBeInTheDocument());

  confirmSpy.mockRestore();
});

test("từ chối hộp thoại xác nhận thì không xoá gì", async () => {
  listVideos.mockResolvedValue(sample);
  const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

  render(<VideoGallery onPick={() => {}} onBack={() => {}} />);
  await waitFor(() => expect(screen.getByText("日本の電車")).toBeInTheDocument());

  fireEvent.click(screen.getByLabelText("Xoá 日本の電車"));
  expect(deleteVideo).not.toHaveBeenCalled();
  expect(screen.getByText("日本の電車")).toBeInTheDocument();

  confirmSpy.mockRestore();
});

test("bấm Quay lại gọi onBack", async () => {
  listVideos.mockResolvedValue([]);
  const onBack = jest.fn();
  render(<VideoGallery onPick={() => {}} onBack={onBack} />);

  await waitFor(() => expect(screen.getByText(/Chưa có bài nào/)).toBeInTheDocument());
  fireEvent.click(screen.getByText("Quay lại"));
  expect(onBack).toHaveBeenCalled();
});
