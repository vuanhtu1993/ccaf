# Quy ước code của repo CCA-F

- TypeScript strict, ESM, `moduleResolution: "node16"`, import nội bộ dùng đuôi `.js`.
- Không dùng `any`; nếu buộc phải dùng thì kèm comment giải thích.
- Mọi thư viện mới phải là thứ đã có trong `package.json` — kiểm tra trước khi import.
- Không thêm dependency vào `mcp-server/` ngoài `@modelcontextprotocol/sdk` và `zod`.
- Shell script: `#!/usr/bin/env bash`, `set -uo pipefail`, luôn có fallback khi thiếu `jq`.
- Hook/script không được `exit 1` ngoài ý muốn: chỉ dùng `exit 0` (pass) và `exit 2` (block).
- Comment trong code viết bằng tiếng Việt, tên biến/hàm bằng tiếng Anh.
