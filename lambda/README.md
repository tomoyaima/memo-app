# Notes API Lambdas

Notes PWA のサーバ側処理 (API Gateway + Lambda + DynamoDB) を TypeScript でまとめています。

## ディレクトリ構成

```
lambda/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ handlers/
   │  ├─ notesBatch.ts     # POST /notes/batch
   │  ├─ notesChanges.ts   # GET /notes/changes
   │  └─ shareNote.ts      # POST /notes/share
   ├─ shared/dynamo.ts     # DynamoDB DocumentClient 初期化
   └─ types.ts             # 共有型
```

## 各ハンドラー

| ファイル | エンドポイント | 役割 |
| --- | --- | --- |
| `notesBatch.ts` | `POST /notes/batch` | メモ変更をバッチ upsert。所有者でない場合は ACL を確認して編集可否を判断します。 |
| `notesChanges.ts` | `GET /notes/changes?since=unix_ms` | 自分のメモ + 共有されたメモを GSI/ACL テーブルから取得し差分返却。 |
| `shareNote.ts` | `POST /notes/share` | ノート所有者が閲覧/編集権限を付与または解除する。 |

## 環境変数

| 変数 | 説明 | 例 |
| --- | --- | --- |
| `AWS_REGION` | 実行リージョン | `ap-northeast-1` |
| `NOTES_TABLE` | メイン DynamoDB テーブル | `notes-pwa` |
| `NOTES_UPDATED_AT_GSI` | 更新時刻で pull する GSI | `gsiUpdatedAt` |
| `NOTES_ACL_TABLE` | 共有 ACL テーブル | `notes-acl` |
| `MAX_CHANGES` | 1 回の pull 上限 | `500` |

### 推奨スキーマ

`NOTES_TABLE`
```
PK: userId (owner)
SK: noteId
Attributes: ownerId, title, contentHtml, tags[], pinned, deleted, updatedAt, ...
GSI gsiUpdatedAt:
  PK = ownerId
  SK = updatedAt (Number)
```

`NOTES_ACL_TABLE`
```
PK: userId (共有を受けるユーザー)
SK: noteId
Attributes: ownerId, canEdit (bool), updatedAt
```

## ビルド & デプロイ

```bash
cd lambda
npm install
npm run build
```

生成される `dist/handlers/*.js` を Lambda 関数へアップロードし、API Gateway HTTP API の各ルートに割り当てます。

- `POST /notes/batch` → `notesBatch.handler`
- `GET /notes/changes` → `notesChanges.handler`
- `POST /notes/share` → `shareNote.handler`

API Gateway では Cognito User Pool Authorizer を使い、`Authorization: Bearer <token>` を検証してください。
