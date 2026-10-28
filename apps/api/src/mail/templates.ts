import { formatMoney, type OrderView } from '@sofiya/shared';
import type { Email } from './mailer';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

// One simple, readable layout for every email: works in any mail client.
function layout(
  title: string,
  paragraphs: string[],
  button?: { label: string; url: string },
): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#15171c">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:22px;font-weight:800;margin:0 0 24px">Sofiya<span style="color:#3b37c9">.</span></p>
<div style="background:#fff;border-radius:14px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${p}</p>`).join('\n')}
${button ? `<p style="margin:20px 0 4px"><a href="${esc(button.url)}" style="display:inline-block;background:#3b37c9;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${esc(button.label)}</a></p>` : ''}
</div>
<p style="font-size:12px;color:#6b6f78;margin:16px 4px 0">Sofiya Bookstore. You received this because of your account or an order on our site.</p>
</div></body></html>`;
}

export function passwordResetEmail(
  to: string,
  name: string,
  link: string,
  minutes: number,
): Email {
  const subject = 'Reset your Sofiya password';
  const text = `Hi ${name},\n\nSomeone (hopefully you) asked to reset the password for your Sofiya account.\n\nChoose a new password here (the link works once, for ${minutes} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email: your password stays the same.`;
  const html = layout(
    'Reset your password',
    [
      `Hi ${esc(name)},`,
      'Someone (hopefully you) asked to reset the password for your Sofiya account.',
      `The link below works once, for ${minutes} minutes. If you didn't ask for this, ignore this email: your password stays the same.`,
    ],
    { label: 'Choose a new password', url: link },
  );
  return { to, subject, text, html };
}

export function confirmEmailEmail(
  to: string,
  name: string,
  link: string,
  hours: number,
): Email {
  const subject = 'Confirm your email for Sofiya';
  const text = `Hi ${name},\n\nWelcome to Sofiya! Please confirm this is your email address (the link works for ${hours} hours):\n${link}\n\nYou can browse right away; confirming lets you order and write reviews. If you didn't create an account, ignore this email.`;
  const html = layout(
    'Confirm your email',
    [
      `Hi ${esc(name)},`,
      'Welcome to Sofiya! Please confirm this is your email address. You can browse right away; confirming lets you order and write reviews.',
      `The link works for ${hours} hours. If you didn't create an account, ignore this email.`,
    ],
    { label: 'Confirm my email', url: link },
  );
  return { to, subject, text, html };
}

export type OrderEmailKind = 'placed' | 'confirmed' | 'delivered' | 'cancelled';

export interface BankDetails {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
}

export function orderEmail(
  kind: OrderEmailKind,
  to: string,
  name: string,
  order: OrderView,
  orderUrl: string,
  bank: BankDetails,
): Email {
  const ref = order.id.slice(0, 8);
  const total = formatMoney(order.total, order.currency);
  const items = order.items
    .map((i) => `${i.bookTitle} × ${i.quantity}`)
    .join(', ');
  const lines: string[] = [];
  let subject: string;
  let title: string;

  switch (kind) {
    case 'placed':
      subject = `Order #${ref} received: please pay by bank transfer`;
      title = 'Thanks for your order';
      lines.push(`We've saved order #${ref} (${items}) for ${total}.`);
      lines.push(
        bank.accountNumber
          ? `Please transfer ${total} to ${bank.bankName ?? ''} ${bank.accountNumber} (${bank.accountHolder ?? ''}) with the reference ${ref}. We confirm the order as soon as the money arrives.`
          : `We'll confirm the order once your bank transfer of ${total} arrives; the order page shows how to pay.`,
      );
      break;
    case 'confirmed':
      subject = `Order #${ref} confirmed`;
      title = 'Your order is confirmed';
      lines.push(
        `${order.payment.method === 'CARD' ? 'Your card payment' : 'Your bank transfer'} of ${total} has been received, and order #${ref} (${items}) is being prepared.`,
      );
      break;
    case 'delivered':
      subject = `Order #${ref} delivered`;
      title = 'Your order has been delivered';
      lines.push(
        `Order #${ref} (${items}) is marked as delivered. Enjoy your reading!`,
      );
      lines.push('Once you have read a book, you can review it from its page.');
      break;
    case 'cancelled':
      subject = `Order #${ref} cancelled`;
      title = 'Your order was cancelled';
      lines.push(`Order #${ref} (${items}) has been cancelled.`);
      if (order.payment.status === 'REFUNDED') {
        lines.push(
          `The card payment of ${total} has been refunded. It can take a few days to show on your statement.`,
        );
      } else if (order.payment.status === 'PAID') {
        lines.push(
          `You paid ${total} by bank transfer; the store will contact you about the refund.`,
        );
      } else if (order.payment.error === 'Not paid in time') {
        lines.push('It was not paid in time, so nothing was charged.');
      } else {
        lines.push('Nothing was charged.');
      }
      break;
  }

  const text = `Hi ${name},\n\n${lines.join('\n\n')}\n\nView your order: ${orderUrl}`;
  const html = layout(title, [`Hi ${esc(name)},`, ...lines.map(esc)], {
    label: 'View your order',
    url: orderUrl,
  });
  return { to, subject, text, html };
}
