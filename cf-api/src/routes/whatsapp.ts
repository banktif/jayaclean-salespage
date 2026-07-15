import type { Env } from '../types';
import { err, ok } from '../utils/helpers';
import { requireAuth } from '../utils/middleware';

export async function handleWhatsapp(req: Request, env: Env, path: string): Promise<Response> {
  // POST /api/whatsapp/send
  if (path === '/api/whatsapp/send' && req.method === 'POST') {
    try {
      await requireAuth(req, env);
      const { phone, message, booking_id } = await req.json() as any;

      let finalMessage = message;
      let finalPhone = phone;

      if (booking_id && !phone) {
        const booking = await env.DB.prepare('SELECT customer_phone FROM bookings WHERE id = ?').bind(booking_id).first<{customer_phone: string}>();
        if (booking) finalPhone = booking.customer_phone;
      }

      if (!finalPhone) return err('Missing phone number');

      // Normalize phone
      let digits = String(finalPhone).replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60')) digits = '60' + digits;

      // If using WhatsApp Cloud API
      if (env.WA_PHONE_NUMBER_ID && env.WA_ACCESS_TOKEN) {
        const resp = await fetch(`https://graph.facebook.com/v22.0/${env.WA_PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.WA_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: digits,
            type: 'text',
            text: { body: finalMessage }
          })
        });
        const data = await resp.json() as any;
        if (!resp.ok) return err(data.error?.message || 'WhatsApp API error', resp.status);
        return ok({ sent: true, wa_id: data.contacts?.[0]?.wa_id });
      }

      // Fallback: return wa.me link
      return ok({ wa_link: `https://wa.me/${digits}?text=${encodeURIComponent(finalMessage)}` });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  return err('Not found', 404);
}
