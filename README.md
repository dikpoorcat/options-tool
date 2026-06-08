# BTC 期权卖 Put 年化工具

这是一个本地网页工具，用 Binance European Options 公共行情接口自动更新 BTC Put 标记价，并计算卖 Put 年化收益。

第一版不需要 Binance API Key，不下单，不读取账户，也不保存任何私钥或账户配置。

## 架构

- 前端：Vite + React + TypeScript
- 后端：Flask + Python （部署在ALY，已开机自动启动）
- 本地 API：`GET /api/options/btc-put`

前端仍然通过 `/api` 请求后端；开发环境下 Vite 会把 `/api` 代理到 Flask 的 `127.0.0.1:8787`。

## 功能

- 从 Binance 公共接口拉取 BTC 期权合约、mark price 和 BTC 指数价。
- 只展示未过期、交易中的 BTC Put 合约。
- 按参考价格自动选择附近行权价，支持选择行权价间隔，也可以点击行权价锁定常看的价格。
- 支持切换收益口径：
  - 实际年化：`净权利金 / 每张保证金 * 365 / 剩余天数 * 100%`
  - 全担保年化：`净权利金 / 行权价 * 365 / 剩余天数 * 100%`
- `净权利金 = markPrice - max(行权价 - BTC 指数价, 0)`。
- 默认每 30 秒自动刷新，也可以手动刷新。
- Binance 请求失败时，后端会尽量返回最近一次成功快照，并在界面提示 stale 状态。

## 运行

安装前端依赖：

```powershell
npm install
```

安装 Flask 后端依赖：

```powershell
python -m pip install -r requirements.txt
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
npm run start
```

`npm run start` 只启动 Flask 后端；生产环境中可以用 Nginx 托管 `dist/`，再把 `/api` 反代到 Flask 后端。

## 服务器后端脚本

`server/run.sh` 是给服务器使用的 Gunicorn 启停脚本，默认假设后端项目目录为：

```text
/root/Code/hundao_app/apps/2_options_calc
```

常用命令：

```bash
chmod +x server/run.sh
server/run.sh start
server/run.sh status
server/run.sh restart
server/run.sh stop
```

如果服务器路径不同，可以在执行前覆盖变量，例如：

```bash
PROJECT_ROOT=/root/Code/hundao_app/apps/2_options_calc PORT=8787 server/run.sh restart
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
- Nearby Strikes：`6`
- Strike Interval：`1000`
- 权利金：Binance option `markPrice`
- 实际年化分母：每张保证金
- 全担保年化分母：行权价
