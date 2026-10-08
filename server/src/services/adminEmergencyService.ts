import { Types } from 'mongoose';
import { EmergencyRequestModel, type EmergencyRequestDocument, type HospitalEmergencyStatus } from '../models/EmergencyRequest.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { TripModel } from '../models/Trip.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type { adminEmergencyListQuerySchema } from '../schemas/admin.js';

export interface AdminEmergencyListItem {
  id:string; requestCode:string; userId:string; patientId?:string; situationType:string; reportedAt:Date; status:HospitalEmergencyStatus;
  statusHistory:Array<{status:HospitalEmergencyStatus;changedAt:Date;actorId?:string;actorRole:string;previousStatus?:HospitalEmergencyStatus}>;
  hospital:{id:string;name?:string;latitude?:number;longitude?:number}|null;
  ambulanceProvider:{id:string;name?:string}|null;
  ambulance:{id:string;registrationNumber?:string;vehicleNumber?:string;latitude?:number;longitude?:number;locationUpdatedAt?:Date}|null;
  driver:{id:string;name?:string}|null;
  pickup:{latitude?:number;longitude?:number;label?:string};
  etaMinutes?:number; createdAt:Date; updatedAt:Date;
}
type Query=z.infer<typeof adminEmergencyListQuerySchema>;
const oid=(value:string,name:string)=>{if(!Types.ObjectId.isValid(value))throw new AppError('INVALID_ID',`Invalid ${name}`,400);return new Types.ObjectId(value);};
const escapeRegex=(value:string)=>value.replace(/[.*+?^$()|[\]\\]/g,'\\$&');
const coordinates=(x:Record<string,unknown>)=>{
  if(typeof x.latitude==='number'&&typeof x.longitude==='number')return {latitude:x.latitude,longitude:x.longitude};
  const c=(x.location as {coordinates?:unknown}|undefined)?.coordinates;
  if(Array.isArray(c)&&typeof c[0]==='number'&&typeof c[1]==='number')return {latitude:c[1],longitude:c[0]};
  return {};
};
const mapItem=(x:Record<string,unknown>,refs:{hospital:Record<string,unknown>|null;provider:Record<string,unknown>|null;ambulance:Record<string,unknown>|null;driver:Record<string,unknown>|null}):AdminEmergencyListItem=>{
  const hc=refs.hospital?coordinates(refs.hospital):{};
  return {
    id:String(x._id),requestCode:String(x.requestCode),userId:String(x.userId),patientId:x.patientId?String(x.patientId):undefined,situationType:String(x.situationType),reportedAt:x.reportedAt as Date,status:x.status as HospitalEmergencyStatus,
    statusHistory:Array.isArray(x.statusHistory)?(x.statusHistory as Array<Record<string,unknown>>).map(h=>({status:h.status as HospitalEmergencyStatus,changedAt:h.changedAt as Date,actorId:h.actorId?String(h.actorId):undefined,actorRole:String(h.actorRole??'SYSTEM'),previousStatus:h.previousStatus as HospitalEmergencyStatus|undefined})):[],
    hospital:refs.hospital?{id:String(refs.hospital._id),name:typeof refs.hospital.name==='string'?refs.hospital.name:undefined,...hc}:null,
    ambulanceProvider:refs.provider?{id:String(refs.provider._id),name:typeof refs.provider.name==='string'?refs.provider.name:undefined}:null,
    ambulance:refs.ambulance?{id:String(refs.ambulance._id),registrationNumber:typeof refs.ambulance.registrationNumber==='string'?refs.ambulance.registrationNumber:undefined,vehicleNumber:typeof refs.ambulance.vehicleNumber==='string'?refs.ambulance.vehicleNumber:undefined,latitude:typeof refs.ambulance.currentLatitude==='number'?refs.ambulance.currentLatitude:undefined,longitude:typeof refs.ambulance.currentLongitude==='number'?refs.ambulance.currentLongitude:undefined,locationUpdatedAt:refs.ambulance.locationUpdatedAt as Date|undefined}:null,
    driver:refs.driver?{id:String(refs.driver._id),name:typeof refs.driver.fullName==='string'?refs.driver.fullName:undefined}:null,
    pickup:{latitude:typeof x.latitude==='number'?x.latitude:undefined,longitude:typeof x.longitude==='number'?x.longitude:undefined,label:typeof x.location==='string'?x.location:undefined},
    etaMinutes:typeof x.etaMinutes==='number'?x.etaMinutes:undefined,createdAt:x.createdAt as Date,updatedAt:x.updatedAt as Date,
  };
};
const getRefs=async(items:EmergencyRequestDocument[])=>{
  const hIds=items.map(x=>x.hospitalId),pIds=items.flatMap(x=>x.ambulanceProviderId?[x.ambulanceProviderId]:[]),aIds=items.flatMap(x=>x.ambulanceId?[x.ambulanceId]:[]),dIds=items.flatMap(x=>x.driverId?[x.driverId]:[]);
  const [h,p,a,d]=await Promise.all([
    hIds.length?HospitalModel.find({_id:{$in:hIds}}).select('name latitude longitude location').lean().exec():Promise.resolve([]),
    pIds.length?AmbulanceProviderModel.find({_id:{$in:pIds}}).select('name').lean().exec():Promise.resolve([]),
    aIds.length?AmbulanceModel.find({_id:{$in:aIds}}).select('registrationNumber vehicleNumber currentLatitude currentLongitude locationUpdatedAt').lean().exec():Promise.resolve([]),
    dIds.length?AmbulanceDriverModel.find({_id:{$in:dIds}}).select('fullName').lean().exec():Promise.resolve([]),
  ]);
  return {h:new Map(h.map(x=>[String(x._id),x as unknown as Record<string,unknown>])),p:new Map(p.map(x=>[String(x._id),x as unknown as Record<string,unknown>])),a:new Map(a.map(x=>[String(x._id),x as unknown as Record<string,unknown>])),d:new Map(d.map(x=>[String(x._id),x as unknown as Record<string,unknown>]))};
};
export const listAdminEmergencies=async(query:Query)=>{
  const filter:Record<string,unknown>={};
  if(query.status)filter.status=query.status;if(query.hospital)filter.hospitalId=oid(query.hospital,'hospital');if(query.provider)filter.ambulanceProviderId=oid(query.provider,'provider');if(query.ambulance)filter.ambulanceId=oid(query.ambulance,'ambulance');if(query.driver)filter.driverId=oid(query.driver,'driver');if(query.situation)filter.situationType=new RegExp(escapeRegex(query.situation),'i');
  if(query.search){const rx=new RegExp(escapeRegex(query.search),'i');const clauses:Record<string,unknown>[]=[{requestCode:rx},{situationType:rx}];if(Types.ObjectId.isValid(query.search)){const id=oid(query.search,'search');clauses.push({userId:id},{patientId:id});}filter.$or=clauses;}
  if(query.from||query.to)filter.reportedAt={...(query.from?{$gte:query.from}:{}),...(query.to?{$lte:query.to}: {})};
  const [items,total]=await Promise.all([EmergencyRequestModel.find(filter).sort({reportedAt:query.sortOrder==='asc'?1:-1,_id:1}).skip((query.page-1)*query.limit).limit(query.limit).lean().exec(),EmergencyRequestModel.countDocuments(filter).exec()]);
  const refs=await getRefs(items);
  return {items:items.map(x=>mapItem(x as unknown as Record<string,unknown>,{hospital:refs.h.get(String(x.hospitalId))??null,provider:x.ambulanceProviderId?refs.p.get(String(x.ambulanceProviderId))??null:null,ambulance:x.ambulanceId?refs.a.get(String(x.ambulanceId))??null:null,driver:x.driverId?refs.d.get(String(x.driverId))??null:null})),pagination:{page:query.page,limit:query.limit,total,totalPages:total?Math.ceil(total/query.limit):0}};
};
export const getAdminEmergency=async(id:string)=>{const requestId=oid(id,'emergency');const item=await EmergencyRequestModel.findById(requestId).lean().exec();if(!item)throw new AppError('NOT_FOUND','Emergency request not found',404);const refs=await getRefs([item]);return mapItem(item as unknown as Record<string,unknown>,{hospital:refs.h.get(String(item.hospitalId))??null,provider:item.ambulanceProviderId?refs.p.get(String(item.ambulanceProviderId))??null:null,ambulance:item.ambulanceId?refs.a.get(String(item.ambulanceId))??null:null,driver:item.driverId?refs.d.get(String(item.driverId))??null:null});};
export const getAdminEmergencySummary=async()=>{const grouped=await EmergencyRequestModel.aggregate<{_id:HospitalEmergencyStatus;count:number}>([{$group:{_id:'$status',count:{$sum:1}}}]).exec();const summary:Record<HospitalEmergencyStatus,number>={RECEIVED:0,REVIEWING:0,PREPARING:0,AMBULANCE_COORDINATION:0,RESOLVED:0,CANCELLED:0};grouped.forEach(x=>{summary[x._id]=x.count;});return summary;};