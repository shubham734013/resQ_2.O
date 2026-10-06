import { Schema, model, Types } from 'mongoose';
import { TRIP_STATUSES, type TripStatus } from '../types/ambulance.js';

export interface TripDocument { emergencyRequestId:Types.ObjectId; providerId:Types.ObjectId; ambulanceId:Types.ObjectId; driverId:Types.ObjectId; destinationHospitalId:Types.ObjectId; status:TripStatus; acceptedAt?:Date; arrivedAtPickupAt?:Date; patientPickedUpAt?:Date; arrivedAtHospitalAt?:Date; completedAt?:Date; createdAt:Date; updatedAt:Date; }
const schema = new Schema<TripDocument>({
  emergencyRequestId:{type:Schema.Types.ObjectId,ref:'EmergencyRequest',required:true,unique:true,index:true},
  providerId:{type:Schema.Types.ObjectId,ref:'AmbulanceProvider',required:true,index:true},
  ambulanceId:{type:Schema.Types.ObjectId,ref:'Ambulance',required:true,index:true},
  driverId:{type:Schema.Types.ObjectId,ref:'AmbulanceDriver',required:true,index:true},
  destinationHospitalId:{type:Schema.Types.ObjectId,ref:'Hospital',required:true,index:true},
  status:{type:String,enum:TRIP_STATUSES,default:'ACCEPTED',index:true},
  acceptedAt:Date,arrivedAtPickupAt:Date,patientPickedUpAt:Date,arrivedAtHospitalAt:Date,completedAt:Date,
},{timestamps:true});
schema.index({providerId:1,status:1,createdAt:-1});
schema.index({driverId:1,status:1,createdAt:-1});
export const TripModel=model<TripDocument>('Trip',schema);
