CREATE POLICY "banned_google_subs_no_client_access"
ON public.banned_google_subs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);