-- RLS, team membership, private Dirección, and assignment notifications.
-- Run: supabase test db

begin;

select plan(48);

create or replace procedure public.test_login(uid uuid)
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', uid::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
  set local role authenticated;
end;
$$;

grant execute on procedure public.test_login(uuid) to authenticated;

-- David: all three spaces ----------------------------------------------------

call public.test_login('a0000000-0000-0000-0000-000000000001');

select is((select count(*)::int from public.spaces), 3,
  'David sees Dirección, Operaciones and Alianzas');
select is((select count(*)::int from public.tasks), 9,
  'David sees all 9 tasks');
select is((select count(*)::int from public.spaces
           where id = 'b0000000-0000-0000-0000-000000000009'), 1,
  'David sees Dirección');

call public.test_login('a0000000-0000-0000-0000-000000000002');

select is((select count(*)::int from public.tasks), 9,
  'Marjorie sees all 9 tasks');

-- Admin who is only on Operaciones ------------------------------------------

call public.test_login('a0000000-0000-0000-0000-000000000003');

select is((select count(*)::int from public.spaces), 1,
  'The test admin sees only Operaciones');
select is((select count(*)::int from public.spaces
           where id = 'b0000000-0000-0000-0000-000000000009'), 0,
  'is_admin() does not reveal Dirección');
select is((select count(*)::int from public.spaces
           where id = 'b0000000-0000-0000-0000-000000000002'), 0,
  'The test admin does not see Alianzas');
select is((select count(*)::int from public.tasks), 3,
  'The test admin sees only the 3 Operaciones tasks');
select is((select count(*)::int from public.tasks
           where space_id = 'b0000000-0000-0000-0000-000000000009'), 0,
  'The test admin sees no Dirección tasks');
select is((select count(*)::int from public.task_comments
           where id = 'e0000000-0000-0000-0000-0000000000f1'), 0,
  'Dirección comments are invisible');

-- Alex: Operaciones only. Helen: Alianzas only. Mariam: both, not Dirección --

call public.test_login('a0000000-0000-0000-0000-000000000005');

select is((select count(*)::int from public.spaces), 1,
  'Alex sees only Operaciones');
select is((select count(*)::int from public.tasks), 3,
  'Alex sees only Operaciones tasks');
select is((select count(*)::int from public.spaces
           where slug = 'alianzas'), 0,
  'Alex does not see Alianzas');

call public.test_login('a0000000-0000-0000-0000-000000000006');

select is((select count(*)::int from public.spaces), 1,
  'Helen sees only Alianzas');
select is((select count(*)::int from public.tasks), 3,
  'Helen sees only Alianzas tasks');
select is((select count(*)::int from public.spaces
           where slug = 'operaciones'), 0,
  'Helen does not see Operaciones');

call public.test_login('a0000000-0000-0000-0000-000000000004');

select is((select count(*)::int from public.spaces), 2,
  'Mariam sees Operaciones and Alianzas');
select is((select count(*)::int from public.tasks), 6,
  'Mariam sees the 6 non-Dirección tasks');
select is((select count(*)::int from public.spaces
           where id = 'b0000000-0000-0000-0000-000000000009'), 0,
  'Mariam does not see Dirección');

-- Nobody outside can write their way into Dirección --------------------------

call public.test_login('a0000000-0000-0000-0000-000000000003');

select throws_ok(
  $$
    insert into public.space_members (space_id, user_id)
    values (
      'b0000000-0000-0000-0000-000000000009',
      'a0000000-0000-0000-0000-000000000003'
    )
  $$,
  '42501',
  null,
  'An admin cannot add themselves to Dirección'
);

select throws_ok(
  $$
    insert into public.tasks (title, space_id, created_by, priority, status)
    values (
      'No debería existir',
      'b0000000-0000-0000-0000-000000000009',
      'a0000000-0000-0000-0000-000000000003',
      'medium', 'open'
    )
  $$,
  '42501',
  null,
  'An admin cannot create a task inside Dirección'
);

-- Helen cannot create in Operaciones -----------------------------------------

call public.test_login('a0000000-0000-0000-0000-000000000006');

select throws_ok(
  $$
    insert into public.tasks (title, space_id, created_by, priority, status)
    values (
      'No debería existir',
      'b0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000006',
      'medium', 'open'
    )
  $$,
  '42501',
  null,
  'Helen cannot create a task in Operaciones'
);

-- Invariants hold even against Dirección members -----------------------------

call public.test_login('a0000000-0000-0000-0000-000000000001');

select throws_ok(
  $$
    update public.spaces set is_private = false
    where id = 'b0000000-0000-0000-0000-000000000009'
  $$,
  '42501',
  null,
  'Even a member cannot make Dirección public'
);

select throws_ok(
  $$
    insert into public.task_assignees (task_id, user_id)
    values (
      'c0000000-0000-0000-0000-0000000000f1',
      'a0000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  'Alex cannot be assigned a Dirección task'
);

select throws_ok(
  $$
    insert into public.task_assignees (task_id, user_id)
    values (
      'c0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  'Alex cannot be assigned an Alianzas task'
);

select lives_ok(
  $$
    insert into public.task_assignees (task_id, user_id)
    values (
      'c0000000-0000-0000-0000-0000000000f3',
      'a0000000-0000-0000-0000-000000000002'
    )
  $$,
  'A Dirección member can be added as a second assignee'
);

-- Write rules inside Operaciones ---------------------------------------------

call public.test_login('a0000000-0000-0000-0000-000000000005');

-- 0003 is created by the test admin and assigned to Mariam, seeded at medium.
-- Alex is an Operaciones member but neither creator nor assignee.
update public.tasks set priority = 'urgent'
where id = 'c0000000-0000-0000-0000-000000000003';
select is(
  (select priority from public.tasks
   where id = 'c0000000-0000-0000-0000-000000000003'),
  'medium'::public.task_priority,
  'Alex cannot edit an Operaciones task he neither created nor is assigned to'
);

update public.tasks set priority = 'high'
where id = 'c0000000-0000-0000-0000-000000000001';
select is(
  (select priority from public.tasks
   where id = 'c0000000-0000-0000-0000-000000000001'),
  'high'::public.task_priority,
  'Alex can edit an Operaciones task he is assigned to'
);

select lives_ok(
  $$
    insert into public.tasks (title, space_id, created_by, priority, status)
    values (
      'Revisar inflado de balones',
      'b0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000005',
      'low', 'open'
    )
  $$,
  'Alex can create a task in Operaciones'
);

-- Assignment notifications ---------------------------------------------------

reset role;
delete from public.notifications;

call public.test_login('a0000000-0000-0000-0000-000000000002');

insert into public.task_assignees (task_id, user_id)
values (
  'c0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000006'
);

call public.test_login('a0000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.notifications), 1,
  'Helen is notified when Marjorie assigns her a task');
select is(
  (select kind from public.notifications limit 1),
  'assigned',
  'The notification kind is assigned'
);

call public.test_login('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.notifications), 0,
  'Marjorie does not see Helen''s notification');

reset role;
delete from public.notifications;

call public.test_login('a0000000-0000-0000-0000-000000000001');
insert into public.task_assignees (task_id, user_id)
values (
  'c0000000-0000-0000-0000-0000000000f2',
  'a0000000-0000-0000-0000-000000000001'
);
select is((select count(*)::int from public.notifications
           where user_id = 'a0000000-0000-0000-0000-000000000001'), 1,
  'Assigning yourself a task that was someone else''s still notifies you');

reset role;
delete from public.notifications;

call public.test_login('a0000000-0000-0000-0000-000000000002');
select public.set_task_assignees(
  'c0000000-0000-0000-0000-000000000003',
  array['a0000000-0000-0000-0000-000000000005'::uuid]
);
call public.test_login('a0000000-0000-0000-0000-000000000005');
select is(
  (select count(*)::int from public.notifications where kind = 'assigned'),
  1,
  'Alex is notified when a task is reassigned to him'
);

reset role;
delete from public.notifications;

-- Alex is staff, not the creator. Inserting the new owner before dropping
-- himself is what keeps can_write_task true long enough for the INSERT.
call public.test_login('a0000000-0000-0000-0000-000000000005');
select public.set_task_assignees(
  'c0000000-0000-0000-0000-000000000005',
  array['a0000000-0000-0000-0000-000000000007'::uuid]
);
call public.test_login('a0000000-0000-0000-0000-000000000007');
select is(
  (select count(*)::int from public.notifications where kind = 'assigned'),
  1,
  'A staff assignee can reassign a task and the new owner is notified'
);

reset role;
delete from public.notifications;

call public.test_login('a0000000-0000-0000-0000-000000000007');
select lives_ok(
  $$select public.create_task(
    p_title := 'Revisar esta notificación',
    p_space_id := 'b0000000-0000-0000-0000-000000000001'
  )$$,
  'A member can create a task with no assignees'
);
select is((select count(*)::int from public.notifications), 1,
  'Creating a task with no assignees notifies the creator');

call public.test_login('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.notifications), 1,
  'David is told when Test assigns themselves a task in Operaciones');

reset role;
delete from public.notifications;

call public.test_login('a0000000-0000-0000-0000-000000000002');
update public.tasks set status = 'done'
where id = 'c0000000-0000-0000-0000-000000000004';

call public.test_login('a0000000-0000-0000-0000-000000000006');
select is(
  (select count(*)::int from public.notifications where kind = 'done'),
  1,
  'Helen is notified when an Alianzas task is marked done'
);

call public.test_login('a0000000-0000-0000-0000-000000000005');
select is(
  (select count(*)::int from public.notifications where kind = 'done'),
  0,
  'Alex is not notified about an Alianzas task being marked done'
);

reset role;
delete from public.notifications;

call public.test_login('a0000000-0000-0000-0000-000000000002');
delete from public.tasks
where id = 'c0000000-0000-0000-0000-000000000001';

call public.test_login('a0000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.notifications where kind = 'deleted'),
  1,
  'Mariam is notified when a task she was assigned is deleted'
);
select is(
  (select title from public.notifications where kind = 'deleted' limit 1),
  'Confirmar canchas para la clínica de Santa Teresa',
  'A delete notice keeps the task title after the row is gone'
);

-- Attachments follow the task ------------------------------------------------

reset role;
insert into public.attachments (
  task_id, storage_path, filename, mime_type, size_bytes, uploaded_by
) values (
  'c0000000-0000-0000-0000-0000000000f3',
  'c0000000-0000-0000-0000-0000000000f3/ajuste-salarial.pdf',
  'ajuste-salarial.pdf',
  'application/pdf',
  10240,
  'a0000000-0000-0000-0000-000000000001'
);

call public.test_login('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.attachments), 0,
  'A Dirección file is invisible to the non-member admin');

call public.test_login('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.attachments), 1,
  'A member sees the Dirección file');

update public.tasks set status = 'done'
where id = 'c0000000-0000-0000-0000-0000000000f1';
select ok(
  (select completed_at is not null from public.tasks
   where id = 'c0000000-0000-0000-0000-0000000000f1'),
  'Marking a task done stamps completed_at via trigger'
);

update public.tasks set status = 'open'
where id = 'c0000000-0000-0000-0000-0000000000f1';
select ok(
  (select completed_at is null from public.tasks
   where id = 'c0000000-0000-0000-0000-0000000000f1'),
  'Reopening a task clears completed_at'
);

select is(
  public.storage_task_id('basura/archivo.png'),
  null,
  'A malformed storage path yields null'
);

select is(
  public.storage_task_id('c0000000-0000-0000-0000-000000000001/abc-foto.jpg'),
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'A well-formed storage path resolves to its task id'
);

select * from finish();
rollback;
