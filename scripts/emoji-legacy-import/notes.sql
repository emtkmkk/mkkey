-- 申請チャンネル（9df6cnh6du）の mkdev の「絵文字申請」ノートを、回答シートの行番号つきで JSON にする（読み取りのみ）。
-- TEMP: 過去の追加申請の移行用。移行が終わったらこのディレクトリごと削除する。
-- 結果を input/notes.json に保存し、build.mjs に読ませる。
-- 例：psql -X -A -t -f notes.sql > input/notes.json
-- 行番号は、直後に投稿される「この絵文字を登録する(id:N)」のノートの row=N から取る（N は回答シートの行番号。見出しが 1 行目）。
WITH ch AS (
  SELECT n.id, n."createdAt", n.text, n."fileIds"
  FROM note n JOIN "user" u ON u.id = n."userId"
  WHERE n."channelId" = '9df6cnh6du' AND u.username = 'mkdev' AND u.host IS NULL
),
req AS (
  SELECT c.*,
    substring(c.text from '`:([a-z0-9_]+):`') AS name,
    substring(c.text from E'申請者\\n@([A-Za-z0-9_]+)') AS requester
  FROM ch c WHERE c.text LIKE '絵文字申請%'
),
paired AS (
  SELECT r.*, (
    SELECT substring(c2.text from 'row=([0-9]+)')::int FROM ch c2
    WHERE c2.text LIKE '%row=%' AND c2."createdAt" >= r."createdAt" AND c2."createdAt" < r."createdAt" + interval '30 seconds'
    ORDER BY c2."createdAt" LIMIT 1) AS row
  FROM req r
)
SELECT json_agg(json_build_object(
  'noteId', p.id,
  'createdAt', p."createdAt",
  'name', p.name,
  'requester', p.requester,
  'requesterExists', EXISTS (SELECT 1 FROM "user" u WHERE u.username = p.requester AND u.host IS NULL),
  'fileId', p."fileIds"[1],
  'fileExists', EXISTS (SELECT 1 FROM drive_file f WHERE f.id = p."fileIds"[1]),
  'row', p.row,
  'localExists', EXISTS (SELECT 1 FROM emoji e WHERE e.name = p.name AND e.host IS NULL)
) ORDER BY p."createdAt")
FROM paired p;
