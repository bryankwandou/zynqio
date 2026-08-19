-- ============================================================
-- ZYNQIO — Migrasi 0001: skema awal Postgres (Neon)
-- Menggantikan penyimpanan key-value Upstash Redis.
--
-- Tiga prinsip yang dipegang di sini:
--  1. Kunci jawaban tidak pernah ikut terbaca bersama soal.
--     Kolomnya berdiri sendiri supaya query publik bisa memilih
--     kolom secara eksplisit tanpa risiko terbawa.
--  2. Aturan "satu kali jawab" dijamin constraint, bukan SETNX.
--  3. State ruangan memakai nomor versi supaya dua penulis
--     bersamaan tidak saling menimpa diam-diam.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Pengguna
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  username      text   NOT NULL,
  password_hash text,
  role          text   NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_created_idx ON users (created_at DESC);

-- Token pemulihan kata sandi. Yang tersimpan hash-nya, bukan tokennya,
-- supaya isi tabel yang bocor tidak bisa langsung dipakai masuk.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prt_user_idx    ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS prt_expires_idx ON password_reset_tokens (expires_at);

-- ------------------------------------------------------------
-- Kuis dan soal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
  id           text PRIMARY KEY,
  host_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  author       text,
  category     text NOT NULL DEFAULT 'General',
  visibility   text NOT NULL DEFAULT 'private'
               CHECK (visibility IN ('private', 'unlisted', 'public')),
  cover_image  text,
  plays        integer NOT NULL DEFAULT 0 CHECK (plays >= 0),
  rating_sum   integer NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
  rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quizzes_host_idx     ON quizzes (host_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS quizzes_public_idx   ON quizzes (visibility, plays DESC) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS quizzes_category_idx ON quizzes (category) WHERE visibility = 'public';

-- Rata-rata rating dihitung saat dibaca, tidak disimpan terpisah,
-- supaya angkanya mustahil melenceng dari data penyusunnya.
CREATE OR REPLACE VIEW quiz_public AS
  SELECT id, host_id, title, description, author, category, cover_image,
         plays, rating_count,
         CASE WHEN rating_count = 0 THEN 0
              ELSE ROUND(rating_sum::numeric / rating_count, 2)
         END AS rating,
         created_at, updated_at
  FROM quizzes
  WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        text NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position       integer NOT NULL CHECK (position >= 0),
  type           text NOT NULL DEFAULT 'MCQ'
                 CHECK (type IN ('MCQ', 'TRUE_FALSE', 'TYPE_ANSWER', 'POLL')),
  text           text NOT NULL,
  options        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Dipisah dengan sengaja. Route publik tidak pernah menyebut kolom ini.
  correct_answer jsonb,
  explanation    text,
  image_url      text,
  points         integer NOT NULL DEFAULT 1  CHECK (points BETWEEN 0 AND 10000),
  time_limit     integer NOT NULL DEFAULT 30 CHECK (time_limit BETWEEN 5 AND 600),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, position)
);

CREATE INDEX IF NOT EXISTS questions_quiz_idx ON questions (quiz_id, position);

CREATE TABLE IF NOT EXISTS quiz_ratings (
  quiz_id    text NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, user_id)
);

-- ------------------------------------------------------------
-- Ruangan permainan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  code                   char(6) PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{6}$'),
  session_id             text NOT NULL UNIQUE,
  quiz_id                text NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  host_id                uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  status                 text NOT NULL DEFAULT 'waiting'
                         CHECK (status IN ('waiting', 'playing', 'paused', 'ended')),
  game_mode              text NOT NULL DEFAULT 'classic',
  settings               jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_question_index integer NOT NULL DEFAULT 0 CHECK (current_question_index >= 0),
  question_started_at    timestamptz,
  -- Naik satu tiap penulisan. Penulis yang membawa versi basi ditolak.
  version                integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  expires_at             timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS rooms_host_idx    ON rooms (host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rooms_expires_idx ON rooms (expires_at);
CREATE INDEX IF NOT EXISTS rooms_session_idx ON rooms (session_id);

CREATE TABLE IF NOT EXISTS room_players (
  id             text PRIMARY KEY,
  room_code      char(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  name           text NOT NULL,
  avatar_id      text NOT NULL DEFAULT 'fox',
  -- Token peserta disimpan sebagai hash, sama alasannya dengan token reset.
  token_hash     text NOT NULL,
  score          integer NOT NULL DEFAULT 0,
  total_answered integer NOT NULL DEFAULT 0,
  total_correct  integer NOT NULL DEFAULT 0,
  streak         integer NOT NULL DEFAULT 0,
  is_kicked      boolean NOT NULL DEFAULT false,
  joined_at      timestamptz NOT NULL DEFAULT now()
);

-- Nama unik per ruangan ditegakkan database, bukan dicek aplikasi.
-- Ini menutup balapan penamaan ganda yang selama ini hanya ditambal
-- dengan membaca ulang sesaat sebelum menulis.
CREATE UNIQUE INDEX IF NOT EXISTS room_players_name_uniq
  ON room_players (room_code, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS room_players_token_uniq
  ON room_players (token_hash);
CREATE INDEX IF NOT EXISTS room_players_room_idx
  ON room_players (room_code, score DESC);

-- ------------------------------------------------------------
-- Jawaban
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS answers (
  id          bigserial PRIMARY KEY,
  session_id  text NOT NULL,
  room_code   char(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  player_id   text NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice      jsonb,
  is_correct  boolean NOT NULL DEFAULT false,
  points      integer NOT NULL DEFAULT 0,
  response_ms integer CHECK (response_ms >= 0),
  answered_at timestamptz NOT NULL DEFAULT now()
);

-- Inti aturan "satu kali jawab". Percobaan kedua gagal di tingkat
-- database, tidak peduli berapa banyak instance serverless berjalan.
CREATE UNIQUE INDEX IF NOT EXISTS answers_once_uniq
  ON answers (session_id, player_id, question_id);
CREATE INDEX IF NOT EXISTS answers_session_idx  ON answers (session_id);
CREATE INDEX IF NOT EXISTS answers_question_idx ON answers (question_id);

-- ------------------------------------------------------------
-- Hasil sesi dan jejak kejadian
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_results (
  session_id  text PRIMARY KEY,
  room_code   char(6),
  quiz_id     text REFERENCES quizzes(id) ON DELETE SET NULL,
  host_id     uuid REFERENCES users(id)   ON DELETE SET NULL,
  payload     jsonb NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_results_host_idx ON session_results (host_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS session_results_quiz_idx ON session_results (quiz_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS room_events (
  id         bigserial PRIMARY KEY,
  room_code  char(6) NOT NULL,
  session_id text,
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_events_room_idx ON room_events (room_code, id);

-- ------------------------------------------------------------
-- Pembatasan laju permintaan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       text PRIMARY KEY,
  hits         integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

-- ------------------------------------------------------------
-- Pemicu updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_touch   ON users;
DROP TRIGGER IF EXISTS quizzes_touch ON quizzes;

CREATE TRIGGER users_touch   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER quizzes_touch BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
