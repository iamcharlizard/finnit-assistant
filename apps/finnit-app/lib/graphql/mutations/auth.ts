export const SIGN_IN_MUTATION = `
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

export type SignInInput = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type SignInResult = {
  signIn: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };
};

export const SIGN_IN_WITH_GOOGLE_MUTATION = `
  mutation SignInWithGoogle($input: SignInWithGoogleInput!) {
    signInWithGoogle(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        name
      }
    }
  }
`;

export type SignInWithGoogleInput = {
  idToken: string;
  nonce?: string;
};

export type SignInWithGoogleResult = {
  signInWithGoogle: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };
};
