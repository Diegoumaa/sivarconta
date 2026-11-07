-- Run after the team migration. The entire test uses temporary fixtures and rolls back.
BEGIN;
CREATE TEMP TABLE team_checks(label text);
GRANT INSERT, SELECT ON pg_temp.team_checks TO authenticated, service_role;
CREATE FUNCTION pg_temp.team_check(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(ok, false) THEN RAISE EXCEPTION 'TEAM TEST FAILED: %', label; END IF;
  INSERT INTO pg_temp.team_checks VALUES(label);
END;
$$;
CREATE FUNCTION pg_temp.team_denied(command text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE command;
  RAISE EXCEPTION 'TEAM TEST FAILED: %', label;
EXCEPTION WHEN others THEN
  IF SQLSTATE <> expected THEN RAISE; END IF;
  PERFORM pg_temp.team_check(true, label);
END;
$$;

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data) VALUES
('f0611000-0000-4000-8000-000000000001','team-owner@example.invalid',now(),'{}'),
('f0611000-0000-4000-8000-000000000002','team-admin@example.invalid',now(),'{}'),
('f0611000-0000-4000-8000-000000000003','team-accountant@example.invalid',now(),'{}'),
('f0611000-0000-4000-8000-000000000004','team-outsider@example.invalid',now(),'{}'),
('f0611000-0000-4000-8000-000000000005','team-new@example.invalid',NULL,'{}');
INSERT INTO public.companies(id,name,nit,nrc,economic_activity_code,economic_activity_desc,email,phone,address) VALUES
('f0612000-0000-4000-8000-000000000001','Equipo A QA','0000-000000-000-0','1','1','QA','qa@example.invalid','0','QA'),
('f0612000-0000-4000-8000-000000000002','Equipo B QA','0000-000000-000-0','2','1','QA','qa@example.invalid','0','QA');
INSERT INTO public.company_members(company_id,user_id,role) VALUES
('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001','owner'),
('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','admin'),
('f0612000-0000-4000-8000-000000000002','f0611000-0000-4000-8000-000000000004','owner'),
('f0612000-0000-4000-8000-000000000002','f0611000-0000-4000-8000-000000000003','billing');
CREATE TEMP TABLE team_invite_fixtures(label text PRIMARY KEY, data jsonb);
GRANT SELECT, INSERT ON pg_temp.team_invite_fixtures TO authenticated,service_role;

SET LOCAL ROLE service_role;
SELECT pg_temp.team_check(jsonb_array_length(public.read_company_team(
 'f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002')->'members') = 2,'lista limitada a la empresa');
SELECT pg_temp.team_denied($q$SELECT public.read_company_team('f0612000-0000-4000-8000-000000000002','f0611000-0000-4000-8000-000000000002')$q$,'42501','administrador no puede consultar otra empresa');
SELECT pg_temp.team_denied($q$SELECT public.reserve_company_invitation('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','team-accountant@example.invalid','admin')$q$,'42501','administrador no puede nombrar otro administrador');
SELECT pg_temp.team_denied($q$SELECT public.change_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001','remove','f0611000-0000-4000-8000-000000000001')$q$,'42501','propietario protegido');
INSERT INTO pg_temp.team_invite_fixtures VALUES('existing',public.reserve_company_invitation(
 'f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002',' TEAM-ACCOUNTANT@example.invalid ','accountant'));
INSERT INTO pg_temp.team_invite_fixtures VALUES('new',public.reserve_company_invitation(
 'f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001','team-new@example.invalid','admin'));
SELECT pg_temp.team_check((SELECT NOT (data->>'needsActivation')::boolean FROM pg_temp.team_invite_fixtures WHERE label='existing'),'cuenta confirmada conserva su inicio de sesión');
SELECT pg_temp.team_check((SELECT (data->>'needsActivation')::boolean FROM pg_temp.team_invite_fixtures WHERE label='new'),'cuenta nueva requiere activación');
SELECT pg_temp.team_denied($q$SELECT public.reserve_company_invitation('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','team-accountant@example.invalid','accountant')$q$,'P0001','reenvíos seguidos limitados');
SELECT pg_temp.team_denied($q$SELECT public.change_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','cancel',(data->>'id')::uuid) FROM pg_temp.team_invite_fixtures WHERE label='new'$q$,'42501','administrador no cancela invitación a otro administrador');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f0611000-0000-4000-8000-000000000004',true);
SELECT pg_temp.team_denied($q$SELECT public.open_company_invitation((data->>'id')::uuid,true) FROM pg_temp.team_invite_fixtures WHERE label='existing'$q$,'42501','correo incorrecto no acepta enlace');
SELECT pg_temp.team_denied($q$SELECT public.read_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001')$q$,'42501','navegador no puede suplantar al propietario');
SELECT pg_temp.team_denied($q$SELECT email FROM public.company_invitations$q$,'42501','invitaciones fuera del acceso directo');
SELECT set_config('request.jwt.claim.sub','f0611000-0000-4000-8000-000000000005',true);
SELECT pg_temp.team_denied($q$SELECT public.open_company_invitation((data->>'id')::uuid,true) FROM pg_temp.team_invite_fixtures WHERE label='new'$q$,'42501','correo no confirmado no acepta');
SELECT set_config('request.jwt.claim.sub','f0611000-0000-4000-8000-000000000003',true);
SELECT pg_temp.team_check((SELECT NOT (public.open_company_invitation((data->>'id')::uuid)->>'accepted')::boolean
  FROM pg_temp.team_invite_fixtures WHERE label='existing'),'vista previa disponible antes de aceptar');
SELECT pg_temp.team_check((SELECT count(*)=0 FROM public.companies WHERE id='f0612000-0000-4000-8000-000000000001'),'vista previa no concede acceso');
SELECT pg_temp.team_check((SELECT (public.open_company_invitation((data->>'id')::uuid,true)->>'accepted')::boolean
  FROM pg_temp.team_invite_fixtures WHERE label='existing'),'la cuenta correcta acepta');
SELECT pg_temp.team_check((SELECT count(*)=2 FROM public.companies WHERE id::text LIKE 'f0612000-%'),'cuenta con acceso a dos empresas');
SELECT pg_temp.team_check((SELECT (public.open_company_invitation((data->>'id')::uuid,true)->>'accepted')::boolean
  FROM pg_temp.team_invite_fixtures WHERE label='existing'),'aceptar dos veces es seguro');
SELECT pg_temp.team_denied($q$UPDATE public.company_members SET role='owner' WHERE user_id=auth.uid()$q$,'42501','no hay escrituras directas de membresía');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='f0611000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f0611000-0000-4000-8000-000000000005',true);
SELECT pg_temp.team_check((SELECT (public.open_company_invitation((data->>'id')::uuid,true)->>'accepted')::boolean
  FROM pg_temp.team_invite_fixtures WHERE label='new'),'la cuenta activada recibe el rol asignado por el propietario');
SELECT pg_temp.team_check((SELECT role='admin' FROM public.company_members WHERE user_id=auth.uid()
  AND company_id='f0612000-0000-4000-8000-000000000001'),'rol de administrador persistido');

SET LOCAL ROLE service_role;
SELECT pg_temp.team_denied($q$SELECT public.reserve_company_invitation('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','team-accountant@example.invalid','accountant')$q$,'23505','una cuenta que ya es miembro no recibe otra invitación');
SELECT public.change_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','role','f0611000-0000-4000-8000-000000000003','billing');
SELECT pg_temp.team_check((SELECT data->'members' @> '[{"email":"team-accountant@example.invalid","role":"billing"}]'::jsonb
  FROM public.read_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001') AS data),'el administrador cambia un rol permitido');
SELECT public.change_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000002','remove','f0611000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f0611000-0000-4000-8000-000000000003',true);
SELECT pg_temp.team_check((SELECT count(*)=1 AND bool_and(id='f0612000-0000-4000-8000-000000000002')
  FROM public.companies WHERE id::text LIKE 'f0612000-%'),'retirar acceso conserva otras empresas');
SELECT pg_temp.team_denied($q$SELECT public.open_company_invitation((data->>'id')::uuid,true) FROM pg_temp.team_invite_fixtures WHERE label='existing'$q$,'22023','el enlace usado no restaura acceso');

RESET ROLE;
UPDATE public.company_invitations SET created_at=now()-interval '2 minutes' WHERE id=(SELECT (data->>'id')::uuid FROM pg_temp.team_invite_fixtures WHERE label='existing');
SET LOCAL ROLE service_role;
INSERT INTO pg_temp.team_invite_fixtures VALUES('cancelled',public.reserve_company_invitation(
 'f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001','team-accountant@example.invalid','accountant'));
SELECT public.change_company_team('f0612000-0000-4000-8000-000000000001','f0611000-0000-4000-8000-000000000001','cancel',(data->>'id')::uuid)
  FROM pg_temp.team_invite_fixtures WHERE label='cancelled';
SET LOCAL ROLE authenticated;
SELECT pg_temp.team_denied($q$SELECT public.open_company_invitation((data->>'id')::uuid,true) FROM pg_temp.team_invite_fixtures WHERE label='cancelled'$q$,'22023','la invitación cancelada no concede acceso');
RESET ROLE;
SELECT count(*) AS comprobaciones_equipo_aprobadas FROM pg_temp.team_checks;
ROLLBACK;
SELECT count(*) AS usuarios_sinteticos_restantes FROM auth.users WHERE id::text LIKE 'f0611000-%';
