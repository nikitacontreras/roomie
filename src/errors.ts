export type RoomieErrorCode =
  | "UNKNOWN_FILE"
  | "UNKNOWN_BYTES"
  | "NO_ROM_IN_ZIP"
  | "INVALID_INPUT"
  | "NOT_LOADED";

export class RoomieError extends Error {
  readonly code: RoomieErrorCode;

  constructor(code: RoomieErrorCode, message?: string) {
    super(message ?? code.toLowerCase());
    this.name = "RoomieError";
    this.code = code;
  }
}
