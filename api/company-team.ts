import { createClient } from '@supabase/supabase-js';
import { isRecipientEmail } from '../src/types/invoiceEmail.js';
import { handleCompanyTeam, sendTeamInvitation, type TeamDependencies } from '../server/companyTeam.js';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const productionOrigin = 'https://sivarconta.vercel.app';

function dependencies(env: NodeJS.ProcessEnv): TeamDependencies {
  const url = env.VITE_SUPABASE_URL?.trim() || '';
  const publicKey = env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  const secret = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const apiKey = env.BREVO_API_KEY?.trim() || '';
  const senderEmail = env.BREVO_SENDER_EMAIL?.trim() || '';
  const senderName = env.BREVO_SENDER_NAME?.trim().slice(0, 70) || 'SIVAR FACT';
  const server = () => createClient(url, secret, clientOptions);
  return {
    available: (!env.VERCEL_ENV || env.VERCEL_ENV === 'production') &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && Boolean(publicKey && secret && apiKey && isRecipientEmail(senderEmail)),
    async authenticate(token) {
      const result = await createClient(url, publicKey, clientOptions).auth.getUser(token);
      return result.error ? null : result.data.user?.id || null;
    },
    async list(company, actor) {
      const { data, error } = await server().rpc('read_company_team', { p_company: company, p_actor: actor });
      if (error) throw error;
      return data;
    },
    async reserve(company, actor, command) {
      const { data, error } = await server().rpc('reserve_company_invitation', {
        p_company: company, p_actor: actor, p_email: command.email, p_role: command.role,
      });
      if (error) throw error;
      return data;
    },
    async change(company, actor, command) {
      const { error } = await server().rpc('change_company_team', {
        p_company: company, p_actor: actor, p_action: command.action, p_target: command.targetId,
        p_role: command.action === 'role' ? command.role : null,
      });
      if (error) throw error;
    },
    async send(reservation, command) {
      let activationToken: string | undefined;
      if (reservation.needsActivation) {
        const { data, error } = await server().auth.admin.generateLink({ type: 'invite', email: command.email });
        if (error && !['email_exists', 'user_already_exists'].includes(error.code || '')) return 'failed';
        if (!error) {
          activationToken = data.properties.hashed_token;
          if (!activationToken) return 'failed';
        }
      }
      return sendTeamInvitation({ apiKey, senderEmail, senderName, origin: productionOrigin }, reservation, command, activationToken);
    },
    async finish(id, delivery) {
      const { error } = await server().from('company_invitations').update({ delivery }).eq('id', id);
      if (error) throw error;
    },
  };
}

export default {
  fetch(request: Request) {
    return handleCompanyTeam(request, dependencies(process.env));
  },
};
