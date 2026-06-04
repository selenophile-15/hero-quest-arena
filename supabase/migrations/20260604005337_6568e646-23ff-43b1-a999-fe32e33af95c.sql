
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  google_sub TEXT,
  email TEXT,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_nickname_lower_key ON public.profiles (lower(nickname));
CREATE INDEX profiles_google_sub_idx ON public.profiles (google_sub);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ BANNED GOOGLE SUBS ============
CREATE TABLE public.banned_google_subs (
  google_sub TEXT PRIMARY KEY,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.banned_google_subs TO service_role;
ALTER TABLE public.banned_google_subs ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can access.

-- ============ USER HEROES (max 100) ============
CREATE TABLE public.user_heroes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('hero', 'champion')),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_heroes_user_idx ON public.user_heroes (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_heroes TO authenticated;
GRANT ALL ON public.user_heroes TO service_role;

ALTER TABLE public.user_heroes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_heroes_select_own" ON public.user_heroes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_heroes_insert_own" ON public.user_heroes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_heroes_update_own" ON public.user_heroes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_heroes_delete_own" ON public.user_heroes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_user_heroes_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_heroes WHERE user_id = NEW.user_id) >= 100 THEN
    RAISE EXCEPTION '영웅/챔피언은 최대 100명까지 저장할 수 있습니다.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_user_heroes_limit BEFORE INSERT ON public.user_heroes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_heroes_limit();

-- ============ USER SIMULATIONS (max 30) ============
CREATE TABLE public.user_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_simulations_user_idx ON public.user_simulations (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_simulations TO authenticated;
GRANT ALL ON public.user_simulations TO service_role;

ALTER TABLE public.user_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_sims_select_own" ON public.user_simulations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_sims_insert_own" ON public.user_simulations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_sims_update_own" ON public.user_simulations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_sims_delete_own" ON public.user_simulations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_user_simulations_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_simulations WHERE user_id = NEW.user_id) >= 30 THEN
    RAISE EXCEPTION '시뮬레이션 결과는 최대 30개까지 저장할 수 있습니다.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_user_sims_limit BEFORE INSERT ON public.user_simulations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_simulations_limit();

-- ============ RANKING SIMULATIONS (public, win_rate >= 80) ============
CREATE TABLE public.ranking_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  win_rate NUMERIC NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ranking_simulations_winrate_idx ON public.ranking_simulations (win_rate DESC);
CREATE INDEX ranking_simulations_user_idx ON public.ranking_simulations (user_id);

GRANT SELECT ON public.ranking_simulations TO anon, authenticated;
GRANT INSERT, DELETE ON public.ranking_simulations TO authenticated;
GRANT ALL ON public.ranking_simulations TO service_role;

ALTER TABLE public.ranking_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ranking_select_all" ON public.ranking_simulations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ranking_insert_self_threshold" ON public.ranking_simulations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND win_rate >= 80);
CREATE POLICY "ranking_delete_self" ON public.ranking_simulations FOR DELETE TO authenticated USING (auth.uid() = user_id);
