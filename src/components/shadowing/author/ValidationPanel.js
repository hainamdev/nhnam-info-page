import React from "react";

/**
 * Bảng kiểm trực tiếp. Dùng lại validateVideo() của phần luyện tập thay vì viết
 * luật thứ hai — hai bộ luật lệch nhau là nguồn lỗi âm thầm.
 */
export const ValidationPanel = ({ problems, lineCount }) => {
  // Bài rỗng không "hợp lệ" theo nghĩa dùng được — xuất ra file không có câu nào là vô nghĩa
  if (lineCount === 0) {
    return (
      <div className="sd-validate">
        Chưa có câu nào — thêm ít nhất một câu rồi mới xuất JSON được.
      </div>
    );
  }

  if (!problems || problems.length === 0) {
    return (
      <div className="sd-validate is-ok">
        <b>Dữ liệu hợp lệ</b> — xuất JSON được.
      </div>
    );
  }

  return (
    <div className="sd-validate is-bad" role="status">
      <b>
        {problems.length} vấn đề
      </b>
      <ul>
        {problems.slice(0, 10).map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      {problems.length > 10 && (
        <p className="sd-validate__foot">…và {problems.length - 10} vấn đề khác</p>
      )}
      <p className="sd-validate__foot">
        Còn vấn đề thì nút <b>Xuất JSON</b> bị khoá — xuất ra file hỏng rồi phát hiện sau còn tệ hơn.
      </p>
    </div>
  );
};
