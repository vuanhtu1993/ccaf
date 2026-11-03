---
description: Chạy kiểm thử offline của repo (npm run check, 44 check, không cần key)
allowed-tools: Bash(npm run check:*), Bash(npm run check)
---

Chạy kiểm thử offline của repo CCA-F:

!`npm run check 2>&1 | tail -n 80`

Tóm tắt kết quả: số check pass/fail. Nếu có lỗi, chỉ ra check nào fail và nguyên nhân nhìn thấy trong output. Không tự sửa code trừ khi tôi yêu cầu.
