# 100pro1

画像変換・お絵描き・作品共有SNSのウェブアプリです。
画像のぼかし・減色・領域の平滑化・線画生成は C で実装し、WebAssembly としてブラウザ上で実行します。
C の処理は画像処理ライブラリや C 標準ライブラリに依存せず、`-nostdlib` でコンパイルします。

完成した作品はタイムラインに投稿でき、いいね・コメント・ニックネーム/アイコン設定が使えます。
SNS機能のサーバー（`server/server.mjs`）も Node.js 標準機能のみで実装しており、追加の npm ライブラリは不要です。
投稿データは `server/data/` に保存されます（Git管理外）。

## セットアップ

事前に Node.js 18 以上をインストールしてください。初回セットアップ時には WASI SDK を取得するため、インターネット接続も必要です。

### macOS

```bash
./setup.sh
```

### Windows PowerShell

```powershell
.\setup.ps1
```

PowerShell のスクリプト実行が制限されている場合は、コマンドプロンプトから実行できます。

```bat
setup.cmd
```

このスクリプトは次の処理を行います。

- npm 依存関係のインストール
- WASI SDK の取得（初回のみ。`.tools` に保存）
- `native/image_processor.c` の WebAssembly へのコンパイル

セットアップと C のビルド処理は Node.js の標準機能のみで実装しており、追加の npm ライブラリは使用していません。

WASI SDK をすでにインストールしている場合は、macOS では次のように指定できます。

```bash
WASI_SDK_PATH=/path/to/wasi-sdk ./setup.sh
```

Windows PowerShell では次のように指定します。

```powershell
$env:WASI_SDK_PATH = "C:\path\to\wasi-sdk"
.\setup.ps1
```

## 開発サーバーを起動

```bash
npm run dev
```

このコマンドで、SNS用APIサーバー（ポート3001）と Vite 開発サーバーが同時に起動します。
ターミナルに表示される URL（通常は `http://localhost:5173`）をブラウザで開いてください。

`Network:` に表示される URL を使うと、同じWi-Fi内の別の端末（友だちのスマホなど）からもアクセスでき、タイムラインを共有できます。

## 本番用にビルドして実行

本番ビルドを作成します。C の画像処理もこのコマンド内で再コンパイルされます。

```bash
npm run build
```

ビルドしたアプリを起動します。SNS用サーバーが `dist/` の配信も兼ねるので、これ1つで完結します。

```bash
npm start
```

起動後、`http://localhost:3001` をブラウザで開いてください。
同じLAN内の別の端末からは `http://<このPCのIPアドレス>:3001` でアクセスできます。
終了するには、ターミナルで `Ctrl+C` を押します。

（`npm run preview` は SNS サーバーを含まない Vite のプレビュー用で、タイムラインは利用できません。）

## SNS機能

- **みんなの作品**タブ: 投稿された作品のタイムライン。いいね❤️とコメント💬ができます。自分の投稿は削除もできます。
- **マイページ**タブ: ニックネームとアイコンの設定、この端末に保存した作品の一覧（過去の作品もここから投稿できます）。
- 投稿・いいね・コメントは同じサーバーに接続している全員で共有されます。アカウント登録は不要で、端末ごとに自動発行されるIDで「自分の投稿」「いいね済み」を判定します。
- データは `server/data/posts.json` と `server/data/images/` に保存されます。全部消したい場合はこのフォルダを削除してください。

## C の画像処理だけを再コンパイル

`native/image_processor.c` を変更した場合は、次のコマンドだけでも WebAssembly を再生成できます。

```bash
npm run build:wasm
```

生成先は `public/wasm/image_processor.wasm` です。
