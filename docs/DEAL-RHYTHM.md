# 发块推送 · 摘要

> **需求 + 重构设计：** [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md)  
> **现行行为：** [DEAL-SPEC.md](./DEAL-SPEC.md)  
> **入口：** `deal/pipeline.js` · **常量：** `defaults.js`

## 意图顺序

1. 续推清屏（给过清屏向未盘空）  
2. beat 全清 → 助清  
3. **payoff 大消钥匙**（玩家自建 setup）  
4. 空腔补缺  
5. 稀有阶段全清  
6. 主采样（含 T/L）  
7. fallback  

## 模块

| 文件 | 职责 |
|------|------|
| `pipeline.js` | 编排 + generateTray |
| `session.js` | 会话 / 续推 |
| `accept.js` | 验收分档 |
| `payoff-match.js` | 多线钥匙 |
| `cavity-match.js` | 空腔 |
| `clear-tray.js` | 全清/减占搜索 |
| `sample` / `bag` / `phase` … | 主采样 |

## 回归

`npm run deal:hist`
