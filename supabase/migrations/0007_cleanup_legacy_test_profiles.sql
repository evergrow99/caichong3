delete from public.profiles as profile
where profile.phone in ('10000000000', '1111111111', '11111111111', '12222222222')
and not exists (
  select 1
  from public.orders as orders
  where orders.user_id = profile.id
);
