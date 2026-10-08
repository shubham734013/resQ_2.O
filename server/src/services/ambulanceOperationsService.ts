import bcrypt from 'bcrypt';
import { Types, startSession, type QueryFilter } from 'mongoose';
import { AmbulanceProviderModel, type AmbulanceProviderDocument } from '../models/AmbulanceProvider.js';
import { AmbulanceModel, type AmbulanceDocument } from '../models/Ambulance.js';
import { AmbulanceDriverModel, type AmbulanceDriverDocument } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel, type EmergencyRequestDocument } from '../models/EmergencyRequest.js';
import { TripModel, type TripDocument } from '../models/Trip.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { AppError } from '../utils/AppError.js';
import type { z } from 'zod';
import type * as S from '../schemas/ambulance.js';
import type { AmbulanceStatus, DriverAvailabilityStatus, TripStatus, ProviderProfile, AmbulanceView, DriverView, RequestView, TripView } from '../types/ambulance.js';

type PageQuery={page:number;limit:number;sortOrder:'asc'|'desc'};
type AmbulanceQuery=z.infer<typeof S.providerAmbulanceQuerySchema>;
type DriverQuery=z.infer<typeof S.providerDriverQuerySchema>;
type RequestQuery=z.infer<typeof S.providerRequestQuerySchema>;
type TripQuery=z.infer<typeof S.providerTripQuerySchema>;
const oid=(id:string,name='id')=>{if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID',`Invalid ${name}`,400);return new Types.ObjectId(id);};
const page=(items:unknown[],total:number,q:PageQuery)=>({items,pagination:{page:q.page,limit:q.limit,total,totalPages:total?Math.ceil(total/q.limit):0}});
const active=(status:string,code='ACCOUNT_NOT_ACTIVE')=>{if(status!=='ACTIVE')throw new AppError(code,'Account is not active',403);};
const verified=(status:string,code='ACCOUNT_NOT_VERIFIED')=>{if(status!=='VERIFIED')throw new AppError(code,'Account is not verified for operational use',403);};
const escape=(v:string)=>v.replace(/[.*+?^()|[\]\\]/g,'\\$&');
type IdDoc={_id:Types.ObjectId;createdAt:Date;updatedAt:Date};
type DriverSummary={_id:Types.ObjectId;fullName:string;phone:string;availabilityStatus:AmbulanceDriverDocument['availabilityStatus']};
const providerOut=(x:AmbulanceProviderDocument&IdDoc):ProviderProfile=>({id:String(x._id),name:x.name,registrationNumber:x.registrationNumber,email:x.email,phone:x.phone,address:x.address,city:x.city,state:x.state,country:x.country,latitude:x.latitude,longitude:x.longitude,serviceType:x.serviceType,verificationStatus:x.verificationStatus,accountStatus:x.accountStatus,createdAt:x.createdAt,updatedAt:x.updatedAt});
const ambulanceOut=(x:AmbulanceDocument&IdDoc,d:DriverSummary|null=null):AmbulanceView=>({id:String(x._id),registrationNumber:x.registrationNumber,vehicleNumber:x.vehicleNumber,providerId:String(x.providerId),ambulanceType:x.ambulanceType,capabilities:x.capabilities??[],currentStatus:x.currentStatus,currentLatitude:x.currentLatitude,currentLongitude:x.currentLongitude,serviceArea:x.serviceArea,verificationStatus:x.verificationStatus,accountStatus:x.accountStatus,assignedDriver:d?{id:String(d._id),fullName:d.fullName,phone:d.phone,availabilityStatus:d.availabilityStatus}:null,updatedAt:x.updatedAt});
const driverOut=(x:AmbulanceDriverDocument&IdDoc):DriverView=>({id:String(x._id),fullName:x.fullName,email:x.email,phone:x.phone,licenseNumber:x.licenseNumber,licenseVerificationStatus:x.licenseVerificationStatus,address:x.address,city:x.city,state:x.state,country:x.country,registeredLatitude:x.registeredLatitude,registeredLongitude:x.registeredLongitude,providerId:String(x.providerId),assignedAmbulanceId:x.assignedAmbulanceId?String(x.assignedAmbulanceId):undefined,availabilityStatus:x.availabilityStatus,accountStatus:x.accountStatus});
const requestOut=(x:EmergencyRequestDocument&IdDoc,hospital?:{name?:string;latitude?:number;longitude?:number}):RequestView=>({id:String(x._id),requestCode:x.requestCode,hospitalId:String(x.hospitalId),hospitalName:hospital?.name,hospitalLatitude:hospital?.latitude,hospitalLongitude:hospital?.longitude,situationType:x.situationType,reportedAt:x.reportedAt,location:x.location,latitude:x.latitude,longitude:x.longitude,status:x.status,ambulanceId:x.ambulanceId?String(x.ambulanceId):undefined,providerId:x.ambulanceProviderId?String(x.ambulanceProviderId):undefined,driverId:x.driverId?String(x.driverId):undefined,etaMinutes:x.etaMinutes});
const tripOut=(x:TripDocument&IdDoc):TripView=>({id:String(x._id),emergencyRequestId:String(x.emergencyRequestId),providerId:String(x.providerId),ambulanceId:String(x.ambulanceId),driverId:x.driverId?String(x.driverId):undefined,destinationHospitalId:String(x.destinationHospitalId),status:x.status,acceptedAt:x.acceptedAt,arrivedAtPickupAt:x.arrivedAtPickupAt,patientPickedUpAt:x.patientPickedUpAt,arrivedAtHospitalAt:x.arrivedAtHospitalAt,completedAt:x.completedAt,createdAt:x.createdAt,updatedAt:x.updatedAt});
async function provider(id:string){const x=await AmbulanceProviderModel.findById(oid(id,'provider')).select('-passwordHash').lean().exec();if(!x)throw new AppError('NOT_FOUND','Provider not found',404);return x;}
async function operationalProvider(id:string){const x=await AmbulanceProviderModel.findById(oid(id,'provider')).lean().exec();if(!x)throw new AppError('NOT_FOUND','Provider not found',404);active(x.accountStatus);verified(x.verificationStatus);return x;}
async function operationalDriver(id:string){const x=await AmbulanceDriverModel.findById(oid(id,'driver')).lean().exec();if(!x)throw new AppError('NOT_FOUND','Driver not found',404);active(x.accountStatus);verified(x.licenseVerificationStatus,'DRIVER_NOT_VERIFIED');return x;}
export const getProviderProfile=async(id:string)=>providerOut(await provider(id));
export const updateProviderProfile=async(id:string,input:z.infer<typeof S.providerProfileUpdateSchema>)=>{const x=await AmbulanceProviderModel.findByIdAndUpdate(oid(id,'provider'),{$set:input},{new:true,runValidators:true}).select('-passwordHash').lean().exec();if(!x)throw new AppError('NOT_FOUND','Provider not found',404);return providerOut(x);};
export const listAmbulances=async(pid:string,q:AmbulanceQuery)=>{await operationalProvider(pid);const p=oid(pid,'provider');const f:QueryFilter<AmbulanceDocument>={providerId:p};if(q.status)f.currentStatus=q.status;if(q.search)f.$or=[{registrationNumber:new RegExp(escape(q.search),'i')},{vehicleNumber:new RegExp(escape(q.search),'i')}];const [items,total]=await Promise.all([AmbulanceModel.find(f).sort({updatedAt:q.sortOrder==='asc'?1:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),AmbulanceModel.countDocuments(f).exec()]);const drivers=await AmbulanceDriverModel.find({providerId:p,assignedAmbulanceId:{$in:items.map(x=>x._id)}}).select('fullName phone availabilityStatus').lean().exec();const dm=new Map(drivers.map(x=>[String(x.assignedAmbulanceId),x]));return page(items.map(x=>ambulanceOut(x,dm.get(String(x._id))??null)),total,q);};
export const getAmbulance=async(pid:string,id:string)=>{await operationalProvider(pid);const p=oid(pid,'provider');const x=await AmbulanceModel.findOne({_id:oid(id,'ambulance'),providerId:p}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Ambulance not found',404);const d=await AmbulanceDriverModel.findOne({providerId:p,assignedAmbulanceId:x._id}).select('fullName phone availabilityStatus').lean().exec();return ambulanceOut(x,d);};
export const createAmbulance=async(pid:string,input:z.infer<typeof S.ambulanceCreateSchema>)=>{await operationalProvider(pid);try{const x=await AmbulanceModel.create({...input,providerId:oid(pid,'provider'),verificationStatus:'PENDING',accountStatus:'PENDING',currentStatus:'OFFLINE'});return ambulanceOut(x.toObject());}catch(e:unknown){if(typeof e==='object'&&e!==null&&'code' in e&&e.code===11000)throw new AppError('DUPLICATE_AMBULANCE','Registration or vehicle number already exists',409);throw e;}};
export const updateAmbulance=async(pid:string,id:string,input:z.infer<typeof S.ambulanceUpdateSchema>)=>{await operationalProvider(pid);const x=await AmbulanceModel.findOneAndUpdate({_id:oid(id,'ambulance'),providerId:oid(pid,'provider')},{$set:input},{new:true,runValidators:true}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Ambulance not found',404);return ambulanceOut(x);};
export const updateAmbulanceStatus=async(pid:string,id:string,status:AmbulanceStatus)=>{await operationalProvider(pid);const p=oid(pid,'provider');const a=await AmbulanceModel.findOne({_id:oid(id,'ambulance'),providerId:p}).exec();if(!a)throw new AppError('NOT_FOUND','Ambulance not found',404);const activeTrip=await TripModel.exists({ambulanceId:a._id,status:{$in:['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL']}});if(activeTrip&&status!=='BUSY')throw new AppError('AMBULANCE_ON_ACTIVE_TRIP','Ambulance is on an active trip',409);a.currentStatus=status;await a.save();return ambulanceOut(a.toObject());};
export const listDrivers=async(pid:string,q:DriverQuery)=>{await operationalProvider(pid);const p=oid(pid,'provider');const f:QueryFilter<AmbulanceDriverDocument>={providerId:p};if(q.status)f.availabilityStatus=q.status;if(q.search)f.$or=[{fullName:new RegExp(escape(q.search),'i')},{email:new RegExp(escape(q.search),'i')},{licenseNumber:new RegExp(escape(q.search),'i')}];const [items,total]=await Promise.all([AmbulanceDriverModel.find(f).sort({createdAt:q.sortOrder==='asc'?1:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),AmbulanceDriverModel.countDocuments(f).exec()]);return page(items.map(driverOut),total,q);};
export const getDriver=async(pid:string,id:string)=>{await operationalProvider(pid);const x=await AmbulanceDriverModel.findOne({_id:oid(id,'driver'),providerId:oid(pid,'provider')}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Driver not found',404);return driverOut(x);};
export const createDriver=async(pid:string,input:z.infer<typeof S.driverCreateSchema>)=>{await operationalProvider(pid);if(await AmbulanceDriverModel.exists({$or:[{email:input.email.toLowerCase()},{licenseNumber:input.licenseNumber}]}))throw new AppError('DRIVER_ALREADY_EXISTS','Driver email or license number already exists',409);const passwordHash=await bcrypt.hash(input.password,12);const x=await AmbulanceDriverModel.create({...input,email:input.email.toLowerCase(),passwordHash,providerId:oid(pid,'provider'),licenseVerificationStatus:'PENDING',accountStatus:'PENDING',availabilityStatus:'OFFLINE'});return driverOut(x.toObject());};
export const updateDriver=async(pid:string,id:string,input:z.infer<typeof S.driverUpdateSchema>)=>{await operationalProvider(pid);const {password,...profileUpdate}=input;const update:Partial<AmbulanceDriverDocument>={...profileUpdate};if(password)update.passwordHash=await bcrypt.hash(password,12);const x=await AmbulanceDriverModel.findOneAndUpdate({_id:oid(id,'driver'),providerId:oid(pid,'provider')},{$set:update},{new:true,runValidators:true}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Driver not found',404);return driverOut(x);};
export const assignDriver=async(pid:string,aid:string,did:string)=>{
  await operationalProvider(pid);
  const p=oid(pid,'provider'),aId=oid(aid,'ambulance'),dId=oid(did,'driver');
  const [a,d]=await Promise.all([AmbulanceModel.findOne({_id:aId,providerId:p}).lean().exec(),AmbulanceDriverModel.findOne({_id:dId,providerId:p}).exec()]);
  if(!a)throw new AppError('NOT_FOUND','Ambulance not found',404);
  if(!d)throw new AppError('NOT_FOUND','Driver not found',404);
  active(d.accountStatus);verified(d.licenseVerificationStatus,'DRIVER_NOT_VERIFIED');
  if(d.assignedAmbulanceId&&String(d.assignedAmbulanceId)!==String(aId))throw new AppError('DRIVER_ALREADY_ASSIGNED','Driver is assigned to another ambulance',409);
  const existingDriver=await AmbulanceDriverModel.findOne({assignedAmbulanceId:aId,_id:{$ne:dId}}).lean().exec();
  if(existingDriver)throw new AppError('AMBULANCE_ALREADY_ASSIGNED','Ambulance already has a driver',409);
  const driverActiveTrip=await TripModel.exists({driverId:d._id,status:{$in:activeTripStatuses}});
  if(driverActiveTrip)throw new AppError('DRIVER_ON_ACTIVE_TRIP','Driver cannot be reassigned during an active trip',409);
  const ambulanceActiveTrip=await TripModel.exists({ambulanceId:aId,status:{$in:activeTripStatuses}});
  if(ambulanceActiveTrip){
    const pendingTrip=await TripModel.exists({ambulanceId:aId,status:'ASSIGNED',driverId:{$exists:false}});
    if(!pendingTrip)throw new AppError('AMBULANCE_ON_ACTIVE_TRIP','Ambulance cannot be reassigned during an active trip',409);
  }
  const updated=await AmbulanceDriverModel.findOneAndUpdate(
    {_id:d._id,providerId:p,$or:[{assignedAmbulanceId:{$exists:false}},{assignedAmbulanceId:aId}]},
    {$set:{assignedAmbulanceId:aId}},
    {new:true}
  ).lean().exec();
  if(!updated)throw new AppError('DRIVER_ASSIGNMENT_CONFLICT','Driver assignment changed before this action could be applied',409);
  return driverOut(updated);
};
export const unassignDriver=async(pid:string,aid:string)=>{
  await operationalProvider(pid);
  const p=oid(pid,'provider');
  const a=await AmbulanceModel.findOne({_id:oid(aid,'ambulance'),providerId:p}).exec();
  if(!a)throw new AppError('NOT_FOUND','Ambulance not found',404);
  const activeTrip=await TripModel.exists({ambulanceId:a._id,status:{$in:activeTripStatuses}});
  if(activeTrip)throw new AppError('AMBULANCE_ACTIVE_TRIP','Driver cannot be unassigned during an active trip',409);
  const d=await AmbulanceDriverModel.findOne({assignedAmbulanceId:a._id,providerId:p}).exec();
  if(!d)return {unassigned:true};
  d.assignedAmbulanceId=undefined;d.availabilityStatus='OFFLINE';await d.save();
  return {unassigned:true};
};
const requestFilter=(pid:string,q:RequestQuery)=>{const p=oid(pid,'provider');const f:QueryFilter<EmergencyRequestDocument>={status:'AMBULANCE_COORDINATION',$or:[{ambulanceProviderId:p},{ambulanceProviderId:{$exists:false}}]};if(q.ambulance)f.ambulanceId=oid(q.ambulance,'ambulance');if(q.driver)f.driverId=oid(q.driver,'driver');if(q.status&&q.status!=='AMBULANCE_COORDINATION')f.status=q.status;if(q.search)f.$and=[{$or:[{requestCode:new RegExp(escape(q.search),'i')},{situationType:new RegExp(escape(q.search),'i')}]}];if(q.from||q.to)f.reportedAt={...(q.from?{$gte:q.from}:{}),...(q.to?{$lte:q.to}:{})};return f;};
export const listProviderRequests=async(pid:string,q:RequestQuery)=>{await operationalProvider(pid);const f=requestFilter(pid,q);const [items,total]=await Promise.all([EmergencyRequestModel.find(f).sort({reportedAt:q.sortOrder==='asc'?1:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),EmergencyRequestModel.countDocuments(f).exec()]);return page(items.map((item) => requestOut(item)),total,q);};
export const getProviderRequest=async(pid:string,id:string)=>{await operationalProvider(pid);const p=oid(pid,'provider');const x=await EmergencyRequestModel.findOne({_id:oid(id,'request'),status:'AMBULANCE_COORDINATION',$or:[{ambulanceProviderId:p},{ambulanceProviderId:{$exists:false}}]}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Request not found',404);return requestOut(x);};
export const assignRequest=async(pid:string,rid:string,aid:string)=>{
  await operationalProvider(pid);
  const p=oid(pid,'provider'),aId=oid(aid,'ambulance'),rId=oid(rid,'request');
  const a=await AmbulanceModel.findOneAndUpdate(
    {_id:aId,providerId:p,currentStatus:'AVAILABLE',verificationStatus:'VERIFIED',accountStatus:'ACTIVE'},
    {$set:{currentStatus:'BUSY'}},{new:true}
  ).exec();
  if(!a)throw new AppError('AMBULANCE_UNAVAILABLE','Ambulance is unavailable or not verified',409);
  const x=await EmergencyRequestModel.findOneAndUpdate(
    {_id:rId,status:'AMBULANCE_COORDINATION',ambulanceId:{$exists:false},$or:[{ambulanceProviderId:{$exists:false}},{ambulanceProviderId:p}]},
    {$set:{ambulanceProviderId:p,ambulanceId:aId}},{new:true}
  ).lean().exec();
  if(!x){
    await AmbulanceModel.updateOne({_id:aId,providerId:p,currentStatus:'BUSY'},{$set:{currentStatus:'AVAILABLE'}}).exec();
    throw new AppError('REQUEST_ALREADY_ASSIGNED','Request is already assigned',409);
  }
  try{
    await TripModel.findOneAndUpdate(
      {emergencyRequestId:x._id},
      {$setOnInsert:{emergencyRequestId:x._id,providerId:p,ambulanceId:aId,driverId:undefined,destinationHospitalId:x.hospitalId,status:'ASSIGNED'}},
      {upsert:true,new:true,setDefaultsOnInsert:true}
    ).exec();
  }catch(error){
    await Promise.all([
      EmergencyRequestModel.updateOne({_id:x._id,ambulanceId:aId},{$unset:{ambulanceId:1,ambulanceProviderId:1}}).exec(),
      AmbulanceModel.updateOne({_id:aId,currentStatus:'BUSY'},{$set:{currentStatus:'AVAILABLE'}}).exec(),
    ]);
    throw error;
  }
  return requestOut(x);
};
export const listDriverRequests=async(did:string,q:RequestQuery)=>{const d=await operationalDriver(did);const f:QueryFilter<EmergencyRequestDocument>={status:'AMBULANCE_COORDINATION',$or:[{driverId:d._id},{ambulanceId:d.assignedAmbulanceId,driverId:{$exists:false}}]};if(q.ambulance)f.ambulanceId=oid(q.ambulance,'ambulance');if(q.search)f.$or=[{requestCode:new RegExp(escape(q.search),'i')},{situationType:new RegExp(escape(q.search),'i')}];const [items,total]=await Promise.all([EmergencyRequestModel.find(f).sort({reportedAt:q.sortOrder==='asc'?1:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),EmergencyRequestModel.countDocuments(f).exec()]);return page(items.map(requestOut),total,q);};
export const getDriverRequest=async(did:string,id:string)=>{const d=await operationalDriver(did);const x=await EmergencyRequestModel.findOne({_id:oid(id,'request'),status:'AMBULANCE_COORDINATION',$or:[{driverId:d._id},{ambulanceId:d.assignedAmbulanceId,driverId:{$exists:false}}]}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Request not found',404);const hospital=await import('../models/Hospital.js').then(({HospitalModel})=>HospitalModel.findById(x.hospitalId).select('name latitude longitude').lean().exec());return requestOut(x,hospital??undefined);};
export const acceptRequest=async(did:string,id:string)=>{
  const d=await operationalDriver(did);
  if(d.availabilityStatus!=='ONLINE'||!d.assignedAmbulanceId)throw new AppError('DRIVER_UNAVAILABLE','Driver must be online with an assigned ambulance',409);
  const a=await AmbulanceModel.findOne({_id:d.assignedAmbulanceId,providerId:d.providerId,currentStatus:'BUSY',verificationStatus:'VERIFIED',accountStatus:'ACTIVE'}).lean().exec();
  if(!a)throw new AppError('AMBULANCE_UNAVAILABLE','Assigned ambulance is not operational',409);
  const claimedDriver=await AmbulanceDriverModel.findOneAndUpdate(
    {_id:d._id,providerId:d.providerId,assignedAmbulanceId:a._id,availabilityStatus:'ONLINE',accountStatus:'ACTIVE',licenseVerificationStatus:'VERIFIED'},
    {$set:{availabilityStatus:'BUSY'}},{new:true}
  ).lean().exec();
  if(!claimedDriver)throw new AppError('DRIVER_UNAVAILABLE','Driver is no longer available for dispatch',409);
  const request=await EmergencyRequestModel.findOneAndUpdate(
    {_id:oid(id,'request'),status:'AMBULANCE_COORDINATION',ambulanceId:a._id,driverId:{$exists:false}},
    {$set:{driverId:d._id}},{new:true}
  ).lean().exec();
  if(!request){
    await AmbulanceDriverModel.updateOne({_id:d._id,availabilityStatus:'BUSY'},{$set:{availabilityStatus:'ONLINE'}}).exec();
    throw new AppError('REQUEST_ALREADY_ASSIGNED','Request is already accepted',409);
  }
  let trip=await TripModel.findOne({emergencyRequestId:request._id}).exec();
  if(!trip){
    try{
      trip=await TripModel.create({emergencyRequestId:request._id,providerId:d.providerId,ambulanceId:a._id,driverId:d._id,destinationHospitalId:request.hospitalId,status:'ASSIGNED'});
    }catch(error){
      await Promise.all([
        EmergencyRequestModel.updateOne({_id:request._id,driverId:d._id},{$unset:{driverId:1}}).exec(),
        AmbulanceDriverModel.updateOne({_id:d._id,availabilityStatus:'BUSY'},{$set:{availabilityStatus:'ONLINE'}}).exec(),
      ]);
      throw error;
    }
  }
  if(String(trip.driverId)!==String(d._id)||String(trip.ambulanceId)!==String(a._id)){
  await Promise.all([
    EmergencyRequestModel.updateOne({_id:request._id,driverId:d._id},{$unset:{driverId:1}}).exec(),
    AmbulanceDriverModel.updateOne({_id:d._id,availabilityStatus:'BUSY'},{$set:{availabilityStatus:'ONLINE'}}).exec(),
  ]);
  throw new AppError('TRIP_CONFLICT','Trip ownership does not match the accepted dispatch',409);
}
  if(trip.status==='ASSIGNED'){
    const accepted=await TripModel.findOneAndUpdate({_id:trip._id,driverId:d._id,status:'ASSIGNED'},{$set:{status:'ACCEPTED',acceptedAt:new Date()}},{new:true}).exec();
    if(accepted)trip=accepted;
  }
  return tripOut(trip.toObject());
};
export const rejectRequest=async(did:string,id:string)=>{
  const d=await operationalDriver(did);
  const requestId=oid(id,'request');
  if(!d.assignedAmbulanceId)throw new AppError('DRIVER_AMBULANCE_REQUIRED','Driver has no assigned ambulance',409);
  const request=await EmergencyRequestModel.findOneAndUpdate(
    {_id:requestId,status:'AMBULANCE_COORDINATION',driverId:{$exists:false},ambulanceId:d.assignedAmbulanceId},
    {$unset:{ambulanceId:1,ambulanceProviderId:1}},
    {new:true}
  ).lean().exec();
  if(!request)throw new AppError('REQUEST_ALREADY_ASSIGNED','Request is no longer available',409);
  const trip=await TripModel.findOneAndUpdate(
    {emergencyRequestId:requestId,ambulanceId:d.assignedAmbulanceId,status:'ASSIGNED',driverId:{$exists:false}},
    {$set:{status:'CANCELLED'},$push:{statusHistory:{status:'CANCELLED',changedAt:new Date(),actorId:d._id,actorRole:'AMBULANCE_DRIVER',previousStatus:'ASSIGNED'}}},{new:true}
  ).exec();
  await AmbulanceModel.updateOne({_id:d.assignedAmbulanceId,providerId:d.providerId,currentStatus:'BUSY'},{$set:{currentStatus:'AVAILABLE'}}).exec();
  if(trip) await HospitalPatientModel.updateOne({emergencyId:requestId,coordinationStatus:{$nin:['RESOLVED','CANCELLED']}},{$unset:{ambulanceId:1,etaMinutes:1}}).exec();
  return requestOut(request);
};
const activeTripStatuses:TripStatus[]=['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL'];
const transition:{[K in TripStatus]?:TripStatus[]}={ASSIGNED:['ACCEPTED','CANCELLED'],ACCEPTED:['TO_PICKUP','CANCELLED'],TO_PICKUP:['AT_PICKUP','CANCELLED'],AT_PICKUP:['PATIENT_ONBOARD','CANCELLED'],PATIENT_ONBOARD:['TO_HOSPITAL','CANCELLED'],TO_HOSPITAL:['AT_HOSPITAL','CANCELLED'],AT_HOSPITAL:['COMPLETED'],COMPLETED:[],CANCELLED:[]};
async function driverTrip(id:string,did:string){const x=await TripModel.findOne({_id:oid(id,'trip'),driverId:oid(did,'driver')}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Trip not found',404);return x;}
async function moveTrip(did:string,id:string,next:TripStatus){
  const driverId=oid(did,'driver');
  const current=await driverTrip(id,did);
  if(!transition[current.status]?.includes(next))throw new AppError('INVALID_TRIP_TRANSITION','Trip transition is not allowed',409);
  if(next!=='COMPLETED'){
    const set:Partial<TripDocument>={status:next};
    const now=new Date();
    if(next==='AT_PICKUP')set.arrivedAtPickupAt=now;
    if(next==='PATIENT_ONBOARD')set.patientPickedUpAt=now;
    if(next==='AT_HOSPITAL')set.arrivedAtHospitalAt=now;
    const x=await TripModel.findOneAndUpdate(
      {_id:current._id,driverId,status:current.status},
      {$set:set,$push:{statusHistory:{status:next,changedAt:now,actorId:driverId,actorRole:'AMBULANCE_DRIVER',previousStatus:current.status}}},
      {new:true,runValidators:true},
    ).lean().exec();
    if(!x)throw new AppError('INVALID_TRIP_TRANSITION','Trip changed before this action could be applied',409);
    if(next==='AT_HOSPITAL'){
      await HospitalPatientModel.updateOne(
        {emergencyId:x.emergencyRequestId,coordinationStatus:{$nin:['RESOLVED','CANCELLED']}},
        {$set:{coordinationStatus:'AT_HOSPITAL',ambulanceId:x.ambulanceId}},
      ).exec();
    }
    return tripOut(x);
  }

  const session=await startSession();
  let completed:TripDocument|null=null;
  try{
    await session.withTransaction(async()=>{
      const now=new Date();
      const trip=await TripModel.findOneAndUpdate(
        {_id:current._id,driverId,status:'AT_HOSPITAL'},
        {$set:{status:'COMPLETED',completedAt:now},$push:{statusHistory:{status:'COMPLETED',changedAt:now,actorId:driverId,actorRole:'AMBULANCE_DRIVER',previousStatus:'AT_HOSPITAL'}}},
        {new:true,runValidators:true,session},
      ).exec();
      if(!trip)throw new AppError('INVALID_TRIP_TRANSITION','Trip changed before completion could be applied',409);

      const emergency=await EmergencyRequestModel.findOne({_id:trip.emergencyRequestId,status:'AMBULANCE_COORDINATION'}).session(session).lean().exec();
      if(!emergency)throw new AppError('EMERGENCY_NOT_ACTIVE','Emergency is not in ambulance coordination state',409);

      const ambulance=await AmbulanceModel.findOneAndUpdate(
        {_id:trip.ambulanceId,currentStatus:'BUSY',accountStatus:'ACTIVE',verificationStatus:'VERIFIED'},
        {$set:{currentStatus:'AVAILABLE'}},
        {new:true,session},
      ).lean().exec();
      if(!ambulance)throw new AppError('AMBULANCE_STATE_CONFLICT','Ambulance state is no longer consistent with the active trip',409);

      const driver=await AmbulanceDriverModel.findOneAndUpdate(
        {_id:driverId,availabilityStatus:'BUSY',accountStatus:'ACTIVE',licenseVerificationStatus:'VERIFIED'},
        {$set:{availabilityStatus:'ONLINE'}},
        {new:true,session},
      ).lean().exec();
      if(!driver)throw new AppError('DRIVER_STATE_CONFLICT','Driver state is no longer consistent with the active trip',409);

      const patient=await HospitalPatientModel.findOneAndUpdate(
        {emergencyId:trip.emergencyRequestId,coordinationStatus:{$nin:['RESOLVED','CANCELLED']}},
        {$set:{coordinationStatus:'RESOLVED',ambulanceId:trip.ambulanceId}},
        {new:true,session},
      ).lean().exec();
      if(!patient)throw new AppError('PATIENT_CASE_CONFLICT','Hospital patient case is unavailable for completion',409);

      const resolved=await EmergencyRequestModel.findOneAndUpdate(
        {_id:trip.emergencyRequestId,status:'AMBULANCE_COORDINATION'},
        {$set:{status:'RESOLVED'},$push:{statusHistory:{status:'RESOLVED',changedAt:now,previousStatus:'AMBULANCE_COORDINATION',actorId:driverId,actorRole:'AMBULANCE_DRIVER'}}},
        {new:true,runValidators:true,session},
      ).lean().exec();
      if(!resolved)throw new AppError('EMERGENCY_STATE_CONFLICT','Emergency changed before completion could be finalized',409);
      completed=trip;
    });
  } finally {
    await session.endSession();
  }
  if(!completed)throw new AppError('TRIP_COMPLETION_FAILED','Trip completion did not produce a completed trip',500);
  return tripOut(completed);
}
export const listDriverTrips=async(did:string,q:TripQuery)=>{await operationalDriver(did);const f:QueryFilter<TripDocument>={driverId:oid(did,'driver')};if(q.status)f.status=q.status;if(q.ambulance)f.ambulanceId=oid(q.ambulance,'ambulance');if(q.from||q.to)f.createdAt={...(q.from?{$gte:q.from}:{}),...(q.to?{$lte:q.to}:{})};const [items,total]=await Promise.all([TripModel.find(f).sort({createdAt:q.sortOrder==='asc'?1:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),TripModel.countDocuments(f).exec()]);return page(items.map(tripOut),total,q);};
export const getDriverTrip=async(did:string,id:string)=>tripOut(await driverTrip(id,did));
export const arrivedPickup=async(did:string,id:string)=>moveTrip(did,id,'AT_PICKUP');
export const patientPickedUp=async(did:string,id:string)=>moveTrip(did,id,'PATIENT_ONBOARD');
export const arrivedHospital=async(did:string,id:string)=>moveTrip(did,id,'AT_HOSPITAL');
export const completeTrip=async(did:string,id:string)=>moveTrip(did,id,'COMPLETED');
export const listProviderTrips=async(pid:string,q:TripQuery)=>{await operationalProvider(pid);const f:QueryFilter<TripDocument>={providerId:oid(pid,'provider')};if(q.status)f.status=q.status;if(q.ambulance)f.ambulanceId=oid(q.ambulance,'ambulance');if(q.driver)f.driverId=oid(q.driver,'driver');if(q.from||q.to)f.createdAt={...(q.from?{$gte:q.from}:{}),...(q.to?{$lte:q.to}:{})};const [items,total]=await Promise.all([TripModel.find(f).sort({createdAt:q.sortOrder==='asc'?1:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean().exec(),TripModel.countDocuments(f).exec()]);return page(items.map(tripOut),total,q);};
export const getProviderTrip=async(pid:string,id:string)=>{await operationalProvider(pid);const x=await TripModel.findOne({_id:oid(id,'trip'),providerId:oid(pid,'provider')}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Trip not found',404);return tripOut(x);};
export const updateDriverLocation=async(did:string,input:import('../schemas/location.js').LocationUpdateInput)=>{const driver=await operationalDriver(did);return import('./locationService.js').then(({updateDriverAmbulanceLocation})=>updateDriverAmbulanceLocation(String(driver._id),input));};
export const getDriverProfile=async(id:string)=>driverOut(await operationalDriver(id));
export const updateDriverProfile=async(id:string,input:z.infer<typeof S.driverUpdateSchema>)=>{const d=await operationalDriver(id);const {password: _password,...profileUpdate}=input;void _password;const update:Partial<AmbulanceDriverDocument>={...profileUpdate};const x=await AmbulanceDriverModel.findByIdAndUpdate(d._id,{$set:update},{new:true,runValidators:true}).lean().exec();if(!x)throw new AppError('NOT_FOUND','Driver not found',404);return driverOut(x);};
export const getDriverStatus=async(id:string)=>{const d=await AmbulanceDriverModel.findById(oid(id,'driver')).lean().exec();if(!d)throw new AppError('NOT_FOUND','Driver not found',404);return {status:d.availabilityStatus,updatedAt:d.updatedAt};};
export const updateDriverStatus=async(id:string,status:DriverAvailabilityStatus)=>{
  const d=await operationalDriver(id);
  const activeTrip=await TripModel.exists({driverId:d._id,status:{$in:activeTripStatuses}});
  if(status==='ONLINE'&&!d.assignedAmbulanceId)throw new AppError('DRIVER_AMBULANCE_REQUIRED','Driver must have an assigned ambulance before going online',409);
  if(status==='BUSY'&&!activeTrip)throw new AppError('INVALID_DRIVER_STATUS','Driver cannot be BUSY without an active trip',409);
  if(status==='OFFLINE'&&activeTrip)throw new AppError('DRIVER_ON_ACTIVE_TRIP','Driver cannot go offline during an active trip',409);
  if(status==='ONLINE'&&activeTrip)throw new AppError('DRIVER_ON_ACTIVE_TRIP','Driver must remain BUSY during an active trip',409);
  const x=await AmbulanceDriverModel.findOneAndUpdate({_id:d._id,availabilityStatus:d.availabilityStatus},{$set:{availabilityStatus:status}},{new:true}).lean().exec();
  if(!x)throw new AppError('STALE_DRIVER_UPDATE','Driver status changed before this action could be applied',409);
  return {status:x.availabilityStatus,updatedAt:x.updatedAt};
};
