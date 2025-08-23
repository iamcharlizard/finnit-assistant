import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class PageInfo {
  @Field({ nullable: true })
  startCursor?: string;

  @Field({ nullable: true })
  endCursor?: string;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

export interface PaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}