# 固定 SNS 紹介画像と X 導線の受入

- 正式名「ヒトを許すな！」を表示し、タグは句読点で途切れない `#ヒトを許すな #ゲーム制作`。home/result の実ハンドラを15言語で確認し、URLは登録済み Codeberg のまま。
- 画像は 1200×630。実ゲームの startGame / placeTower / startWave / update / render をローカル無通信で使い、第1波の3秒経過時点（弓1台、ネズミ5体）の盤面を紹介レイアウトに配置。勝利/個人名/架空スコアは載せない。カウントダウン待ちを省いた再現用固定素材で、本人プレイの記録ではない。
- SVGは編集元、PNGだけ配信対象。Noto Color Emoji (SIL Open Font License 1.1) の必要グリフだけを画像として埋込み、フォントファイルは配信しない。背景/道/盤面/敵HP/配置は実描画由来。renderer の描画APIはこの固定状態に必要な部分だけ。

## 検査

`npm test`、`python3 tools/check-site.py --out _site`、既存 Chromium/WebKit suite、新規 `BROWSER_ENGINE=chromium node tools/share-visual.cjs` と WebKit。

新規: 15言語 × 縦402×874/横874×402 × home/result、各60例/engine。黒白X、翻訳、ランキング、44px以上、全rectのviewport/overflow内、中心hit、実tapによる今回新規intentを1件だけ捕捉、本文・2タグ・正式URL・失敗時手動コピーの内容一致。共有による結果不変、スコア送信0を検査。hidden/親opacity0/部分clip/固定位置欠けの故障対照も含む。

各localeの匿名結果は既存テスト同様 waveIndex=2/kills=5/endGame(false)/showResult を使う表示fixture。通常全30波のクリア検証やスコア本番登録ではない。service worker/WebSocket/未知HTTPは許可せず、HTML GET/HEADだけ固定byteからfulfill、ランキングは空配列、Xはmock composer。既存named ACKテストの送信もRPC mockのみで、実本番リクエストは無い。

スクリーンショットはfullpage（初期viewport常時表示の意味ではない）。本番端末、iPhone実機、公開X crawlerのカード、Codeberg側の画像配信は未確認。GitHub画像URLの設定準備と、マージ後の実公開は別段階。

## 戻す方法

今回のPRコミットを通常のrevert PRで戻す。既存のルール/採点/識別値/保存/提出契約は変更しない。公開の切替・DB・権限・既存記録の削除はこのPRで行わない。

素材比較用に ja では実タップで開始・弓を設置し、通常のカウントダウン/時間進行で第1波3秒以降の実canvasを両engineで保存する。clock/draw/スコアの書換えはしない。その後の結果表示fixtureとは別検査。描画アダプタによる紹介画像を実スクリーンショットとは呼ばない。未知HTTPとWebSocketも試行数0を別検査。

共有の成功タップと失敗fallbackタップは独立ジェスチャーとして、既存の360ms連打抑止が自然に明けたことを待って実施する（製品の抑止は変更しない）。初回CIのfallback未表示と同型の360ms未満抑止を実listenerの単体検査で再現した。初回の実タップ間隔は未計測のため原因確定とはせず、次CIで条件待機を加えて照合する。旧失敗記録は保持する。
