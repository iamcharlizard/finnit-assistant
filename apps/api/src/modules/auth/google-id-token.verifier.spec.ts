import { isGooglePicture } from './google-id-token.verifier';

describe('isGooglePicture', () => {
  it("keeps https pictures from Google's image hosts", () => {
    expect(
      isGooglePicture('https://lh3.googleusercontent.com/a/ACg8oc=s96-c'),
    ).toBe(true);
  });

  it('drops anything else', () => {
    expect(isGooglePicture(undefined)).toBe(false);
    expect(isGooglePicture('http://lh3.googleusercontent.com/a/x')).toBe(false);
    expect(isGooglePicture('https://evil.example.com/a.png')).toBe(false);
    expect(isGooglePicture('https://googleusercontent.com.evil.io/a')).toBe(
      false,
    );
    expect(isGooglePicture('not a url')).toBe(false);
  });
});
