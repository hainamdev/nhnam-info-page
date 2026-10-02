# Bật Speech-to-Text và Tự điền trên Firebase

> Hướng dẫn từng bước cho project `my-page-39b31`.
> Làm **đúng thứ tự** — bước 4 phải xong mới có UID cho bước 5.

---

## 0. Cái gì cần cái gì

| Tính năng | Cần gì |
|---|---|
| Luyện tập, phụ đề + furigana, tua ±5s | **Không cần gì** — đang chạy rồi |
| Ghi âm, nghe lại | **Không cần gì** — chạy thuần trong trình duyệt |
| Import / xuất JSON, soạn bài gõ tay | **Không cần gì** |
| **Nhận dạng giọng nói (STT)** | Blaze + Cloud Function + Auth |
| **Tự điền kana / romaji / nghĩa / furigana** | Blaze + Cloud Function + Auth + khoá Anthropic |

Nếu bạn chỉ cần phần trên thì **không phải làm gì cả**, bỏ qua tài liệu này.

---

## 1. Nâng lên gói Blaze

Firebase Console → ⚙️ **Project settings** → **Usage and billing** → **Details & settings** →
**Modify plan** → chọn **Blaze**.

**Vì sao bắt buộc:** gói Spark (free) **không cho Cloud Function gọi mạng ra ngoài**, kể cả gọi
tới API của chính Google. Không có Blaze thì cả hai tính năng đều không thể chạy.

**Đặt ngay budget alert** để yên tâm: Google Cloud Console → **Billing** → **Budgets & alerts** →
Create budget → đặt ví dụ 5 USD/tháng, cảnh báo ở 50% / 90% / 100%.

Mức dùng cá nhân gần như bằng 0, nhưng gắn thẻ mà không có cảnh báo thì không nên.

---

## 2. Bật Authentication (Google)

Firebase Console → **Build** → **Authentication** → **Get started** →
tab **Sign-in method** → **Google** → bật **Enable** → chọn *Project support email* → **Save**.

**Vì sao cần:** cả hai Cloud Function đều kiểm `request.auth.uid === OWNER_UID`. Không đăng nhập
thì function từ chối. Đây cũng là thứ chặn người lạ tiêu tiền trên tài khoản bạn.

---

## 3. Lấy Firebase web config

Firebase Console → ⚙️ **Project settings** → tab **General** → kéo xuống **Your apps**.

- Chưa có app web nào → bấm biểu tượng **`</>`** (Add app → Web), đặt tên bất kỳ, **không** cần
  bật Firebase Hosting ở bước này (đã có sẵn).
- Đã có → bấm vào app, chọn **Config**.

Bạn cần hai giá trị: `apiKey` và `appId`.

---

## 4. Chạy local, đăng nhập lần đầu để sinh user

Tạo file `.env.local` ở thư mục gốc (file này đã nằm trong `.gitignore`, sẽ không bị commit):

```bash
REACT_APP_FIREBASE_API_KEY=<apiKey vừa copy>
REACT_APP_FIREBASE_AUTH_DOMAIN=my-page-39b31.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=my-page-39b31
REACT_APP_FIREBASE_STORAGE_BUCKET=my-page-39b31.appspot.com
REACT_APP_FIREBASE_APP_ID=<appId vừa copy>
REACT_APP_FUNCTIONS_REGION=asia-southeast1
```

Rồi:

```bash
npm start
```

Mở `http://localhost:3000/shadowing`. Trên đầu trang sẽ xuất hiện băng
**“Đăng nhập để dùng nhận dạng giọng nói và tự điền.”** → bấm **Đăng nhập Google** → chọn tài khoản.

Sau khi đăng nhập xong, băng đổi thành **“Đã đăng nhập · email-của-bạn”**.

Giờ quay lại Firebase Console → **Authentication** → tab **Users** → copy giá trị cột **User UID**
(chuỗi 28 ký tự).

> Phải đăng nhập một lần thì Firebase mới tạo user và mới có UID — đó là lý do bước này nằm
> trước bước 5.

---

## 5. Thay UID vào 4 file

Thay chuỗi `REPLACE_WITH_YOUR_UID` bằng UID vừa copy ở **cả bốn chỗ**:

| File | Dòng |
|---|---|
| `functions/index.js` | 32 |
| `functions/enrich.js` | 23 |
| `firestore.rules` | 12 |
| `storage.rules` | 10 và 13 |

Kiểm tra lại là không còn chỗ nào sót:

```bash
grep -rn "REPLACE_WITH_YOUR_UID" functions/ *.rules
```

Lệnh trên không in ra gì là xong.

---

## 6. Tạo Firestore và bật Speech-to-Text API

**Firestore** (để lưu lịch sử luyện tập):
Firebase Console → **Build** → **Firestore Database** → **Create database** →
chọn **Production mode** → region **asia-southeast1** → Enable.

**Speech-to-Text API:**
[Google Cloud Console](https://console.cloud.google.com/) → chọn project `my-page-39b31` →
**APIs & Services** → **Enable APIs and services** → tìm **Cloud Speech-to-Text API** → **Enable**.

> Storage chưa dùng tới (bản ghi âm hiện chỉ nằm trong bộ nhớ trình duyệt), nên **bỏ qua** phần
> Storage. Khi nào làm tính năng lưu file ghi âm thì mới cần.

---

## 7. Khoá Anthropic cho tính năng tự điền

Lấy khoá ở [console.anthropic.com](https://console.anthropic.com/) → **API Keys** → Create key.

```bash
cd functions
npm install
cd ..

firebase functions:secrets:set ANTHROPIC_API_KEY
# dán khoá vào khi được hỏi, rồi Enter
```

> ⚠️ Khoá này **là bí mật thật**. Tuyệt đối không đặt tên `REACT_APP_...` và không để vào `.env` —
> mọi biến `REACT_APP_*` bị nhúng thẳng vào bundle JS, ai mở DevTools cũng đọc được.
> Nó chỉ được phép nằm trong Secret Manager như lệnh trên.

Chỉ cần STT, không cần tự điền thì bỏ qua bước 7 — function `transcribeShadowing` vẫn chạy bình thường.

---

## 8. Deploy

```bash
firebase deploy --only functions,firestore
```

Lần deploy functions đầu tiên Firebase sẽ hỏi bật thêm vài API
(Cloud Functions, Cloud Build, Artifact Registry) — chọn **Yes**. Lần đầu mất khoảng 3–5 phút.

Kiểm tra:

```bash
firebase functions:list
```

Phải thấy `transcribeShadowing` và `enrichShadowingLines`, region `asia-southeast1`.

> **Lưu ý:** GitHub Actions của bạn **chỉ deploy hosting**, không đụng tới functions.
> Mỗi lần sửa code trong `functions/` đều phải chạy tay lệnh trên.

---

## 9. Cho bản deploy trên hosting dùng được

`.env.local` bị gitignore nên runner của GitHub Actions không có nó → bản deploy hiện tại
vẫn thiếu config. Chọn **một** trong hai cách:

### Cách A — commit `.env.production` (đơn giản nhất)

`.gitignore` chỉ chặn `.env.production.local`, **không** chặn `.env.production`. CRA tự đọc file
này khi `npm run build`.

```bash
cp .env.local .env.production
git add .env.production
```

Hợp lý vì Firebase web config **vốn được thiết kế để công khai** — nó định danh project chứ không
cấp quyền. Bảo mật thật nằm ở `firestore.rules` và kiểm `OWNER_UID` trong function.

### Cách B — GitHub Secrets (giữ repo sạch hơn)

Thêm vào **cả hai** file `.github/workflows/firebase-hosting-*.yml`:

```yaml
      - run: npm ci && npm run build
        env:
          REACT_APP_FIREBASE_API_KEY: ${{ secrets.REACT_APP_FIREBASE_API_KEY }}
          REACT_APP_FIREBASE_AUTH_DOMAIN: my-page-39b31.firebaseapp.com
          REACT_APP_FIREBASE_PROJECT_ID: my-page-39b31
          REACT_APP_FIREBASE_STORAGE_BUCKET: my-page-39b31.appspot.com
          REACT_APP_FIREBASE_APP_ID: ${{ secrets.REACT_APP_FIREBASE_APP_ID }}
          REACT_APP_FUNCTIONS_REGION: asia-southeast1
```

Rồi khai báo 2 secret ở GitHub → repo → **Settings** → **Secrets and variables** → **Actions**.

> Dù chọn cách nào thì giá trị vẫn nằm trong bundle công khai. Cách B chỉ giúp repo sạch, **không**
> làm nó bí mật hơn.

---

## 10. Kiểm tra lại

Commit, push, đợi Actions chạy xong, rồi mở `https://my-page-39b31.web.app/shadowing`:

| # | Việc | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang | Có băng “Đăng nhập để dùng…” |
| 2 | Bấm Đăng nhập Google | Băng đổi thành “Đã đăng nhập · email” |
| 3 | Thử bài mẫu → bấm 🎙 → đọc một câu → bấm lại | Hiện transcript + % độ khớp |
| 4 | Nhập link YouTube → thêm câu → gõ `jp` → bấm ⚡ | Tự điền kana / romaji / nghĩa / furigana |
| 5 | Firestore → `shadowing_attempts` | Có document mới sau mỗi lần nhận dạng |

---

## 11. Khi có lỗi

```bash
firebase functions:log --only transcribeShadowing
firebase functions:log --only enrichShadowingLines
```

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `permission-denied` / “Tài khoản này không được phép dùng” | `OWNER_UID` trong function khác UID bạn đang đăng nhập. Xem lại bước 5, nhớ deploy lại |
| `unauthenticated` | Chưa bấm Đăng nhập, hoặc đã bị đăng xuất |
| “Đăng nhập thất bại (auth/unauthorized-domain)” | Firebase Console → Authentication → Settings → **Authorized domains** → thêm domain đang dùng |
| Trình duyệt chặn cửa sổ đăng nhập | Cho phép popup cho domain này |
| Function trả `internal` ở `enrichShadowingLines` | Khoá Anthropic sai hoặc chưa set. Chạy lại bước 7 rồi deploy lại |
| Function trả `internal` ở `transcribeShadowing` | Chưa bật Cloud Speech-to-Text API (bước 6) |
| Nút ⚡ vẫn xám | `.env` thiếu → `isFirebaseConfigured()` false. Kiểm tra bundle đã có config chưa |
| Nhận dạng ra chuỗi rỗng | Micro quá nhỏ, hoặc tiếng video lọt vào. Đeo tai nghe, tắt tiếng video khi thu |

---

## 12. Chi phí thực tế

| Khoản | Mức | Ghi chú |
|---|---|---|
| Cloud Functions | Gần như 0 | Hạn mức free hàng tháng rất rộng so với dùng cá nhân |
| Speech-to-Text | Theo phút audio | Có hạn mức free hàng tháng; mỗi câu shadowing ~10s |
| Claude (tự điền) | ~$0.11 cho bài 50 câu | `claude-opus-5`. Đổi sang `claude-haiku-4-5` còn ~$0.02 |
| Firestore / Hosting | Gần như 0 | |

Giá và hạn mức miễn phí thay đổi theo thời gian — xem trang pricing của Google Cloud và Anthropic
trước khi bật.

Đã có sẵn hai lớp chặn chi phí vượt tầm kiểm soát: `maxInstances: 3` trên cả hai function, và
chỉ đúng một UID gọi được.

### Muốn đổi sang model rẻ hơn

Sửa `functions/enrich.js`, dòng có `model: "claude-opus-5"` thành `"claude-haiku-4-5"`,
rồi `firebase deploy --only functions`.
