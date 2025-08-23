/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('JSON')
export class JSONScalar implements CustomScalar<any, any> {
  description = 'JSON custom scalar type';

  parseValue(value: any): any {
    return value; // value from the client
  }

  serialize(value: any): any {
    return value; // value sent to the client
  }

  parseLiteral(ast: ValueNode): any {
    switch (ast.kind) {
      case Kind.STRING:
        try {
          return JSON.parse(ast.value);
        } catch {
          return ast.value;
        }
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.OBJECT:
        return ast.fields.reduce((obj: any, field: any) => {
          obj[field.name.value] = this.parseLiteral(field.value);
          return obj;
        }, {});
      case Kind.LIST:
        return ast.values.map((v: any) => this.parseLiteral(v));
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  }
}
