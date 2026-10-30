-- Report photos (R4). Private bucket: signed-in users upload into a folder named after their
-- Clerk user ID and can read any report photo. report_alert() only accepts a photo_path in
-- the caller's own folder, so a report can't point at someone else's upload.

update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
where id = 'report-photos';

create policy "report-photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = public.requesting_user_id()
  );

create policy "report-photos: signed-in read" on storage.objects
  for select to authenticated
  using (bucket_id = 'report-photos');

-- No update or delete policies: a photo attached to an alert stays as reported.
