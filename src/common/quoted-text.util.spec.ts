import { stripQuotedText } from './quoted-text.util';

describe('stripQuotedText', () => {
  it('leaves a plain non-reply email untouched', () => {
    const body = 'Hi Sarah,\n\nThe invoice is $84.20 and due 8/15.\n\nThanks!';
    expect(stripQuotedText(body)).toBe(body);
  });

  it('strips a Gmail plain-text reply', () => {
    const body = [
      'Sounds good, see you Thursday at 3.',
      '',
      'On Wed, Aug 19, 2026 at 10:15 AM John Doe <john@example.com> wrote:',
      '',
      '> Are you free Thursday afternoon?',
      '> I booked the room for 3pm.',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('Sounds good, see you Thursday at 3.');
  });

  it('strips an attribution wrapped across three lines', () => {
    const body = [
      'Confirmed, order #4471 ships Friday.',
      '',
      'On Wed, Aug 19, 2026 at 10:15 AM Jonathan Bartholomew Fitzgerald',
      '<jonathan.bartholomew.fitzgerald@a-very-long-company-domain.example>',
      'wrote:',
      '',
      '> Can you confirm the ship date on order #4471?',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('Confirmed, order #4471 ships Friday.');
  });

  it('strips a non-English attribution', () => {
    const body = [
      'Passt, bis Donnerstag.',
      '',
      'Am 19.08.2026 um 10:15 schrieb John Doe <john@example.de>:',
      '',
      '> Hast du Donnerstag Zeit?',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('Passt, bis Donnerstag.');
  });

  it('strips an Outlook header block that has no quote markers', () => {
    const body = [
      'Approved. Go ahead and book it.',
      '',
      'From: John Doe <john@example.com>',
      'Sent: Wednesday, August 19, 2026 10:15 AM',
      'To: Sarah Lee <sarah@example.com>',
      'Subject: Re: Venue deposit',
      '',
      'The venue needs a $500 deposit by Friday.',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('Approved. Go ahead and book it.');
  });

  it('strips an -----Original Message----- block', () => {
    const body = [
      'Yes, that works.',
      '',
      '-----Original Message-----',
      'From: John Doe',
      'Does 3pm work for you?',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('Yes, that works.');
  });

  it('strips a forwarded-message separator', () => {
    const body = [
      'FYI, see below.',
      '',
      '---------- Forwarded message ----------',
      'From: John Doe <john@example.com>',
      'The server maintenance is Saturday.',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('FYI, see below.');
  });

  it('strips an Apple Mail reply', () => {
    const body = [
      'On my way.',
      '',
      'On Aug 19, 2026, at 10:15 AM, John Doe <john@example.com> wrote:',
      '',
      '> Where are you?',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('On my way.');
  });

  it('strips a "-- " signature delimiter', () => {
    const body = [
      'Deal, $1,200 it is.',
      '',
      '-- ',
      'John Doe',
      'VP Sales',
    ].join('\n');

    expect(stripQuotedText(body)).toBe('Deal, $1,200 it is.');
  });

  it('strips a trailing "Sent from my iPhone"', () => {
    const body = 'Running 10 min late.\n\nSent from my iPhone';

    expect(stripQuotedText(body)).toBe('Running 10 min late.');
  });

  it('keeps "Sent from my iPhone" when it is the entire body', () => {
    expect(stripQuotedText('Sent from my iPhone')).toBe('Sent from my iPhone');
  });

  it('keeps bottom-posted text written below the quote', () => {
    const body = ['> Are you free Thursday?', '', 'Yes, 3pm works.'].join('\n');

    expect(stripQuotedText(body)).toBe('Yes, 3pm works.');
  });

  it('falls back to the full body when nothing new remains', () => {
    const body = [
      'On Wed, Aug 19, 2026 at 10:15 AM John Doe <john@example.com> wrote:',
      '',
      '> Are you free Thursday afternoon?',
    ].join('\n');

    expect(stripQuotedText(body)).toBe(body);
  });

  it('collapses blank-line runs left behind by stripping', () => {
    const body =
      'First line.\n\n\n\nSecond line.\n\nOn Wed, Aug 19, 2026 at 10:15 AM J <j@x.com> wrote:\n> old';

    expect(stripQuotedText(body)).toBe('First line.\n\nSecond line.');
  });

  it('handles an empty body', () => {
    expect(stripQuotedText('')).toBe('');
  });
});
