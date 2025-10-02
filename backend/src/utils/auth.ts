import { firebaseAuth } from "../services/firebaseAdmin.js";

export class InvalidAuthTokenError extends Error {
  constructor(message = "Invalid authentication token") {
    super(message);
    this.name = "InvalidAuthTokenError";
  }
}

const bearerPrefix = /^Bearer\s+/i;

export const extractUidFromAuthorization = async (authorizationHeader?: string | null) => {
  if (!authorizationHeader) {
    return null;
  }

  const token = authorizationHeader.replace(bearerPrefix, "").trim();
  if (!token) {
    throw new InvalidAuthTokenError();
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    throw new InvalidAuthTokenError();
  }
};
