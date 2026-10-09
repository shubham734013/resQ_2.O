import { Schema, model, Types } from 'mongoose';

export const EMERGENCY_HISTORY_ACTOR_ROLES = ['USER','HOSPITAL','AMBULANCE_PROVIDER','AMBULANCE_DRIVER','ADMIN','SYSTEM'] as const;
export type EmergencyHistoryActorRole = (typeof EMERGENCY_HISTORY_ACTOR_ROLES)[number];

export interface EmergencyStatusHistoryDocument {
  emergencyRequestId: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole: EmergencyHistoryActorRole;
  previousStatus?: string;
  status: string;
  changedAt: Date;
}

const schema = new Schema<EmergencyStatusHistoryDocument>({
  emergencyRequestId:{type:Schema.Types.ObjectId,ref:'EmergencyRequest',required:true,index:true},
  actorId:{type:Schema.Types.ObjectId,index:true},
  actorRole:{type:String,enum:EMERGENCY_HISTORY_ACTOR_ROLES,required:true},
  previousStatus:String,
  status:{type:String,required:true},
  changedAt:{type:Date,default:Date.now,index:true},
},{timestamps:false});

schema.index({emergencyRequestId:1,changedAt:1});
export const EmergencyStatusHistoryModel=model<EmergencyStatusHistoryDocument>('EmergencyStatusHistory',schema);
