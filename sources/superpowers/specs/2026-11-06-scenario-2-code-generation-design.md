# Thiết Kế Chi Tiết: Lab Scenario 2 - Code Generation with Claude Code
**Mã bài thi:** CCAR-F (Claude Certified Architect – Foundations)  
**Tác giả:** Anh Tú  
**Trạng thái:** Đã hoàn thiện thiết kế (Ready for Implementation)  
**Ngày lập:** 2026-11-06  

---

## 1. Intent & The Why (Mục đích & Bối cảnh ra đời)

### 1.1. Bối cảnh & Lý do ra đời (Root Cause)
Khi tích hợp công cụ lập trình tác tử như **Claude Code** vào quy trình phát triển phần mềm của cả một đội ngũ (Team Development Workflow), các kỹ sư thường gặp phải 4 rào cản kiến trúc lớn:
* **Sự phân mảnh cấu hình (Configuration Drift):** Các quy chuẩn viết code, kiểm thử và kiến trúc nếu lưu ở cấu hình cá nhân (`~/.claude/CLAUDE.md`) sẽ không thể chia sẻ qua Git cho thành viên mới; ngược lại, nếu nhồi nhét toàn bộ quy tắc của dựán lớn vào một file `CLAUDE.md` duy nhất ở thư mục gốc sẽ gây lãng phí token và làm loãng sự chú ý của mô hình.
* **Ô nhiễm ngữ cảnh phiên chính (Main Context Pollution):** Các tác vụ phân tích codebase diện rộng hoặc thử nghiệm ý tưởng (brainstorming) sinh ra lượng log khổng lồ. Nếu chạy trực tiếp trên luồng hội thoại chính, mô hình sẽ nhanh chóng rơi vào trạng thái **suy thoái ngữ cảnh (Context Degradation)** — bắt đầu trả lời chung chung theo "mẫu phổ biến" thay vì bám sát các class thực tế vừa khám phá.
* **Lựa chọn sai chế độ thực thi (Execution Mode Mismatch):** Áp dụng thực thi trực tiếp (Direct Execution) cho các đợt tái cấu trúc đa dịch vụ (45+ files) dẫn đến đập đi xây lại tốn kém; trong khi bật chế độ lập kế hoạch (Plan Mode) cho một lỗi nhỏ ở một hàm duy nhất lại gây độ trễ không cần thiết.
* **Mơ hồ trong tinh chỉnh yêu cầu (Ambiguous Refinement):** Mô tả các phép biến đổi dữ liệu phức tạp bằng văn xuôi (prose) thường khiến mô hình hiểu sai biên (edge cases), đòi hỏi sự kết hợp có kỷ luật giữa ví dụ Input/Output cụ thể, phát triển hướng kiểm thử (TDD) và mẫu phỏng vấn ngược (Interview Pattern).

Do đó, **Scenario 2: Code Generation with Claude Code** được thiết kế nhằm giúp học viên làm chủ nghệ thuật **Cấu hình Phân cấp & Tải Quy tắc Có điều kiện (Hierarchical & Conditional Configuration)** kết hợp với **Điều phối Chiến lược Thực thi & Bảo toàn Ngữ cảnh (Execution Strategy & Context Hygiene)**.

### 1.2. Định nghĩa & Giải phẫu Khái niệm (Definition Anatomy)
> **Định nghĩa:** Một *Hệ thống Quy trình Phát triển với Claude Code (Claude Code Development Workflow Architecture)* là một kiến trúc cấu hình và điều phối phân tầng kết hợp bộ nhớ dự án mô-đun hóa (`CLAUDE.md` & `@import`), quy tắc kích hoạt theo đường dẫn (`.claude/rules/` với glob `paths`), kỹ năng cô lập ngữ cảnh (`.claude/skills/` với `context: fork`), cùng bộ định tuyến chế độ thực thi (*Plan Mode* vs *Direct Execution*) và cơ chế quản lý trạng thái phiên (`--resume`, `fork_session`, *Scratchpad*, *State Manifest*) nhằm tối ưu hóa năng suất sinh mã, tính nhất quán toàn đội ngũ và độ tin cậy của ngữ cảnh dài hạn.

* **Bộ nhớ dự án mô-đun hóa (`CLAUDE.md` & `@import`):** Phân tách rõ cấu hình cá nhân (`~/.claude/CLAUDE.md`) và cấu hình chia sẻ qua Git (`.claude/CLAUDE.md`), sử dụng `@import` để nạp chọn lọc các tài liệu chuẩn mực theo từng gói phần mềm.
* **Quy tắc kích hoạt theo đường dẫn (Path-Scoped Rules):** Các file quy tắc trong `.claude/rules/*.md` chứa khai báo YAML frontmatter `paths: [...]` giúp Claude Code chỉ nạp quy ước khi kỹ sư đang thao tác trên đúng định dạng file tương ứng (ví dụ `**/*.test.tsx`), tiết kiệm tối đa cửa sổ ngữ cảnh.
* **Kỹ năng cô lập ngữ cảnh (`context: fork` & `allowed-tools`):** Cơ chế đóng gói quy trình chuyên biệt trong `.claude/skills/<name>/SKILL.md` chạy trong sub-agent riêng biệt và giới hạn quyền công cụ để bảo vệ phiên làm việc chính.
* **Định tuyến thực thi (*Plan Mode* vs *Direct Execution*):** Cơ chế phân loại độ phức tạp của tác vụ để quyết định khi nào cần khảo sát an toàn qua *Plan Mode* (kết hợp *Explore Subagent*) và khi nào sửa trực tiếp.
* **Bảo toàn ngữ cảnh & Quản lý phiên (*Scratchpad*, `fork_session`, `--resume`):** Tập hợp các kỹ thuật chống suy thoái ngữ cảnh khi khám phá codebase lớn và phục hồi trạng thái chính xác sau khi gián đoạn.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1. Goals (Mục tiêu bắt buộc)
1. Hiện thực hóa trọn vẹn 5 Hồi trong hành trình kỹ thuật của đội ngũ **NovaSmart Platform Engineering** (Tech Lead **Minh Lê** và Junior Developer **Lan Phạm**).
2. Bao phủ 100% các Task Statements của Đề thi CCAF thuộc Scenario 2 và Exercise 2:
   * **Domain 3 (Trọng tâm):**
     * **Task 3.1:** Phân cấp `CLAUDE.md` (user vs project vs directory), cú pháp `@import`, thư mục `.claude/rules/` và lệnh `/memory`.
     * **Task 3.2:** Slash commands (`.claude/commands/` vs `~/.claude/commands/`) và Skills (`.claude/skills/*/SKILL.md` với `context: fork`, `allowed-tools`, `argument-hint`).
     * **Task 3.3:** Quy tắc theo đường dẫn (`.claude/rules/` với YAML frontmatter `paths` glob patterns) so với `CLAUDE.md` cấp thư mục con.
     * **Task 3.4:** Tiêu chí chọn *Plan Mode* vs *Direct Execution*, sử dụng *Explore Subagent* và mô hình lai (Plan -> Direct Execute).
     * **Task 3.5:** Kỹ thuật tinh chỉnh lặp (*Iterative Refinement*): 2–3 ví dụ I/O cụ thể, *Test-Driven Iteration*, *Interview Pattern*, và chiến lược gom lỗi tương tác (single message) vs tách lỗi độc lập (sequential).
   * **Domain 5 (Trọng tâm):**
     * **Task 5.4:** Quản lý ngữ cảnh khi khám phá codebase lớn: nhận diện suy thoái ngữ cảnh (*Context Degradation*), file nháp (*Scratchpad*), ủy quyền subagent, lệnh `/compact`, và lưu trữ trạng thái (*State Manifest*) để phục hồi sau sự cố (*Crash Recovery*).
   * **Domain 1 & Domain 2 (Giao thoa trong Exercise 2):**
     * **Task 1.7:** Quản lý phiên với `--resume <session-name>`, tạo nhánh thử nghiệm song song với `fork_session`, cập nhật file thay đổi khi resume vs khởi tạo phiên mới kèm tóm tắt cấu trúc khi kết quả tool cũ bị lỗi thời (*stale tool results*).
     * **Task 2.4:** Tích hợp MCP server cấp dự án (`.mcp.json` kèm biến môi trường `${GITHUB_TOKEN}`) và cấp cá nhân (`~/.claude.json`) hoạt động đồng thời.
3. Cung cấp bộ **Vitest Katas (5 test suites tương ứng 5 Hồi)** và **Storyline Runner (`run-story.ts`)** minh họa trực quan toàn bộ quyết định kiến trúc.

### 2.2. Non-Goals (Không thuộc phạm vi bài lab)
* Không xây dựng lại binary CLI của Claude Code mà mô phỏng bộ máy phân giải cấu hình (Configuration & Rule Resolver), bộ định tuyến thực thi (Workflow Router) và trình quản lý phiên/ngữ cảnh (Session & Context Hygiene Engine) bằng TypeScript chuẩn xác.
* Không yêu cầu kết nối mạng tới GitHub/Jira MCP server thật khi chạy unit tests.

### 2.3. Anti-Goals (Các điều cấm kỵ / Bẫy thiết kế cần tránh trong kỳ thi CCAF)
* **Anti-pattern 1:** Đặt các quy tắc chung của nhóm vào `~/.claude/CLAUDE.md` (cấp cá nhân) khiến thành viên mới clone repo về không nhận được hướng dẫn.
* **Anti-pattern 2:** Tạo hàng chục file `CLAUDE.md` ở từng thư mục con cho các quy ước xuyên suốt dự án (như quy ước viết file `*.test.tsx`) thay vì dùng một file `.claude/rules/testing.md` với `paths: ["**/*.test.tsx"]`.
* **Anti-pattern 3:** Lưu cứng (hardcode) token xác thực trong `.mcp.json` thay vì dùng cú pháp mở rộng biến môi trường `${GITHUB_TOKEN}`.
* **Anti-pattern 4:** Chạy các skill phân tích codebase sinh nhiều chữ trực tiếp trên phiên chính mà không bật `context: fork`, gây tràn và làm loãng ngữ cảnh.
* **Anti-pattern 5:** Dùng *Direct Execution* ngay lập tức cho tác vụ di trú thư viện (library migration) chạm tới 45+ files hoặc có nhiều phương án kiến trúc.
* **Anti-pattern 6:** Tiếp tục `--resume` một phiên làm việc cũ chứa đầy kết quả tool đã lỗi thời (*stale tool results*) sau khi mã nguồn đã thay đổi lớn, thay vì mở phiên mới với bản tóm tắt có cấu trúc (*structured summary*).

---

## 3. Technical Approaches Considered

| Tiêu chí | Phương án 1: Bộ File Cấu hình Tĩnh | Phương án 2: Bộ Câu hỏi Trắc nghiệm CLI | Phương án 3: Hybrid Config Engine + Vitest Kata + Story Runner (Được chọn) |
| :--- | :--- | :--- | :--- |
| **Mô tả** | Chỉ tạo các file mẫu `.claude/`, `CLAUDE.md`, `.mcp.json` | Chỉ viết script hỏi đáp lý thuyết trên terminal | Xây dựng bộ máy mô phỏng cơ chế Claude Code (Config Resolver, Glob Matcher, Skill Forker, Mode Router, Session Manager) + 5 Test Suites + Story Runner |
| **Tính thực chiến** | Thấp (Không kiểm증 được hành vi nạp file và định tuyến) | Trung bình (Giống flashcard, thiếu chiều sâu kỹ thuật) | **Rất cao (Kiểm chứng bằng code cách Claude Code nạp rules, fork skill và quản lý session)** |
| **Độ phủ đề thi CCAF** | Chỉ phủ được Task 3.1–3.3 | Khó kiểm tra cấu hình YAML/JSON thực tế | **Tuyệt đối (Phủ trọn vẹn Domain 3, Task 5.4, Task 1.7 và Task 2.4)** |
| **Giá trị sư phạm** | Học viên đọc dễ buồn ngủ | Thiếu mạch truyện kết nối thực tế | **Tối ưu: Học viên vừa thấy file cấu hình thật, vừa chạy test và theo dõi câu chuyện 5 Hồi** |

**Lý do chọn Phương án 3:** Phương án Hybrid biến các khái niệm cấu hình tưởng chừng khô khan của Claude Code thành các module TypeScript có thể kiểm thử tất định (deterministic testability), đồng thời giữ nguyên phong cách kể chuyện sư phạm đồng nhất với Scenario 1.

---

## 4. Architectural Design (Kiến trúc Chi tiết)

### 4.1. Cấu trúc thư mục dự án (`labs/scenario-2/`)

```
labs/scenario-2/
├── README.md                               # Hướng dẫn bài lab, bảng đối chiếu CCAF & câu hỏi ôn tập
├── vitest.config.ts                        # Cấu hình chạy kiểm thử độc lập cho Scenario 2
├── fixtures/                               # Bộ file cấu hình mẫu chuẩn CCAF cho dự án NovaSmart
│   ├── CLAUDE.md                           # Project-level CLAUDE.md có sử dụng @import
│   ├── .mcp.json                           # Project-scoped MCP config dùng ${GITHUB_TOKEN}
│   └── .claude/
│       ├── rules/
│       │   ├── testing.md                  # Rule có YAML frontmatter paths: ["**/*.test.ts"]
│       │   ├── api-conventions.md          # Rule có YAML frontmatter paths: ["src/api/**/*"]
│       │   └── terraform.md                # Rule có YAML frontmatter paths: ["terraform/**/*"]
│       ├── commands/
│       │   └── review-pr.md                # Project-scoped custom slash command
│       └── skills/
│           └── codebase-audit/
│               └── SKILL.md                # Skill dùng context: fork, allowed-tools, argument-hint
├── src/
│   ├── types.ts                            # Định nghĩa kiểu cho Config, Rules, Skills, Mode, Session
│   ├── config-resolver.ts                  # Act 1: Phân giải CLAUDE.md hierarchy, @import, glob rules, /memory, MCP
│   ├── skill-command-engine.ts             # Act 2: Quản lý Slash Commands & thực thi Skill với context: fork
│   ├── execution-router.ts                 # Act 3: Định tuyến Plan Mode vs Direct Execution & Explore Subagent
│   ├── refinement-coach.ts                 # Act 4: Bộ công cụ I/O Examples, TDD Loop, Interview Pattern & Issue Batcher
│   └── session-context-manager.ts          # Act 5: Scratchpad, /compact, State Manifest, --resume & fork_session
├── __tests__/                              # Bộ Test-Driven Kata 5 Hồi
│   ├── act-1-config-hierarchy-rules.test.ts
│   ├── act-2-commands-skills-fork.test.ts
│   ├── act-3-plan-vs-direct-mode.test.ts
│   ├── act-4-iterative-refinement.test.ts
│   └── act-5-session-context-hygiene.test.ts
└── run-story.ts                            # Script diễn họa hành trình 5 Hồi của Minh Lê & Lan Phạm
```

### 4.2. Thiết kế chi tiết 5 Hồi (Detailed Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Lan Phạm & Minh Lê
    participant Config as Config & Rule Resolver
    participant Skill as Skill & Command Engine
    participant Router as Plan vs Direct Router
    participant Coach as Refinement Coach
    participant Session as Session & Context Manager

    Note over Dev, Session: Hồi 1: Chuẩn hóa Phân cấp CLAUDE.md, Path Rules & MCP
    Dev->>Config: Chẩn đoán lỗi Lan Phạm thiếu quy ước (do để ở ~/.claude/CLAUDE.md)
    Config->>Config: Chuyển sang project CLAUDE.md + @import + kiểm tra bằng /memory
    Dev->>Config: Sửa file "src/api/orders.test.ts"
    Config-->>Dev: Khớp glob "**/*.test.ts" & "src/api/**/*" -> Chỉ nạp testing.md & api-conventions.md (Bỏ qua terraform.md)
    Dev->>Config: Kết nối MCP (.mcp.json mở rộng ${GITHUB_TOKEN} + ~/.claude.json cá nhân)

    Note over Dev, Session: Hồi 2: Slash Commands & Isolated Skills (context: fork)
    Dev->>Skill: Gọi skill "codebase-audit" không truyền tham số
    Skill-->>Dev: Nhắc tham số dựa trên frontmatter "argument-hint"
    Dev->>Skill: Gọi "codebase-audit src/payment"
    Skill->>Skill: Kích hoạt "context: fork" + kiểm tra "allowed-tools: [Read, Grep, Glob]"
    Skill-->>Dev: Trả về bản tóm tắt gọn sạch, không làm bẩn lịch sử hội thoại chính

    Note over Dev, Session: Hồi 3: Phân định Plan Mode vs Direct Execution
    Dev->>Router: Yêu cầu 1: Fix lỗi format ngày ở 1 hàm có sẵn stack trace
    Router-->>Dev: Chọn DIRECT EXECUTION (Phạm vi rõ, 1 file)
    Dev->>Router: Yêu cầu 2: Di trú thư viện Auth qua 48 files trên 4 microservices
    Router->>Router: Chọn PLAN MODE + Phái cử Explore Subagent dò tìm trước
    Router-->>Dev: Duyệt bản thiết kế di trú rồi mới chuyển sang Direct Execution

    Note over Dev, Session: Hồi 4: Tinh chỉnh Lặp (I/O Examples, TDD, Interview Pattern)
    Dev->>Coach: Yêu cầu viết script chuẩn hóa mã thuế nhưng văn xuôi gây hiểu nhầm
    Coach-->>Dev: Đính kèm 3 Concrete Input/Output Examples -> Kết quả chính xác 100%
    Dev->>Coach: Thiết kế tầng Redis Cache phức tạp (chưa rõ chiến lược thu hồi)
    Coach-->>Dev: Kích hoạt INTERVIEW PATTERN (Claude hỏi vặn các edge cases trước khi code)
    Dev->>Coach: Gặp 3 lỗi tương tác chéo nhau vs 2 lỗi độc lập
    Coach-->>Dev: Gom 3 lỗi tương tác vào 1 message duy nhất; tách 2 lỗi độc lập xử lý tuần tự

    Note over Dev, Session: Hồi 5: Chống Suy thoái Ngữ cảnh, Scratchpad & Quản lý Phiên
    Dev->>Session: Phát hiện Claude trả lời "theo mẫu chung" (Context Degradation)
    Session->>Session: Ghi chú các class cốt lõi vào Scratchpad + Chạy /compact nén ngữ cảnh
    Dev->>Session: Muốn so sánh 2 hướng refactor từ cùng 1 kết quả phân tích
    Session-->>Dev: Gọi fork_session tạo 2 nhánh thử nghiệm độc lập
    Dev->>Session: Phiên cũ có tool results đã lỗi thời (sau khi sửa 15 files) vs phiên chỉ đổi 1 file
    Session-->>Dev: Khởi tạo phiên mới kèm Structured Summary (khi stale) hoặc --resume kèm danh sách file đổi
```

---

## 5. What's Left to the Builder (Nhiệm vụ triển khai cụ thể)

1. **Khởi tạo cấu trúc dự án & Fixtures (`labs/scenario-2/`):**
   * Tạo bộ file cấu hình mẫu thực tế trong `labs/scenario-2/fixtures/` (gồm `CLAUDE.md` có `@import`, `.mcp.json` có `${GITHUB_TOKEN}`, `.claude/rules/*.md` có YAML frontmatter `paths`, `.claude/commands/review-pr.md` và `.claude/skills/codebase-audit/SKILL.md`).
2. **Hiện thực hóa Module 1 (`config-resolver.ts` - Hồi 1):**
   * Phân giải thứ tự ưu tiên và phạm vi chia sẻ giữa User-level (`~/.claude/CLAUDE.md`), Project-level (`.claude/CLAUDE.md`) và Directory-level.
   * Xử lý chỉ thị `@import` để ghép nối tài liệu quy chuẩn mô-đun.
   * Phân tích YAML frontmatter `paths` trong `.claude/rules/*.md` bằng thuật toán khớp mẫu glob để nạp quy tắc có điều kiện theo đường dẫn file đang sửa.
   * Mô phỏng lệnh `/memory` liệt kê các file bộ nhớ đang được nạp.
   * Hợp nhất cấu hình MCP từ `.mcp.json` (kèm giải mã biến môi trường `${VAR}`) và `~/.claude.json`.
3. **Hiện thực hóa Module 2 (`skill-command-engine.ts` - Hồi 2):**
   * Phân biệt phạm vi lệnh `.claude/commands/` (team) vs `~/.claude/commands/` (personal) và phân biệt khi nào dùng Skill (nạp theo yêu cầu) vs `CLAUDE.md` (luôn nạp).
   * Đọc frontmatter của `SKILL.md` (`context: fork`, `allowed-tools`, `argument-hint`).
   * Chặn các lệnh gọi tool nằm ngoài danh sách `allowed-tools` và cô lập hoàn toàn log chi tiết của skill khi `context: fork` được bật.
4. **Hiện thực hóa Module 3 (`execution-router.ts` - Hồi 3):**
   * Đánh giá đặc tính tác vụ (`fileCount`, `hasClearStackTrace`, `architecturalImpact`, `multipleValidApproaches`, `requiresDiscovery`) để quyết định dùng `plan_mode`, `direct_execution`, hoặc `plan_then_direct` kèm `Explore` subagent.
5. **Hiện thực hóa Module 4 (`refinement-coach.ts` - Hồi 4):**
   * Xây dựng bộ tạo prompt tinh chỉnh: nhúng 2–3 ví dụ Input/Output cụ thể, quy trình lặp TDD (gửi kèm kết quả test fail và edge case `null`), kích hoạt *Interview Pattern* cho miền nghiệp vụ lạ, và phân loại chiến lược gửi lỗi (`single_consolidated_message` cho lỗi tương tác vs `sequential_messages` cho lỗi độc lập).
6. **Hiện thực hóa Module 5 (`session-context-manager.ts` - Hồi 5):**
   * Phát hiện dấu hiệu suy thoái ngữ cảnh (*Context Degradation*), quản lý file `Scratchpad`, thực thi `/compact`, xuất/nhập `StateManifest` để phục hồi sau sự cố (*Crash Recovery*), và quyết định giữa `--resume <name>` (kèm thông báo file thay đổi), `fork_session`, hoặc khởi tạo phiên mới với *Structured Summary* khi dữ liệu công cụ cũ đã lỗi thời.
7. **Viết 5 bộ kiểm thử Vitest & Storyline Runner (`run-story.ts`):**
   * Đảm bảo 100% bài test pass và kịch bản 5 Hồi in ra giải thích sư phạm rõ ràng cho từng quyết định thiết kế.

---
*Made by Anh Tu - Share to be share*

