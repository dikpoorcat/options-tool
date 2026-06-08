# BTC 期权卖 Put 年化工具

这是一个纯前端静态网页工具，用浏览器直接请求 Binance European Options 公共行情接口，自动更新 BTC Put 标记价并计算卖 Put 年化收益。

第一版不需要 Binance API Key，不下单，不读取账户，也不需要 Node 后端服务。

## 功能

- 从 Binance 公共接口拉取 BTC 期权合约、mark price 和 BTC 指数价。
- 只展示未过期、交易中的 BTC Put 合约。
- 按参考价格自动选择附近行权价，支持 100 / 250 / 500 / 1000 / 2500 / 5000 行权价间隔。
- 默认展示 6 档附近行权价，也可以点击行权价锁定常看的价格。
- 支持切换收益口径：
  - 实际年化：`净权利金 / 每张保证金 * 365 / 剩余天数 * 100%`
  - 全担保年化：`净权利金 / 行权价 * 365 / 剩余天数 * 100%`
- 净权利金会扣除 Put 当前价内亏损：`markPrice - max(行权价 - BTC 指数价, 0)`。
- 默认每 30 秒自动刷新，也可以手动刷新。

## 本地运行

安装依赖：

```powershell
npm install
```

启动本地开发页面：

```powershell
npm run dev
```

默认访问地址：

```text
http://127.0.0.1:5173
```

## 编译和手动部署

编译静态文件：

```powershell
npm run build
```

编译完成后，把 `dist/` 目录里面的内容上传到服务器目录：

```text
/var/hundao/apps/2_options_calc/
```

上传后服务器目录应类似：

```text
/var/hundao/apps/2_options_calc/index.html
/var/hundao/apps/2_options_calc/assets/...
```

注意是上传 `dist` 里面的内容，不是把 `dist` 文件夹整体放进去。

## 常用命令

```powershell
npm test
npm run build
```

## 数据来源

浏览器直接请求 Binance Options 公共接口：

- `https://eapi.binance.com/eapi/v1/exchangeInfo`
- `https://eapi.binance.com/eapi/v1/mark`
- `https://eapi.binance.com/eapi/v1/index?underlying=BTCUSDT`

当前权利金口径使用 option `markPrice`，不是 bid、ask 或 last price。

如果生产环境遇到跨域或网络限制，需要在 Nginx、域名或其他网关层处理；本项目不再提供后端代理。
