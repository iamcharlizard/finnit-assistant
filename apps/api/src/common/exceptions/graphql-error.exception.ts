import { GraphQLError } from 'graphql';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_ACCOUNT_TYPE = 'INVALID_ACCOUNT_TYPE',
  TRANSFER_SAME_ACCOUNT = 'TRANSFER_SAME_ACCOUNT',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  GOAL_ALREADY_REACHED = 'GOAL_ALREADY_REACHED',
  DEBT_OVERPAYMENT = 'DEBT_OVERPAYMENT',
}

export class FinnitGraphQLError extends GraphQLError {
  constructor(message: string, code: ErrorCode, originalError?: Error) {
    super(message, {
      extensions: {
        code,
        originalError: originalError?.message,
      },
    });
  }
}

export class ValidationError extends FinnitGraphQLError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorCode.VALIDATION_ERROR, originalError);
  }
}

export class UnauthorizedError extends FinnitGraphQLError {
  constructor(message = 'Unauthorized') {
    super(message, ErrorCode.UNAUTHORIZED);
  }
}

export class ForbiddenError extends FinnitGraphQLError {
  constructor(message = 'Forbidden') {
    super(message, ErrorCode.FORBIDDEN);
  }
}

export class NotFoundError extends FinnitGraphQLError {
  constructor(message = 'Resource not found') {
    super(message, ErrorCode.NOT_FOUND);
  }
}

export class ConflictError extends FinnitGraphQLError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT);
  }
}

export class InternalError extends FinnitGraphQLError {
  constructor(message = 'Internal server error', originalError?: Error) {
    super(message, ErrorCode.INTERNAL_ERROR, originalError);
  }
}

export class InsufficientBalanceError extends FinnitGraphQLError {
  constructor(message = 'Insufficient balance') {
    super(message, ErrorCode.INSUFFICIENT_BALANCE);
  }
}

export class InvalidAccountTypeError extends FinnitGraphQLError {
  constructor(message = 'Invalid account type for this operation') {
    super(message, ErrorCode.INVALID_ACCOUNT_TYPE);
  }
}

export class TransferSameAccountError extends FinnitGraphQLError {
  constructor(message = 'Cannot transfer to the same account') {
    super(message, ErrorCode.TRANSFER_SAME_ACCOUNT);
  }
}

export class BudgetExceededError extends FinnitGraphQLError {
  constructor(message = 'Budget limit exceeded') {
    super(message, ErrorCode.BUDGET_EXCEEDED);
  }
}

export class GoalAlreadyReachedError extends FinnitGraphQLError {
  constructor(message = 'Goal has already been reached') {
    super(message, ErrorCode.GOAL_ALREADY_REACHED);
  }
}

export class DebtOverpaymentError extends FinnitGraphQLError {
  constructor(message = 'Payment amount exceeds remaining debt') {
    super(message, ErrorCode.DEBT_OVERPAYMENT);
  }
}