/** Thrown by services when a requested entity does not exist; the HTTP layer turns it into a 404 NOT_FOUND. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
