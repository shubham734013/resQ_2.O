import { Schema, model, Types } from 'mongoose';

export interface UserSavedFacilityDocument {
  userId: Types.ObjectId;
  hospitalId: Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<UserSavedFacilityDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ userId: 1, hospitalId: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });

export const UserSavedFacilityModel = model<UserSavedFacilityDocument>('UserSavedFacility', schema);
