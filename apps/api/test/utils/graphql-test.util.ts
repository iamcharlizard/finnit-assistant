import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import * as request from 'supertest';
import { join } from 'path';

export interface GraphQLTestOptions {
  query: string;
  variables?: Record<string, any>;
  headers?: Record<string, string>;
}

export class GraphQLTestUtil {
  private app: INestApplication;
  private module: TestingModule;

  constructor(testingModule: TestingModule, app: INestApplication) {
    this.module = testingModule;
    this.app = app;
  }

  static async createTestingModule(imports: any[], providers: any[] = []): Promise<GraphQLTestUtil> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
        }),
        ...imports,
      ],
      providers,
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();

    return new GraphQLTestUtil(moduleFixture, app);
  }

  async executeGraphQL(options: GraphQLTestOptions) {
    const { query, variables = {}, headers = {} } = options;
    
    const response = await request(this.app.getHttpServer())
      .post('/graphql')
      .set(headers)
      .send({
        query,
        variables,
      });

    return {
      data: response.body.data,
      errors: response.body.errors,
      status: response.status,
      response: response.body,
    };
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
    if (this.module) {
      await this.module.close();
    }
  }

  getApp(): INestApplication {
    return this.app;
  }

  getModule(): TestingModule {
    return this.module;
  }

  // Helper method to create authorization headers
  createAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  // Helper method for mutation queries
  async executeMutation(
    mutation: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ) {
    return this.executeGraphQL({
      query: mutation,
      variables,
      headers,
    });
  }

  // Helper method for query operations
  async executeQuery(
    query: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ) {
    return this.executeGraphQL({
      query,
      variables,
      headers,
    });
  }
}

export const AUTH_MUTATIONS = {
  SIGN_UP: `
    mutation SignUp($input: SignUpInput!) {
      signUp(input: $input) {
        accessToken
        refreshToken
        user {
          id
          name
          email
          createdAt
          updatedAt
        }
      }
    }
  `,
  SIGN_IN: `
    mutation SignIn($input: SignInInput!) {
      signIn(input: $input) {
        accessToken
        refreshToken
        user {
          id
          name
          email
          createdAt
          updatedAt
        }
      }
    }
  `,
  REFRESH_TOKEN: `
    mutation RefreshToken($input: RefreshTokenInput!) {
      refreshToken(input: $input) {
        accessToken
        refreshToken
        user {
          id
          name
          email
          createdAt
          updatedAt
        }
      }
    }
  `,
};

export const ACCOUNT_QUERIES = {
  GET_ACCOUNTS: `
    query GetAccounts($first: Int, $after: String, $type: AccountType, $archived: Boolean) {
      accounts(first: $first, after: $after, type: $type, archived: $archived) {
        edges {
          node {
            id
            type
            name
            currency
            balanceCurrent
            archived
            createdAt
            updatedAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `,
  GET_ACCOUNT: `
    query GetAccount($id: ID!) {
      account(id: $id) {
        id
        type
        name
        currency
        balanceCurrent
        metadata
        archived
        createdAt
        updatedAt
      }
    }
  `,
};

export const ACCOUNT_MUTATIONS = {
  CREATE_ACCOUNT: `
    mutation CreateAccount($input: CreateAccountInput!) {
      createAccount(input: $input) {
        id
        type
        name
        currency
        balanceCurrent
        metadata
        archived
        createdAt
        updatedAt
      }
    }
  `,
  UPDATE_ACCOUNT: `
    mutation UpdateAccount($id: ID!, $input: UpdateAccountInput!) {
      updateAccount(id: $id, input: $input) {
        id
        type
        name
        currency
        balanceCurrent
        metadata
        archived
        createdAt
        updatedAt
      }
    }
  `,
  ADJUST_BALANCE: `
    mutation AdjustBalance($input: AdjustBalanceInput!) {
      adjustBalance(input: $input) {
        id
        balanceCurrent
        updatedAt
      }
    }
  `,
};

export const TRANSACTION_QUERIES = {
  GET_TRANSACTIONS: `
    query GetTransactions(
      $first: Int
      $after: String
      $accountId: ID
      $type: TransactionType
      $categoryId: ID
      $startDate: DateTime
      $endDate: DateTime
    ) {
      transactions(
        first: $first
        after: $after
        accountId: $accountId
        type: $type
        categoryId: $categoryId
        startDate: $startDate
        endDate: $endDate
      ) {
        edges {
          node {
            id
            type
            amount
            currency
            txnDate
            description
            merchantName
            isPending
            source
            createdAt
            updatedAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `,
};

export const TRANSACTION_MUTATIONS = {
  CREATE_TRANSACTION: `
    mutation CreateTransaction($input: CreateTransactionInput!) {
      createTransaction(input: $input) {
        id
        type
        amount
        currency
        txnDate
        description
        merchantName
        isPending
        source
        createdAt
        updatedAt
      }
    }
  `,
};