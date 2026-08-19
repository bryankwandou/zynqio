-- ============================================================
-- ZYNQIO — Migrasi 0002: pengambilan peti pada mode Gold Quest
--
-- Endpoint select-chest sebelumnya menerima playerId apa adanya dari
-- badan permintaan, tanpa batas berapa kali boleh dipanggil. Satu peserta
-- bisa memanggilnya berulang-ulang dan mengumpulkan seribu poin tiap kali
-- beruntung. Tabel ini membuat satu putaran hanya bisa diambil sekali,
-- dijamin indeks, bukan oleh pemeriksaan di aplikasi.
-- ============================================================

CREATE TABLE IF NOT EXISTS chest_picks (
  id             bigserial PRIMARY KEY,
  session_id     text    NOT NULL,
  room_code      char(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player_id      text    NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  question_index integer NOT NULL CHECK (question_index >= 0),
  outcome        jsonb   NOT NULL,
  awarded        integer NOT NULL DEFAULT 0,
  picked_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chest_picks_once_uniq
  ON chest_picks (session_id, player_id, question_index);

CREATE INDEX IF NOT EXISTS chest_picks_room_idx ON chest_picks (room_code);

-- Regu peserta pada mode beregu. Disimpan sebagai kolom, bukan sebagai
-- bagian gumpalan keadaan ruangan, supaya bisa diubah satu peserta tanpa
-- menulis ulang seluruh daftar.
ALTER TABLE room_players ADD COLUMN IF NOT EXISTS team text;

CREATE INDEX IF NOT EXISTS room_players_team_idx
  ON room_players (room_code, team) WHERE team IS NOT NULL;
