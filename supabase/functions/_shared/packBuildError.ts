export type PackBuildErrorFields = {
  code: string;
  entity: string;
  entityId?: string;
  message: string;
};

export class PackBuildError extends Error {
  readonly code: string;
  readonly entity: string;
  readonly entityId?: string;

  constructor(fields: PackBuildErrorFields) {
    super(fields.message);
    this.name = "PackBuildError";
    this.code = fields.code;
    this.entity = fields.entity;
    this.entityId = fields.entityId;
  }
}