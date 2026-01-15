# Class to JSON

从 Java / Go / Python 类定义生成 JSON 模板与模拟数据。

## 功能
- 识别基础类型、数组、List/Map 等常见集合
- Go 结构体支持 json tag
- 输出 JSON Template 与 Mock Data
- Mock 行数可调（1-10）
- 一键复制结果

## 使用步骤
1. 选择语言（Java / Go / Python）。
2. 粘贴类/结构体定义。
3. 设置 Mock rows，点击 Generate。
4. 在右侧复制模板或模拟数据。

## 注意
- 无法识别的类型会以 null 或空对象输出。
- 若未解析出字段，请检查类定义格式或注释位置。
