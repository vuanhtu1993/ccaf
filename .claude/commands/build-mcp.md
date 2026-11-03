---
description: Build mcp-server (TypeScript -> dist/index.js) để Claude Code dùng được
allowed-tools: Bash(npm --prefix mcp-server run build), Bash(npm --prefix mcp-server run build:*)
---

Build custom MCP server:

!`npm --prefix mcp-server run build 2>&1 | tail -n 60`

Báo lại build thành công hay thất bại. Nếu thất bại, trích dòng lỗi TypeScript đầu tiên và file:line tương ứng. Nhắc rằng Claude Code chạy từ `mcp-server/dist/index.js`, nên cần build lại sau khi sửa `mcp-server/src/`.
