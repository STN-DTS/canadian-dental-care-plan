export class BaseDomainException extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name; // Set the exception's name to the class name
  }
}
