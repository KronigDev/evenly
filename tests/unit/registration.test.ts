import { describe, expect, it } from 'vitest';
import {
  decideRegistration,
  inviteAuthorizesEmail,
  inviteTokenFromPath,
} from '@/lib/auth/registration-policy';

describe('decideRegistration', () => {
  it('is open for everyone when the flag is enabled', () => {
    for (const activeUserCount of [0, 1, 100]) {
      for (const inviteValid of [false, true]) {
        expect(
          decideRegistration({ registrationEnabled: true, activeUserCount, inviteValid }),
        ).toBe('open');
      }
    }
  });

  it('always allows the first-ever account (bootstrap)', () => {
    expect(
      decideRegistration({ registrationEnabled: false, activeUserCount: 0, inviteValid: false }),
    ).toBe('bootstrap');
  });

  it('allows invited registrations when disabled', () => {
    expect(
      decideRegistration({ registrationEnabled: false, activeUserCount: 5, inviteValid: true }),
    ).toBe('invite');
  });

  it('is closed when disabled, users exist and there is no valid invite', () => {
    expect(
      decideRegistration({ registrationEnabled: false, activeUserCount: 5, inviteValid: false }),
    ).toBe('closed');
  });
});

describe('inviteAuthorizesEmail', () => {
  it('authorizes only the exact invited address (case/space-insensitive)', () => {
    expect(inviteAuthorizesEmail('alice@corp.com', 'alice@corp.com')).toBe(true);
    expect(inviteAuthorizesEmail('Alice@Corp.com', '  alice@corp.com ')).toBe(true);
  });

  it('rejects a different email — one bearer token cannot mint arbitrary accounts', () => {
    expect(inviteAuthorizesEmail('alice@corp.com', 'a1@evil.com')).toBe(false);
    expect(inviteAuthorizesEmail('alice@corp.com', 'alice@corp.co')).toBe(false);
    expect(inviteAuthorizesEmail('alice@corp.com', '')).toBe(false);
  });
});

describe('inviteTokenFromPath', () => {
  it('extracts the token from an accept-invite path', () => {
    expect(inviteTokenFromPath('/accept-invite/abcDEF123_-')).toBe('abcDEF123_-');
    expect(inviteTokenFromPath('/accept-invite/tok?utm=x')).toBe('tok');
  });

  it('returns null for anything else', () => {
    expect(inviteTokenFromPath(null)).toBeNull();
    expect(inviteTokenFromPath(undefined)).toBeNull();
    expect(inviteTokenFromPath('')).toBeNull();
    expect(inviteTokenFromPath('/dashboard')).toBeNull();
    expect(inviteTokenFromPath('/accept-invite/')).toBeNull();
    expect(inviteTokenFromPath('/accept-invite/tok/extra')).toBeNull();
    expect(inviteTokenFromPath('/accept-invite/bad token')).toBeNull();
    expect(inviteTokenFromPath('https://evil.example/accept-invite/tok')).toBeNull();
  });
});
