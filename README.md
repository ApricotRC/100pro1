# 100pro1

画像変換・お絵描き用のシングルページアプリです。
画像のぼかし・減色・領域の平滑化・線画生成は C で実装し、WebAssembly としてブラウザ上で実行します。
C の処理は画像処理ライブラリや C 標準ライブラリに依存せず、`-nostdlib` でコンパイルします。

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

ターミナルに表示される URL（通常は `http://localhost:5173`）をブラウザで開いてください。

## 本番用にビルドして実行

本番ビルドを作成します。C の画像処理もこのコマンド内で再コンパイルされます。

```bash
npm run build
```

ビルドしたアプリを起動します。

```bash
npm run preview
```

起動後、ターミナルに表示される URL（通常は `http://localhost:4173`）をブラウザで開いてください。
終了するには、ターミナルで `Ctrl+C` を押します。

## C の画像処理だけを再コンパイル

`native/image_processor.c` を変更した場合は、次のコマンドだけでも WebAssembly を再生成できます。

```bash
npm run build:wasm
```

生成先は `public/wasm/image_processor.wasm` です。
