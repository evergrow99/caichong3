delete from public.profiles as profile
where (
  profile.phone in ('13700000000', '13800000000', '13900000000')
  or profile.id = '00000000-0000-4000-8000-000000000001'
  or profile.display_name = '演示用户'
)
and not exists (
  select 1
  from public.orders as orders
  where orders.user_id = profile.id
);
