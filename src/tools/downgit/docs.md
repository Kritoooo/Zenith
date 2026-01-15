# DownGit

从 GitHub 下载文件或文件夹，并打包为 zip。

## 功能
- 支持 github.com / raw / API 链接
- 自动识别文件或目录
- Ref 覆盖（branch / tag / commit）
- 并发下载与进度显示
- 可自定义输出文件名
- 可选 GitHub Token（私库/限流）

## 使用步骤
1. 粘贴 GitHub URL。
2. （可选）填写 Ref、输出文件名、并发数或 Token。
3. 点击 Check 预览目标，再点击 Download。
4. 文件夹会打包为 zip。

## 注意
- 依赖 GitHub API，可能受速率限制；私库请提供 Token。
- 超大目录会被拒绝打包。
- Token 仅保存在当前浏览器会话中。
