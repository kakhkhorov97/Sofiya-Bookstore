import type { OrderView } from '@sofiya/shared';
import { ResendMailer } from './mailer';
import { orderEmail, passwordResetEmail } from './templates';

describe('ResendMailer', () => {
  it('posts the email to Resend with the API key and sender', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response('{"id":"1"}', { status: 200 }));
    };
    await new ResendMailer(
      're_test',
      'Sofiya <hi@sofiya.test>',
      fetchImpl,
    ).send({
      to: 'reader@example.test',
      subject: 'Hi',
      text: 'Hello',
      html: '<p>Hello</p>',
    });
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe('Bearer re_test');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      from: 'Sofiya <hi@sofiya.test>',
      to: 'reader@example.test',
      subject: 'Hi',
    });
  });

  it('throws with Resend’s message when it refuses', async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response('{"message":"Domain not verified"}', { status: 403 }),
      )) as unknown as typeof fetch;
    await expect(
      new ResendMailer('k', 'f', fetchImpl).send({
        to: 'a',
        subject: 'b',
        text: 'c',
        html: 'd',
      }),
    ).rejects.toThrow(/Domain not verified/);
  });
});

describe('email templates', () => {
  it('escapes names in HTML so they cannot inject markup', () => {
    const mail = passwordResetEmail(
      'a@b.test',
      '<script>x</script>',
      'https://sofiya.test/r?token=t',
      30,
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.text).toContain('for 30 minutes');
  });

  it('includes bank details for a bank-transfer order', () => {
    const order = {
      id: '0b6f7c2e-5a4d-4e3f-8a9b-1c2d3e4f5a6b',
      currency: 'KRW',
      total: 15_000,
      items: [{ bookTitle: 'Frankenstein', quantity: 1 }],
      payment: { method: 'BANK_TRANSFER', status: 'UNPAID', error: null },
    } as unknown as OrderView;
    const mail = orderEmail(
      'placed',
      'a@b.test',
      'Reader',
      order,
      'https://sofiya.test/orders/1',
      {
        bankName: 'Sofiya Bank',
        accountNumber: '123-456',
        accountHolder: 'Sofiya Ltd',
      },
    );
    expect(mail.text).toContain(
      '₩15,000 to Sofiya Bank 123-456 (Sofiya Ltd) with the reference 0b6f7c2e',
    );
  });
});
