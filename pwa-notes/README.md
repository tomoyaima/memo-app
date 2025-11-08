# Notes PWA

オフラインでも動作する TinyMCE ベースのメモアプリです。React + TypeScript + Vite をベースに、IndexedDB 保存、Workbox Service Worker、Background Sync、全文検索、タグ/ピン留め/アーカイブ、認証プロバイダー差し替えに対応した設計になっています。

## 主な機能

- ✅ メモ CRUD（TinyMCE によるリッチテキスト編集、タグ、ピン留め、アーカイブ）
- ✅ IndexedDB (`idb`) 保存とローカル全文検索
- ✅ PWA（App Shell 事前キャッシュ、ランタイムキャッシュ、Background Sync、インストールプロンプト）
- ✅ 将来の同期 API を想定した `sync/api.ts` + `sync/conflicts.ts`
- ✅ 認証プロバイダー切り替え（Auth0 / Cognito / Supabase / none）
- ✅ ノート単位の共有/ACL（Cognito ユーザー ID ベース）
- ✅ Vitest + Testing Library による最小テスト

## ディレクトリ構成

```
pwa-notes/
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ components/
│  ├─ routes/
│  ├─ hooks/
│  ├─ db/
│  ├─ sw/
│  ├─ sync/
│  └─ styles/
├─ tests/
│  ├─ app.spec.tsx
│  └─ db.spec.ts
├─ workbox-config.js
├─ vite.config.ts
└─ tsconfig.*.json
```

## セットアップ

```bash
pnpm install # もしくは npm install / yarn
```

必要な環境変数（`.env` などに定義します）:

```
VITE_APP_NAME=Notes PWA
VITE_API_BASE_URL=/api
VITE_AUTH_PROVIDER=none   # none|auth0|cognito|supabase
VITE_TINYMCE_API_KEY=__REPLACE_ME__
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=your-domain.auth.ap-northeast-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=http://localhost:4173/auth/callback
VITE_COGNITO_LOGOUT_URI=http://localhost:4173
VITE_COGNITO_SCOPES=openid email profile
```

## npm scripts

| script        | 説明                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `npm run dev` | Vite 開発サーバー                                                    |
| `npm run lint`| ESLint (Flat config)                                                 |
| `npm run test`| Vitest（jsdom、Coverage 付き）                                       |
| `npm run build` | `tsc -b` → `vite build` → `tsc -p tsconfig.sw.json` → `workbox injectManifest` |
| `npm run preview` | `dist/` を配信                                                    |

`npm run build` の完了後、`dist/` 直下に本番配信物 (HTML/CSS/JS/manifest/sw.js) が揃い、そのまま S3 へデプロイ可能です。Workbox の設定は `workbox-config.cjs` を参照してください。

### Cognito ログインの使い方

1. `.env` に `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_REDIRECT_URI`, `VITE_COGNITO_LOGOUT_URI` を設定し、開発サーバーを再起動。
2. Cognito User Pool の App Client では「Authorization code grant + PKCE」「Allowed callback URL = `/auth/callback`」を設定し、Hosted UI ドメインを `.env` の `VITE_COGNITO_DOMAIN` に合わせます。
3. アプリ「設定」画面の「Cognito にログイン」ボタンを押すと Hosted UI へリダイレクト→サインイン後 `/auth/callback` でトークンを交換します。
4. 取得した `access_token` は `sync/api.ts` の `fetch` に `Authorization: Bearer <token>` として自動付与され、ログアウトすると Cognito の `/logout` に遷移してセッションを破棄します。

### ノート共有 (ACL)

1. バックエンドで `NOTES_ACL_TABLE`（PK: `userId`, SK: `noteId`, 属性: `ownerId`, `canEdit`, `updatedAt`）を用意し、Lambda 環境変数 `NOTES_ACL_TABLE` を設定します。
2. API Gateway に `POST /notes/share` を追加し、`shareNote.handler` を統合（Cognito Authorizer 必須）。
3. ノート詳細画面に共有フォームが追加され、Cognito のユーザーID (`sub`) を入力して閲覧/編集権限を付与または解除できます。
4. 共有されたユーザーは `/notes/changes` 経由でノートを受け取り、`canEdit` が有効なら共同編集できます。

## アーキテクチャ概要

- **Data Layer**: `src/db` で `idb` をラップ。`notes` ストア（indexes: `by-updated`, `by-dirty`, `by-tags`）と `meta` ストアを管理。
- **Hooks**: `useIndexedDB` が NotesContext を提供し、CRUD・同期・メタ情報を UI に供給。`useInstallPrompt` が PWA インストール UI を抽象化。`useAuth` は Cognito ログイン状態を管理し、セッションを `localStorage` と共有します。
- **Service Worker**: `src/sw/service-worker.ts` を Workbox `injectManifest` でビルド。App Shell precache、API キャッシュ、画像キャッシュ、Background Sync（POST `/api/*`）を扱います。
- **TinyMCE**: `components/Editor.tsx` で `@tinymce/tinymce-react` を初期化。`VITE_TINYMCE_API_KEY` を使う想定です。
- **同期スタブ**: `sync/api.ts`（`pushChanges` / `pullSince`）と `sync/conflicts.ts`（Last-Write-Wins）が API Gateway + Lambda + DynamoDB を想定した実装を受け入れるための足場です。

## デプロイ（S3 + CloudFront）

1. **S3 バケット作成（Private）**
   ```bash
   aws s3api create-bucket --bucket ${BUCKET} --region ${AWS_REGION} \
     --create-bucket-configuration LocationConstraint=${AWS_REGION}
   aws s3api put-public-access-block --bucket ${BUCKET} \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```
2. **CloudFront OAC 作成 → S3 バケットポリシーにアタッチ**  
   バケットポリシーは `SourceArn=arn:aws:cloudfront::ACCOUNT:distribution/DISTRIBUTION_ID` のみを許可してください。
3. **キャッシュポリシー**
   - `index.html`: `Cache-Control: no-cache`
   - `assets/*.js`, `*.css`, `*.png`（ハッシュ付き）: `Cache-Control: public, max-age=31536000, immutable`
   - `manifest.webmanifest`, `sw.js`: `Cache-Control: max-age=3600`
4. **SPA ルーティング**
   CloudFront の `Custom Error Response` で 404 → `/index.html` にフォールバック（HTTP 200）。
5. **デプロイ**
   ```bash
   npm run build
   aws s3 sync dist/ s3://${BUCKET}/ --delete
   aws cloudfront create-invalidation --distribution-id ${CF_DISTRIBUTION_ID} --paths '/*'
   ```

### 推奨 CSP 例

```
default-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
script-src 'self';
img-src 'self' data: blob:;
connect-src 'self' https://your-api.example.com;
```

## テスト

- `tests/app.spec.tsx`: Home 画面の検索や作成ボタンをモックした NotesContext で検証
- `tests/db.spec.ts`: `fake-indexeddb` を使って IndexedDB CRUD と dirty フラグ制御を検証

```bash
npm run test
```

## 今後の拡張メモ

- 画像/音声添付、PDF 注釈
- Realtime 同期、共同編集、Auth 連携
- AI サジェスト（要約/タグ自動付与）
- Playwright などによる E2E + Lighthouse 自動検証
