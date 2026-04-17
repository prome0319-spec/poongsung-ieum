-- 게시글 이미지 URL 배열 컬럼 추가
alter table posts add column if not exists image_urls text[] default '{}';

-- post-images 스토리지 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  10485760,  -- 10MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- RLS: 본인 폴더에만 업로드/삭제
create policy "post_images_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_select"
  on storage.objects for select to public
  using (bucket_id = 'post-images');
