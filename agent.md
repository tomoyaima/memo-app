# agent.md — Notes PWA (React + TypeScript + Vite)

> このドキュメントは、コード生成エージェント（例: Codex/Copilot/自動化エージェント）に対して、**要件・仕様・設計・出力物**を明確に伝えるための指示書です。エージェントは本書のとおりに実装・検証・出力を行ってください。

---

## 0. ゴール / 成果物

* **PWAメモ帳アプリ**の実装一式（フロントエンド・Service Worker・IndexedDB・最低限の同期APIスタブ）。
* **S3 + CloudFront** での静的ホスティングを前提としたビルド成果物（`dist/`）。
* 初期機能:

  * メモ CRUD（作成/編集/削除/アーカイブ）
  * タグ付け・ピン留め・ローカル全文検索
  * オフライン動作（App Shell プリキャッシュ、ランタイムキャッシュ、Background Sync）
  * TinyMCE でのリッチテキスト編集
  * IndexedDB（`idb`）でローカル保存
  * 認証の差し替え可能な構造（Auth0/Cognito/Supabase Auth）
  * 将来の同期先: API Gateway + Lambda + DynamoDB

---

## 1. 技術スタック

* **Frontend**: React 18 + TypeScript + Vite
* **Editor**: TinyMCE (`@tinymce/tinymce-react`)
* **Local DB**: IndexedDB (ライブラリ: `idb`)
* **PWA**: Web App Manifest + Service Worker (Workbox)
* **Build**: Vite + Workbox CLI (`workbox-build`/`workbox-cli`)
* **Hosting**: S3 (private) + CloudFront (OAC)
* **Auth (選択式)**: Auth0 / Amazon Cognito / Supabase Auth
* **Lint/Format**: ESLint + Prettier
* **Test**: Vitest + Testing Library

---

## 2. ディレクトリ構成（生成指示）

```
pwa-notes/
├─ public/
│  ├─ index.html
│  ├─ manifest.webmanifest
│  └─ icons/ (192,512,maskable 等)
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ routes/
│  │  ├─ Home.tsx
│  │  ├─ NoteDetail.tsx
│  │  └─ Settings.tsx
│  ├─ components/
│  │  ├─ Editor.tsx
│  │  ├─ NoteCard.tsx
│  │  └─ InstallPrompt.tsx
│  ├─ db/
│  │  ├─ idb.ts
│  │  ├─ models.ts
│  │  └─ queries.ts
│  ├─ sw/
│  │  └─ service-worker.ts (generateSW or injectManifest どちらでも可)
│  ├─ sync/
│  │  ├─ api.ts
│  │  └─ conflicts.ts
│  ├─ hooks/
│  │  ├─ useIndexedDB.ts
│  │  └─ useInstallPrompt.ts
│  └─ styles/
├─ tests/
│  ├─ app.spec.tsx
│  └─ db.spec.ts
├─ workbox-config.js
├─ vite.config.ts
├─ package.json
└─ README.md
```

---

## 3. 環境変数と設定

`.env` / `.env.production` の例:

```
VITE_APP_NAME=Notes PWA
VITE_API_BASE_URL=/api
VITE_AUTH_PROVIDER=none # none|auth0|cognito|supabase
VITE_TINYMCE_API_KEY=__REPLACE_ME__
```

`manifest.webmanifest`:

```json
{
  "name": "Notes PWA",
  "short_name": "Notes",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b132b",
  "theme_color": "#0b132b",
  "lang": "ja",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable any" }
  ]
}
```

---

## 4. データモデル

```ts
type Note = {
  id: string;           // uuid
  title: string;
  contentHtml: string;  // TinyMCE のHTML
  tags: string[];
  pinned: boolean;
  updatedAt: number;    // epoch ms
  deleted?: boolean;    // ソフト削除
  dirty?: boolean;      // 未同期フラグ
  encIv?: string;       // 端末暗号化時のIV（任意）
}
```

`idb` スキーマ（`src/db/idb.ts`）:

```ts
import { openDB, DBSchema } from 'idb';

interface NotesDB extends DBSchema {
  notes: { key: string; value: Note; indexes: { 'by-updatedAt': number; 'by-tags': string } };
  meta:  { key: string; value: any };
}

export const getDB = () => openDB<NotesDB>('notes-db', 1, {
  upgrade(db) {
    const store = db.createObjectStore('notes', { keyPath: 'id' });
    store.createIndex('by-updatedAt', 'updatedAt');
    store.createIndex('by-tags', 'tags', { multiEntry: true });
    db.createObjectStore('meta');
  }
});
```

---

## 5. 主要機能の実装要件

### 5.1 CRUD & UI

* Home: フィルタ（タグ/ピン留め）、検索ボックス、カード一覧
* NoteDetail: TinyMCE 埋め込み、タイトル/タグ編集、保存時に `updatedAt` 更新
* 削除はソフト削除（`deleted=true`）
* アクセシビリティ（キーボード操作/ラベル）とダークモード対応

### 5.2 検索

* ローカル全文検索は初期は単純な `includes` ベース
* 将来 `mini-search`/`lunr` でインデックス化できる構造に

### 5.3 PWA/Service Worker

`src/sw/service-worker.ts`（要点）:

* `workbox-precaching` で App Shell をプリキャッシュ
* `document/style/script/worker` は `StaleWhileRevalidate`
* 画像は `CacheFirst` + 期限
* `/api/` は `NetworkOnly` + `BackgroundSync`
* `message(SKIP_WAITING)` を受け取り即時更新

`workbox-config.js`（例）:

```js
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  runtimeCaching: [
    {
      urlPattern: ({request}) => ['document','style','script','worker'].includes(request.destination),
      handler: 'StaleWhileRevalidate'
    },
    {
      urlPattern: ({request}) => request.destination === 'image',
      handler: 'CacheFirst',
      options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 2592000 } }
    },
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
      options: { backgroundSync: { name: 'api-queue', maxRetentionTime: 1440 } }
    }
  ]
}
```

### 5.4 認証（差し替えポイント）

* `src/auth/` を用意し、`provider=none|auth0|cognito|supabase` を環境変数で切替
* いずれも **Authorization Code + PKCE** を前提とする設計（実装はスケルトンでOK）
* API 呼び出し時は `Authorization: Bearer <token>` を添付できるインターフェイス

### 5.5 同期 API（スタブ）

* `src/sync/api.ts` に `pushChanges(changes)` と `pullSince(since)` を実装（スタブ）
* 競合は LWW（`updatedAt` の大きい方優先）を `conflicts.ts` に関数実装

---

## 6. セキュリティ要件

* すべての通信は HTTPS 前提
* IndexedDB 暗号化の導線（PBKDF2 + AES-GCM）をユーティリティとして雛形提供（実装はライトで可）
* CSP/セキュリティヘッダーは CloudFront 側で設定できる前提で、README に推奨値を記載

---

## 7. ビルド & デプロイ

### 7.1 npm scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && workbox generateSW workbox-config.js",
    "preview": "vite preview"
  }
}
```

### 7.2 S3 + CloudFront（README に掲載するコマンド）

* S3 私有バケット作成、Public Access Block 全ON
* CloudFront OAC 設定、S3バケットポリシーは `SourceArn`=Distribution に限定
* `index.html` は `no-cache`、ハッシュ付き `*.js/*.css` は `immutable, max-age=31536000`
* `manifest.webmanifest` と `sw.js` は短め TTL（例: 1h）
* SPA ルーティング用に CloudFront の 404 → `/index.html` へフォールバック（200）

---

## 8. CI/CD（任意）

* GitHub Actions: `push` 時に `npm ci && npm run build` → S3 Sync → CloudFront Invalidation
* 環境変数/シークレット: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `BUCKET`, `CF_DISTRIBUTION_ID`, `VITE_*`

---

## 9. テスト / 品質

* **Lighthouse**: PWA/Performance/Best Practices/Accessibility すべて 90+ を目標
* Vitest: 主要ロジック（DB CRUD、検索、SW メッセージング）をカバー
* E2E（任意）: Playwright で基本シナリオ（オフライン閲覧/編集→再接続同期）

---

## 10. 受け入れ基準（Acceptance Criteria）

* [ ] オフライン状態でも Home/NoteDetail が表示・編集できる
* [ ] 再接続時に Background Sync で未送信変更がサーバ（スタブ）に送られる
* [ ] 新SW 検出時に更新通知→即時適用（`SKIP_WAITING`）が機能
* [ ] TinyMCE での編集結果が IndexedDB に保存され、リロード後も復元
* [ ] タグ/ピン留め/検索が動作
* [ ] S3+CloudFront の配信で SPA 直リンクが動作（404→index.html）
* [ ] Lighthouse PWA チェックが `Installable` になる

---

## 11. エージェントへの実行手順（プロンプト）

1. 新規 Vite プロジェクト作成（React + TS）。
2. 依存追加: `idb workbox-window workbox-core workbox-routing workbox-strategies workbox-precaching workbox-expiration workbox-background-sync @tinymce/tinymce-react`。
3. 本書のディレクトリ構成・雛形ファイルを生成。
4. `workbox-config.js` を配置し、`npm run build` で `dist/sw.js` を生成。
5. `README.md` にデプロイ手順と CloudFront 設定例、CSP 推奨値を記載。
6. `tests/` に最小テストを追加し `npm test` が成功する状態に。

エージェントは、上記の **構成/コード/設定/README/テスト** を一括生成し、ビルドが成功することを確認してください。

---

## 12. 将来拡張のメモ（任意）

* Realtime 同期（WebSocket）
* 共有/共同編集（鍵共有 or サーバ側権限管理）
* 画像/音声/ファイル添付、PDF 注釈
* 手書き（Canvas/Excalidraw）
* AI 要約/タグ自動付与（ローカル/サーバ）

---

## 付録 A: TinyMCE コンポーネント例（抜粋）

```tsx
import { Editor } from '@tinymce/tinymce-react';

type Props = { value: string; onChange: (html: string) => void };
export default function NoteEditor({ value, onChange }: Props) {
  return (
    <Editor
      apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
      initialValue={value}
      init={{
        menubar: false,
        plugins: 'link lists table code image autoresize',
        toolbar: 'undo redo | styles | bold italic | alignleft aligncenter alignright | bullist numlist | link image | code',
        min_height: 320,
        branding: false
      }}
      onEditorChange={onChange}
    />
  );
}
```

## 付録 B: SW の `message` ハンドラ（抜粋）

```ts
self.addEventListener('message', (event: any) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
```

## 付録 C: 簡易同期API（スタブ）

```ts
export async function pushChanges(changes: any[]) {
  const res = await fetch('/api/notes/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes })
  });
  if (!res.ok) throw new Error('push failed');
  return res.json();
}

export async function pullSince(since: number) {
  const res = await fetch(`/api/notes/changes?since=${since}`);
  if (!res.ok) throw new Error('pull failed');
  return res.json();
}
```
