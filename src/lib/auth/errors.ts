export class AuthError extends Error {

  constructor(message: string) {

    super(message);

    this.name = "AuthError";

  }

}



export class UnauthorizedError extends AuthError {

  constructor(message = "Sign in required") {

    super(message);

    this.name = "UnauthorizedError";

  }

}



export class ForbiddenError extends AuthError {

  constructor(message = "Not permitted") {

    super(message);

    this.name = "ForbiddenError";

  }

}


