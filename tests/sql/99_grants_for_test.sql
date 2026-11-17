-- Supabase grants these by default; mirror them for the test database.
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
