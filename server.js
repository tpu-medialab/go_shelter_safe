// ❶ .env ファイルの内容を process.env に読み込む
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3002;

// ②--- 静的ファイルのパス設定 ---

// 1. 'src' ディレクトリ全体を公開 (index.html, map_logic.jsなどが含まれる)
// クライアントは /index.html, /map_logic.js などでアクセス可能
app.use(express.static(path.join(__dirname, 'src'))); 

// 2. 'data' ディレクトリの内容を '/data' パスで公開
// クライアントは /data/map_data.json でアクセス可能
app.use('/data', express.static(path.join(__dirname, 'data')));


// ❸ ルート ("/") へのリクエストを処理
app.get('/', (req, res) => {
    
    // index.html ファイルを新しい場所 (src/index.html) から読み込む
    const htmlPath = path.join(__dirname, 'src', 'index.html');
    let htmlContent;
    
    try {
        htmlContent = fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
        console.error('index.html の読み込みエラー:', error);
        return res.status(500).send('サーバーエラー：index.html が見つかりません。');
    }
    
    // ❹ .env から API キーを取得
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
        console.warn('.env ファイルに GOOGLE_MAPS_API_KEY が設定されていません。地図は動作しない可能性があります。');
    }
    
    // ❺ HTML のプレースホルダー (key=GOOGLE_MAPS_API_KEY) を実際の API キーで置き換え
    // キーがない場合はプレースホルダーを残し、APIのエラーメッセージが出るようにする
    const modifiedHtml = htmlContent.replace(
        'key=GOOGLE_MAPS_API_KEY', 
        `key=${apiKey || 'YOUR_API_KEY_HERE'}` 
    );
    
    // 置き換えた HTML をクライアントに送信
    res.send(modifiedHtml);
});

// サーバーの起動
app.listen(port, () => {
    console.log(`サーバー起動: http://localhost:${port}`);
});