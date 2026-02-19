[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Google Maps API](https://img.shields.io/badge/API-Google%20Maps-red)](https://developers.google.com/maps)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

# go_shelter_safe
最も近い避難所に最も安全にたどり着くルートを提示します。

## 機能

### 1. 避難所と水害リスクの情報をもとに経路探索を行う


## インストール方法

### 推奨環境
- **Node.js**: v18.x
- **Google Maps JavaScript API Key**

プロジェクトルートに `.env` ファイルを作成し、取得したGoogle Maps APIキーを設定してください。

```bash
git clone https://github.com/tpu-medialab/atsugiCrop.git
cd atsugiCrop

# .env ファイルの作成
echo "GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE" > .env
#html9行目の[your　APIkey]に自分のAPIkeyを入力する

#サーバーの起動:
node server.js
```
ブラウザでの確認: http://localhost:3000 にアクセスし、3Dデータの可視化を確認します。


## 貢献
バグ報告、機能改善の提案、プルリクエストを歓迎します。

## ライセンス
本プロジェクトは MIT License の下で公開されています。

## 問い合わせ
東京工芸大学 工学部 映像メディア研究室
https://www.mega.t-kougei.ac.jp/media/

森山剛
- E-mail: moriyama@t-kougei.ac.jp
- Facebook：https://www.facebook.com/tsuyoshi.moriyama
- Instagram: https://www.instagram.com/tsuyoshi.moriyama

##
@misc{atsugiCrop2026,
  title     = {atsugiCrop},
  author    = {Yuki Hitomi and Koya Arashiro ,Tsuyoshi Moriyama},
  year      = {2026},
  url       = {[https://github.com/tpu-medialab/go_shelter_safe/]}
}
