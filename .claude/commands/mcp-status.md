---
description: Kiểm tra các MCP server đang cấu hình trong dự án (claude mcp list)
allowed-tools: Bash(claude mcp list)
---

Danh sách MCP server hiện tại:

!`claude mcp list 2>&1`

Tóm tắt server nào đang connected, server nào lỗi hoặc chưa được approve. Với server lỗi, gợi ý bước kiểm tra tiếp theo (đường dẫn `.mcp.json`, build `mcp-server/`, hoặc approve project MCP lần đầu).
