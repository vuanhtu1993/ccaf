---
paths:
  - "mcp-server/src/**/*.ts"
  - "agent-sdk/src/**/*.ts"
---

# Luật riêng cho code TypeScript của server và SDK

Các luật này **chỉ nạp khi** Claude làm việc với file khớp glob ở frontmatter.

- MCP tool handler: luôn trả về `CallToolResult` có `content`. Lỗi nghiệp vụ thì trả
  `isError: true` kèm `content` giải thích, **không throw** — throw làm client mất ngữ cảnh.
- Mỗi tool/resource phải có `title` + `description` rõ ràng: model chọn tool dựa trên đó.
- `inputSchema` dùng zod raw shape (`{ field: z.string() }`), không bọc trong `z.object()`.
- Agent SDK: `options` không được chứa secret. API key lấy từ env.
- Không log ra `stdout` trong MCP server stdio — stdout là kênh JSON-RPC.
  Log phải đi qua `console.error` (stderr).
