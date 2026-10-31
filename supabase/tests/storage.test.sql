-- Report photo storage policies. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.act_as(user_id text)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
$$;

select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'report-photos' $$,
  $$ values (false, 5242880::bigint) $$,
  'report-photos is private with a 5 MB limit'
);

select pg_temp.act_as('user_a');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('report-photos', 'user_a/report-1.jpg') $$,
  'a user can upload into their own folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('report-photos', 'user_b/report-1.jpg') $$,
  '42501', null,
  'a user cannot upload into someone else''s folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('report-photos', 'report-1.jpg') $$,
  '42501', null,
  'a user cannot upload outside a folder'
);

select pg_temp.act_as('user_b');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-photos' and name = 'user_a/report-1.jpg'),
  1,
  'signed-in users can read any report photo'
);

update storage.objects set name = 'user_b/stolen.jpg' where name = 'user_a/report-1.jpg';

reset role;
select is(
  (select name from storage.objects where bucket_id = 'report-photos'
     and name in ('user_a/report-1.jpg', 'user_b/stolen.jpg')),
  'user_a/report-1.jpg',
  'nobody can rename someone else''s photo'
);

-- Storage blocks direct SQL deletes, so check that no policy would allow one through the API.
select is_empty(
  $$ select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('DELETE', 'UPDATE', 'ALL') and policyname like 'report-photos%' $$,
  'no policy lets anyone update or delete report photos'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-photos'),
  0,
  'signed-out users cannot see report photos'
);

select * from finish();
rollback;
