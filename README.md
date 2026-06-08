# BTC 期权卖 Put 年化工具

这是一个本地网页工具，用 Binance European Options 公共行情接口自动更新 BTC Put 标记价，并计算卖 Put 年化收益。

第一版不需要 Binance API Key，不下单，不读取账户，也不保存任何私钥或账户配置。

## 功能

- 从 Binance 公共接口拉取 BTC 期权合约、mark price 和 BTC 指数价。
- 只展示未过期、交易中的 BTC Put 合约。
- 按参考价格自动选择附近行权价，也可以点击行权价锁定常看的价格。
- 支持切换收益口径：
  - 实际年化：`权利金 / 每张保证金 * 365 / 剩余天数 * 100%`
  - 全担保年化：`权利金 / 行权价 * 365 / 剩余天数 * 100%`
- 默认每 30 秒自动刷新，也可以手动刷新。
- Binance 请求失败时，后端会尽量返回最近一次成功快照，并在界面提示 stale 状态。

## 运行

先安装依赖：

```powershell
npm install
```

启动本地前后端：

```powershell
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

后端本地 API 默认运行在：

```text
http://127.0.0.1:8787
```

## 常用命令

```powershell
npm test
npm run build
```

## 数据来源

后端代理请求 Binance Options 公共接口：

- `/eapi/v1/exchangeInfo`
- `/eapi/v1/mark`
- `/eapi/v1/index?underlying=BTCUSDT`

当前权利金口径使用 option `markPrice`，不是 bid、ask 或 last price。

## 计算默认值

- 标的：BTC
- 方向：Put
- 每张保证金：`10000 USDT`
- 权利金：Binance option `markPrice`
- 实际年化分母：每张保证金
- 全担保年化分母：行权价
