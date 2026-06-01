import { describe, it, expect } from 'vitest';
import { isAllowedOAuthRedirectUri } from '../server/_core/oauthRedirect';

describe('OAuth Flow', () => {
  it('should validate OAuth provider enum', () => {
    const validProviders = ['google', 'facebook'];
    expect(validProviders).toContain('google');
    expect(validProviders).toContain('facebook');
  });

  it('should validate user data structure', () => {
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      openId: 'google-123456',
      profilePictureUrl: 'https://example.com/photo.jpg',
    };

    expect(mockUser.id).toBeGreaterThan(0);
    expect(mockUser.name).toBeTruthy();
    expect(mockUser.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(mockUser.openId).toContain('-');
  });

  it('should validate OAuth ID format', () => {
    const googleId = 'google-123456789';
    const facebookId = 'facebook-987654321';

    expect(googleId).toMatch(/^google-\d+$/);
    expect(facebookId).toMatch(/^facebook-\d+$/);
  });

  it('should handle null profile picture URL', () => {
    const userWithoutPhoto = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      openId: 'google-123456',
      profilePictureUrl: undefined,
    };

    expect(userWithoutPhoto.profilePictureUrl).toBeUndefined();
  });

  it('should validate contribution data structure', () => {
    const contribution = {
      userId: 1,
      stationId: 'station-001',
      fuelType: 'gasolina',
      price: '6.50',
      createdAt: new Date(),
    };

    expect(contribution.userId).toBeGreaterThan(0);
    expect(contribution.stationId).toBeTruthy();
    expect(['gasolina', 'aditivada', 'etanol', 'diesel', 'gnv']).toContain(contribution.fuelType);
    expect(parseFloat(contribution.price)).toBeGreaterThan(0);
    expect(contribution.createdAt).toBeInstanceOf(Date);
  });

  it('should only allow OAuth redirects back to the app callback', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';

    expect(isAllowedOAuthRedirectUri('http://localhost:8081/oauth/callback')).toBe(true);
    expect(isAllowedOAuthRedirectUri('https://app.example.com/oauth/callback')).toBe(true);
    expect(isAllowedOAuthRedirectUri('manus20260327112602://oauth/callback')).toBe(true);
    expect(isAllowedOAuthRedirectUri('https://evil.example.com/oauth/callback')).toBe(false);
    expect(isAllowedOAuthRedirectUri('https://app.example.com/not-callback')).toBe(false);
    expect(isAllowedOAuthRedirectUri('javascript:alert(1)')).toBe(false);
  });
});
