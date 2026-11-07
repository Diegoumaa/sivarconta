BEGIN;

CREATE TABLE public.company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'accountant', 'billing')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'cancelled')),
  delivery text NOT NULL DEFAULT 'unconfirmed' CHECK (delivery IN ('unconfirmed', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX company_invitations_one_pending ON public.company_invitations(company_id, email) WHERE state = 'pending';
CREATE INDEX company_invitations_recent ON public.company_invitations(created_at);
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.company_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE(delivery) ON TABLE public.company_invitations TO service_role;

-- All membership writes from the app pass through checked functions. The
-- existing company creation function still assigns the first owner.
DROP POLICY IF EXISTS membership_manage ON public.company_members;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.company_members FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.team_can_manage(manager text, target text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce((manager = 'owner' AND target IN ('admin','accountant','billing'))
    OR (manager = 'admin' AND target IN ('accountant','billing')), false)
$$;

CREATE FUNCTION public.read_company_team(p_company uuid, p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE manager text;
BEGIN
  SELECT role INTO manager FROM public.company_members WHERE company_id = p_company AND user_id = p_actor;
  IF NOT coalesce(manager IN ('owner','admin'), false) THEN
    RAISE EXCEPTION 'team_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'role', manager,
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.user_id, 'email', u.email, 'role', m.role,
        'editable', m.user_id <> p_actor AND public.team_can_manage(manager, m.role))
        ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, u.email)
      FROM public.company_members m JOIN auth.users u ON u.id = m.user_id WHERE m.company_id = p_company
    ), '[]'::jsonb),
    'invitations', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role,
        'expiresAt', i.expires_at, 'delivery', i.delivery,
        'editable', public.team_can_manage(manager, i.role)) ORDER BY i.created_at DESC)
      FROM public.company_invitations i WHERE i.company_id = p_company AND i.state = 'pending'
    ), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.reserve_company_invitation(p_company uuid, p_actor uuid, p_email text, p_role text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE manager text; company_name text; old_invite public.company_invitations; new_id uuid;
  email_address text := lower(btrim(p_email));
BEGIN
  SELECT name INTO company_name FROM public.companies WHERE id = p_company FOR UPDATE;
  SELECT role INTO manager FROM public.company_members WHERE company_id = p_company AND user_id = p_actor;
  IF NOT public.team_can_manage(manager, p_role) THEN RAISE EXCEPTION 'team_forbidden' USING ERRCODE = '42501'; END IF;
  IF email_address IS NULL OR length(email_address) > 254 OR email_address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'team_invalid_email' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_members m JOIN auth.users u ON u.id = m.user_id
      WHERE m.company_id = p_company AND lower(u.email) = email_address) THEN
    RAISE EXCEPTION 'team_already_member' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO old_invite FROM public.company_invitations
    WHERE company_id = p_company AND email = email_address AND state = 'pending';
  IF old_invite.id IS NOT NULL AND NOT public.team_can_manage(manager, old_invite.role) THEN
    RAISE EXCEPTION 'team_forbidden' USING ERRCODE = '42501';
  END IF;
  -- The project shares its email quota with document delivery.
  PERFORM pg_advisory_xact_lock(26110601);
  IF EXISTS (SELECT 1 FROM public.company_invitations WHERE company_id = p_company
       AND email = email_address AND created_at > now() - interval '1 minute')
    OR (SELECT count(*) FROM public.company_invitations WHERE company_id = p_company
       AND created_at > now() - interval '1 hour') >= 10
    OR (SELECT count(*) FROM public.company_invitations WHERE created_at > now() - interval '1 day') >= 50 THEN
    RAISE EXCEPTION 'team_rate_limited' USING ERRCODE = 'P0001';
  END IF;
  -- A resend replaces the previous invitation, so only the latest link works.
  IF old_invite.id IS NOT NULL THEN
    UPDATE public.company_invitations SET state = 'cancelled' WHERE id = old_invite.id;
  END IF;
  INSERT INTO public.company_invitations(company_id, email, role, invited_by)
    VALUES(p_company, email_address, p_role, p_actor) RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'companyName', company_name,
    'needsActivation', NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = email_address AND email_confirmed_at IS NOT NULL));
END;
$$;

CREATE FUNCTION public.change_company_team(p_company uuid, p_actor uuid, p_action text, p_target uuid, p_role text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE manager text; target_role text;
BEGIN
  PERFORM 1 FROM public.companies WHERE id = p_company FOR UPDATE;
  SELECT role INTO manager FROM public.company_members WHERE company_id = p_company AND user_id = p_actor;
  IF p_action = 'cancel' THEN
    SELECT role INTO target_role FROM public.company_invitations
      WHERE company_id = p_company AND id = p_target AND state = 'pending';
    IF NOT public.team_can_manage(manager, target_role) THEN RAISE EXCEPTION 'team_forbidden' USING ERRCODE = '42501'; END IF;
    UPDATE public.company_invitations SET state = 'cancelled' WHERE company_id = p_company AND id = p_target;
    RETURN;
  END IF;
  SELECT role INTO target_role FROM public.company_members WHERE company_id = p_company AND user_id = p_target;
  IF p_actor = p_target OR NOT public.team_can_manage(manager, target_role) THEN
    RAISE EXCEPTION 'team_forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'role' AND public.team_can_manage(manager, p_role) THEN
    UPDATE public.company_members SET role = p_role WHERE company_id = p_company AND user_id = p_target;
    UPDATE public.company_invitations SET state = 'cancelled'
      WHERE company_id = p_company AND invited_by = p_target AND state = 'pending'
        AND NOT public.team_can_manage(p_role, role);
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.company_members WHERE company_id = p_company AND user_id = p_target;
    UPDATE public.company_invitations SET state = 'cancelled'
      WHERE company_id = p_company AND invited_by = p_target AND state = 'pending';
  ELSE
    RAISE EXCEPTION 'team_forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- The recipient must be signed in as the confirmed address on the invitation.
-- Accepting twice is harmless and never restores access after removal.
CREATE FUNCTION public.open_company_invitation(p_invitation uuid, p_accept boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invite public.company_invitations; recipient uuid := auth.uid(); address text; company_name text; sender_role text;
BEGIN
  SELECT lower(email) INTO address FROM auth.users WHERE id = recipient AND email_confirmed_at IS NOT NULL;
  IF address IS NULL THEN RAISE EXCEPTION 'team_wrong_account' USING ERRCODE = '42501'; END IF;
  SELECT * INTO invite FROM public.company_invitations WHERE id = p_invitation;
  IF invite.id IS NULL OR invite.email <> address THEN
    RAISE EXCEPTION 'team_wrong_account' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO company_name FROM public.companies WHERE id = invite.company_id FOR UPDATE;
  SELECT * INTO invite FROM public.company_invitations WHERE id = p_invitation;
  IF invite.state = 'accepted' AND invite.accepted_by = recipient AND EXISTS (
    SELECT 1 FROM public.company_members WHERE company_id = invite.company_id AND user_id = recipient
  ) THEN
    RETURN jsonb_build_object('companyId', invite.company_id, 'companyName', company_name, 'role', invite.role, 'accepted', true);
  END IF;
  SELECT role INTO sender_role FROM public.company_members WHERE company_id = invite.company_id AND user_id = invite.invited_by;
  IF invite.state IS DISTINCT FROM 'pending' OR invite.expires_at <= now()
    OR NOT public.team_can_manage(sender_role, invite.role) THEN
    RAISE EXCEPTION 'team_invitation_closed' USING ERRCODE = '22023';
  END IF;
  IF p_accept THEN
    INSERT INTO public.company_members(company_id,user_id,role)
      VALUES(invite.company_id,recipient,invite.role) ON CONFLICT (company_id,user_id) DO NOTHING;
    UPDATE public.company_invitations SET state = 'accepted', accepted_by = recipient WHERE id = invite.id;
  END IF;
  RETURN jsonb_build_object('companyId', invite.company_id, 'companyName', company_name, 'role', invite.role, 'accepted', p_accept);
END;
$$;

REVOKE ALL ON FUNCTION public.team_can_manage(text,text),
  public.read_company_team(uuid,uuid), public.reserve_company_invitation(uuid,uuid,text,text),
  public.change_company_team(uuid,uuid,text,uuid,text), public.open_company_invitation(uuid,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_company_team(uuid,uuid), public.reserve_company_invitation(uuid,uuid,text,text),
  public.change_company_team(uuid,uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_company_invitation(uuid,boolean) TO authenticated;
COMMIT;
