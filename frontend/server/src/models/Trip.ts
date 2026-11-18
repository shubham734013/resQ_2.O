import { Schema, model, Types } from 'mongoose';
import { TRIP_STATUSES, type TripStatus } from '../types/ambulance.js';

export interface TripStatusHistoryEntry {
  status: TripStatus;
  changedAt: Date;
  actorId?: Types.ObjectId;
  actorRole: 'USER'|'HOSPITAL'|'AMBULANCE_PROVIDER'|'AMBULANCE_DRIVER'|'ADMIN'|'SYSTEM';
  previousStatus?: TripStatus;
}

export interface TripDocument {
  emergencyRequestId:Types.ObjectId;
  providerId:Types.ObjectId;
  ambulanceId:Types.ObjectId;
  driverId?:Types.ObjectId;
  destinationHospitalId:Types.ObjectId;
  status:TripStatus;
  statusHistory:TripStatusHistoryEntry[];
  acceptedAt?:Date;
  arrivedAtPickupAt?:Date;
  patientPickedUpAt?:Date;
  arrivedAtHospitalAt?:Date;
  completedAt?:Date;
  createdAt:Date;
  updatedAt:Date;
}
const historySchema=new Schema<TripStatusHistoryEntry>({
  status:{type:String,enum:TRIP_STATUSES,required:true},
  changedAt:{type:Date,required:true},
  actorId:{type:Schema.Types.ObjectId},
  actorRole:{type:String,enum:['USER','HOSPITAL','AMBULANCE_PROVIDER','AMBULANCE_DRIVER','ADMIN','SYSTEM'],required:true,default:'SYSTEM'},
  previousStatus:{type:String,enum:TRIP_STATUSES},
},{_id:false});
const schema=new Schema<TripDocument>({
  emergencyRequestId:{type:Schema.Types.ObjectId,ref:'EmergencyRequest',required:true},
  providerId:{type:Schema.Types.ObjectId,ref:'AmbulanceProvider',required:true,index:true},
  ambulanceId:{type:Schema.Types.ObjectId,ref:'Ambulance',required:true,index:true},
  driverId:{type:Schema.Types.ObjectId,ref:'AmbulanceDriver',index:true},
  destinationHospitalId:{type:Schema.Types.ObjectId,ref:'Hospital',required:true,index:true},
  status:{type:String,enum:TRIP_STATUSES,default:'ASSIGNED',index:true},
  statusHistory:{type:[historySchema],default:[]},
  acceptedAt:Date,arrivedAtPickupAt:Date,patientPickedUpAt:Date,arrivedAtHospitalAt:Date,completedAt:Date,
},{timestamps:true});
schema.index({emergencyRequestId:1,createdAt:-1});
schema.index({providerId:1,status:1,createdAt:-1});
schema.index({driverId:1,status:1,createdAt:-1});
schema.index({ambulanceId:1,status:1,createdAt:-1});
export const TripModel=model<TripDocument>('Trip',schema);
