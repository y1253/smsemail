import {
  isBareEmailAddress,
  normalizeRecipient,
  normalizeSmsText,
} from './email-address.util';

describe('isBareEmailAddress', () => {
  it.each([
    'bob@work.com',
    'bob@work.io',
    'bob@work.co.uk',
    'bob@my-startup.dev',
    'bob+news@work.org',
    'Bob.Smith@Work.NET',
  ])('accepts %s', (address) => {
    expect(isBareEmailAddress(address)).toBe(true);
  });

  it.each([
    ['no dot after the @', 'bob@localhost'],
    ['no @ at all', 'Mom'],
    ['an embedded space', 'bob@work.com hey'],
    ['a leading label', 'To:'],
    ['two @ signs', 'a@b@c.com'],
    ['empty', ''],
  ])('rejects %s', (_label, address) => {
    expect(isBareEmailAddress(address)).toBe(false);
  });

  it('is not stateful across calls', () => {
    // A /g flag on the shared regex would make .test() alternate true/false.
    expect(isBareEmailAddress('bob@work.com')).toBe(true);
    expect(isBareEmailAddress('bob@work.com')).toBe(true);
  });
});

describe('normalizeSmsText', () => {
  it('folds a non-breaking space to a plain space', () => {
    expect(normalizeSmsText('bob@work.com hey')).toBe('bob@work.com hey');
  });

  it('strips zero-width characters, which JS \\s does not match', () => {
    expect(normalizeSmsText('bob@​work.com')).toBe('bob@work.com');
  });

  it('keeps newlines and tabs — they are legal inside a message body', () => {
    expect(normalizeSmsText('line one\nline two\tend')).toBe(
      'line one\nline two\tend',
    );
  });
});

describe('normalizeRecipient', () => {
  it.each([
    ['a bare address', 'bob@work.com', 'bob@work.com'],
    ['a "To:" prefix', 'To: bob@work.com', 'bob@work.com'],
    ['a lowercase "to :" prefix', 'to : bob@work.com', 'bob@work.com'],
    ['a mailto: link', 'mailto:bob@work.com', 'bob@work.com'],
    ['angle brackets', '<bob@work.com>', 'bob@work.com'],
    ['a display name', 'Bob Smith <bob@work.com>', 'bob@work.com'],
    ['a trailing comma', 'bob@work.com,', 'bob@work.com'],
    ['a trailing period', 'bob@work.com.', 'bob@work.com'],
    ['a wrapping paren', '(bob@work.com)', 'bob@work.com'],
    ['curly quotes', '“bob@work.com”', 'bob@work.com'],
    ['a non-breaking space', ' bob@work.com ', 'bob@work.com'],
    ['a zero-width space', 'bob@work.com​', 'bob@work.com'],
  ])('unwraps %s', (_label, input, expected) => {
    expect(normalizeRecipient(input)).toBe(expected);
  });

  it('preserves the case of the local part', () => {
    // Local parts are case-sensitive; lowercasing could misdeliver.
    expect(normalizeRecipient('<Bob.Smith@Work.com>')).toBe(
      'Bob.Smith@Work.com',
    );
  });

  it('leaves a non-address token alone rather than inventing one', () => {
    expect(normalizeRecipient('Mom')).toBe('Mom');
    expect(isBareEmailAddress(normalizeRecipient('Mom'))).toBe(false);
  });
});
