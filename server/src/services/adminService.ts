import { Types } from 'mongoose';
import { UserModel } from '../models/User.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { AppError } from '../utils/AppError.js';
import type { AccountStatus, Role, VerificationStatus } from '../types/roles.js';
import type { AmbulanceStatus } from '../models/Ambulance.js';
import type { DriverAvailabilityStatus } from '../models/AmbulanceDriver.js';
import type { AdminAmbulance, AdminAmbulanceDriver, AdminAmbulanceProvider, AdminHospital, AdminOverview, AdminRelationshipRef, AdminUser, Pagination } from '../types/admin.js';
import { getLocationFreshness } from './locationService.js';

type ListOptions={page:number;limit:number;sortBy:string;sortOrder:'asc'|'desc'};
type UserFilters=ListOptions&{search?:string;status?:AccountStatus;role?:Role;city?:string;from?:Date;to?:Date};
type HospitalFilters=ListOptions&{search?:string;verification?:VerificationStatus;status?:AccountStatus;city?:string;hospitalType?:string};
type ProviderFilters=ListOptions&{search?:string;verification?:VerificationStatus;status?:AccountStatus;city?:string};
type AmbulanceFilters=ListOptions&{search?:string;currentStatus?:AmbulanceStatus;verification?:VerificationStatus;status?:AccountStatus;provider?:string};
type DriverFilters=ListOptions&{search?:string;verification?:VerificationStatus;status?:AccountStatus;availability?:DriverAvailabilityStatus;provider?:string};
const escapeRegex=(value:string):string=>value.replace(/[.*+?^$()|[\]\\]/g,'\\$&');
const safeId=(id:string):void=>{if(!Types.ObjectId.isValid(id))throw new AppError('INVALID_ID','Invalid resource id',400)};
const notFound=(message:string):never=>{throw new AppError('NOT_FOUND',message,404)};
const listResult=async <T>(itemsPromise:Promise<T[]>,totalPromise:Promise<number>,o:ListOptions):Promise<{items:T[];pagination:Pagination}>=>{const [items,total]=await Promise.all([itemsPromise,totalPromise]);return {items,pagination:{page:o.page,limit:o.limit,total,totalPages:total===0?0:Math.ceil(total/o.limit)}};};

export const getOverview=async():Promise<AdminOverview>=>{
  const activeStatuses=['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION'] as const;
  const [totalUsers,totalHospitals,totalAmbulanceProviders,totalAmbulances,totalAmbulanceDrivers,pendingHospitals,pendingProviders,pendingDrivers,activeUsers,suspendedUsers,verifiedHospitals,verifiedProviders,verifiedDrivers,availableAmbulances,busyAmbulances,offlineAmbulances,maintenanceAmbulances,onlineDrivers,busyDrivers,offlineDrivers,activeEmergencies,resolvedEmergencies,cancelledEmergencies]=await Promise.all([
    UserModel.countDocuments(),HospitalModel.countDocuments(),AmbulanceProviderModel.countDocuments(),AmbulanceModel.countDocuments(),AmbulanceDriverModel.countDocuments(),
    HospitalModel.countDocuments({verificationStatus:'PENDING'}),AmbulanceProviderModel.countDocuments({verificationStatus:'PENDING'}),AmbulanceDriverModel.countDocuments({licenseVerificationStatus:'PENDING'}),
    UserModel.countDocuments({accountStatus:'ACTIVE'}),UserModel.countDocuments({accountStatus:'SUSPENDED'}),
    HospitalModel.countDocuments({verificationStatus:'VERIFIED'}),AmbulanceProviderModel.countDocuments({verificationStatus:'VERIFIED'}),AmbulanceDriverModel.countDocuments({licenseVerificationStatus:'VERIFIED'}),
    AmbulanceModel.countDocuments({currentStatus:'AVAILABLE'}),AmbulanceModel.countDocuments({currentStatus:'BUSY'}),AmbulanceModel.countDocuments({currentStatus:'OFFLINE'}),AmbulanceModel.countDocuments({currentStatus:'MAINTENANCE'}),
    AmbulanceDriverModel.countDocuments({availabilityStatus:'ONLINE'}),AmbulanceDriverModel.countDocuments({availabilityStatus:'BUSY'}),AmbulanceDriverModel.countDocuments({availabilityStatus:'OFFLINE'}),
    EmergencyRequestModel.countDocuments({status:{$in:activeStatuses}}),EmergencyRequestModel.countDocuments({status:'RESOLVED'}),EmergencyRequestModel.countDocuments({status:'CANCELLED'}),
  ]);
  return {totalUsers,totalHospitals,totalAmbulanceProviders,totalAmbulances,totalAmbulanceDrivers,pendingHospitals,pendingProviders,pendingDrivers,activeUsers,suspendedUsers,verifiedHospitals,verifiedProviders,verifiedDrivers,availableAmbulances,busyAmbulances,offlineAmbulances,maintenanceAmbulances,onlineDrivers,busyDrivers,offlineDrivers,activeEmergencies,resolvedEmergencies,cancelledEmergencies};
};

export const listUsers=async(o:UserFilters)=>{const filter:Record<string,unknown>={};if(o.search){const rx=new RegExp(escapeRegex(o.search),'i');filter.$or=[{name:rx},{email:rx},{phone:rx}]}if(o.status)filter.accountStatus=o.status;if(o.role)filter.role=o.role;if(o.city)filter.city=new RegExp('^'+escapeRegex(o.city)+'$','i');if(o.from||o.to)filter.createdAt={...(o.from?{$gte:o.from}:{}),...(o.to?{$lte:o.to}:{})};const select='name email phone role accountStatus emailVerified phoneVerified address city state country latitude longitude createdAt updatedAt';const result=await listResult(UserModel.find(filter).select(select).sort({[o.sortBy]:o.sortOrder==='asc'?1:-1}).skip((o.page-1)*o.limit).limit(o.limit).lean().exec(),UserModel.countDocuments(filter).exec(),o);return {...result,items:result.items.map(x=>({...x,id:String(x._id)})) as unknown as AdminUser[]};};
export const getUser=async(id:string):Promise<AdminUser>=>{safeId(id);const x=await UserModel.findById(id).select('-passwordHash').lean().exec();if(!x)notFound('User not found');return {...x!,id:String(x!._id)} as unknown as AdminUser};
export const updateUserStatus=async(id:string,status:Extract<AccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'>)=>{safeId(id);const x=await UserModel.findByIdAndUpdate(id,{accountStatus:status},{new:true,runValidators:true}).select('-passwordHash').lean().exec();if(!x)notFound('User not found');return {...x!,id:String(x!._id)} as unknown as AdminUser};

const mapResourceSummary=(x:unknown):Record<string,number>=>{if(!x||typeof x!=='object')return {};return Object.fromEntries(Object.entries(x as Record<string,unknown>).filter(([,v])=>typeof v==='number')) as Record<string,number>;};
const hospitalOut=(x:Record<string,unknown>):AdminHospital=>({...x,id:String(x._id),resourceSummary:mapResourceSummary(x.resourceSummary)} as AdminHospital);
export const listHospitals=async(o:HospitalFilters)=>{const filter:Record<string,unknown>={};if(o.search){const rx=new RegExp(escapeRegex(o.search),'i');filter.$or=[{name:rx},{registrationNumber:rx},{email:rx},{phone:rx}]}if(o.verification)filter.verificationStatus=o.verification;if(o.status)filter.accountStatus=o.status;if(o.city)filter.city=new RegExp('^'+escapeRegex(o.city)+'$','i');if(o.hospitalType)filter.hospitalType=o.hospitalType;const result=await listResult(HospitalModel.find(filter).select('-passwordHash').sort({[o.sortBy]:o.sortOrder==='asc'?1:-1}).skip((o.page-1)*o.limit).limit(o.limit).lean().exec(),HospitalModel.countDocuments(filter).exec(),o);return {...result,items:result.items.map(x=>hospitalOut(x as unknown as Record<string,unknown>))};};
export const getHospital=async(id:string)=>{safeId(id);const x=await HospitalModel.findById(id).select('-passwordHash').lean().exec();if(!x)notFound('Hospital not found');return hospitalOut(x! as unknown as Record<string,unknown>)};
export const updateHospitalVerification=async(id:string,verificationStatus:VerificationStatus)=>{safeId(id);const x=await HospitalModel.findByIdAndUpdate(id,{verificationStatus},{new:true,runValidators:true}).select('-passwordHash').lean().exec();if(!x)notFound('Hospital not found');return hospitalOut(x! as unknown as Record<string,unknown>)};
export const updateHospitalStatus=async(id:string,status:Extract<AccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'>)=>{safeId(id);const x=await HospitalModel.findByIdAndUpdate(id,{accountStatus:status},{new:true,runValidators:true}).select('-passwordHash').lean().exec();if(!x)notFound('Hospital not found');return hospitalOut(x! as unknown as Record<string,unknown>)};

const refOut=(x:Record<string,unknown>|null):AdminRelationshipRef|null=>x?({id:String(x._id),...(typeof x.name==='string'?{name:x.name}:{}),...(typeof x.registrationNumber==='string'?{registrationNumber:x.registrationNumber}:{}),...(typeof x.vehicleNumber==='string'?{vehicleNumber:x.vehicleNumber}:{})}):null;
const ambulanceOut=(x:Record<string,unknown>,p:Record<string,unknown>|null,d:Record<string,unknown>|null):AdminAmbulance=>({
  ...(x as unknown as AdminAmbulance),id:String(x._id),provider:refOut(p),assignedDriver:refOut(d),
  locationFreshness:getLocationFreshness(typeof x.locationUpdatedAt==='string'||x.locationUpdatedAt instanceof Date||typeof x.locationUpdatedAt==='number'?x.locationUpdatedAt:undefined),
});

export const listProviders=async(o:ProviderFilters)=>{const filter:Record<string,unknown>={};if(o.search){const rx=new RegExp(escapeRegex(o.search),'i');filter.$or=[{name:rx},{registrationNumber:rx},{email:rx},{phone:rx}]}if(o.verification)filter.verificationStatus=o.verification;if(o.status)filter.accountStatus=o.status;if(o.city)filter.city=new RegExp('^'+escapeRegex(o.city)+'$','i');const [items,total]=await Promise.all([AmbulanceProviderModel.find(filter).select('-passwordHash').sort({[o.sortBy]:o.sortOrder==='asc'?1:-1}).skip((o.page-1)*o.limit).limit(o.limit).lean().exec(),AmbulanceProviderModel.countDocuments(filter).exec()]);const ids=items.map(x=>x._id);const counts=ids.length?await AmbulanceModel.aggregate([{$match:{providerId:{$in:ids}}},{$group:{_id:'$providerId',count:{$sum:1}}} ]):[];const countMap=new Map(counts.map((x:{_id:Types.ObjectId;count:number})=>[String(x._id),x.count]));return {items:items.map(x=>({...x,id:String(x._id),ambulanceCount:countMap.get(String(x._id))??0})) as unknown as AdminAmbulanceProvider[],pagination:{page:o.page,limit:o.limit,total,totalPages:total===0?0:Math.ceil(total/o.limit)}};};
export const getProvider=async(id:string)=>{safeId(id);const x=await AmbulanceProviderModel.findById(id).select('-passwordHash').lean().exec();if(!x)notFound('Ambulance provider not found');const ambulanceCount=await AmbulanceModel.countDocuments({providerId:x!._id});return {...x!,id:String(x!._id),ambulanceCount} as unknown as AdminAmbulanceProvider};
export const updateProviderVerification=async(id:string,verificationStatus:VerificationStatus)=>{safeId(id);const x=await AmbulanceProviderModel.findByIdAndUpdate(id,{verificationStatus},{new:true,runValidators:true}).select('-passwordHash').lean().exec();if(!x)notFound('Ambulance provider not found');return {...x,id:String(x._id),ambulanceCount:await AmbulanceModel.countDocuments({providerId:x._id})} as unknown as AdminAmbulanceProvider};
export const updateProviderStatus=async(id:string,status:Extract<AccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'>)=>{safeId(id);const x=await AmbulanceProviderModel.findById(id).lean().exec();if(!x)notFound('Ambulance provider not found');if(status!=='ACTIVE'){const activeTrip=await TripModel.exists({providerId:x._id,status:{$in:['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL']}});if(activeTrip)throw new AppError('PROVIDER_ACTIVE_TRIP','Provider has active trips and cannot be suspended or rejected until they are safely completed',409);}await AmbulanceProviderModel.updateOne({_id:x._id},{$set:{accountStatus:status}}).exec();if(status!=='ACTIVE')await AmbulanceModel.updateMany({providerId:x._id,currentStatus:{$in:['AVAILABLE','OFFLINE','MAINTENANCE']}},{$set:{currentStatus:'OFFLINE'}}).exec();return {...x,accountStatus:status,ambulanceCount:await AmbulanceModel.countDocuments({providerId:x._id})} as unknown as AdminAmbulanceProvider};

export const listAmbulances=async(o:AmbulanceFilters)=>{
  const filter:Record<string,unknown>={};
  if(o.search){const rx=new RegExp(escapeRegex(o.search),'i');filter.$or=[{registrationNumber:rx},{vehicleNumber:rx},{ambulanceType:rx}]}
  if(o.currentStatus)filter.currentStatus=o.currentStatus;if(o.verification)filter.verificationStatus=o.verification;if(o.status)filter.accountStatus=o.status;if(o.provider)filter.providerId=new Types.ObjectId(o.provider);
  const [items,total]=await Promise.all([AmbulanceModel.find(filter).sort({[o.sortBy]:o.sortOrder==='asc'?1:-1}).skip((o.page-1)*o.limit).limit(o.limit).lean().exec(),AmbulanceModel.countDocuments(filter).exec()]);
  const pIds=items.map(x=>x.providerId),aIds=items.map(x=>x._id);
  const [providers,drivers]=await Promise.all([pIds.length?AmbulanceProviderModel.find({_id:{$in:pIds}}).select('name registrationNumber').lean().exec():Promise.resolve([]),aIds.length?AmbulanceDriverModel.find({assignedAmbulanceId:{$in:aIds}}).select('fullName licenseNumber').lean().exec():Promise.resolve([])]);
  const pMap=new Map(providers.map(x=>[String(x._id),x as unknown as Record<string,unknown>]));const dMap=new Map(drivers.map(x=>[String(x.assignedAmbulanceId),x as unknown as Record<string,unknown>]));
  return {items:items.map(x=>ambulanceOut(x as unknown as Record<string,unknown>,pMap.get(String(x.providerId))??null,dMap.get(String(x._id))??null)),pagination:{page:o.page,limit:o.limit,total,totalPages:total===0?0:Math.ceil(total/o.limit)}};
};
export const getAmbulance=async(id:string)=>{safeId(id);const x=await AmbulanceModel.findById(id).lean().exec();if(!x)notFound('Ambulance not found');const [p,d]=await Promise.all([AmbulanceProviderModel.findById(x.providerId).select('name registrationNumber').lean().exec(),AmbulanceDriverModel.findOne({assignedAmbulanceId:x._id}).select('fullName licenseNumber').lean().exec()]);return ambulanceOut(x as unknown as Record<string,unknown>,p as unknown as Record<string,unknown>|null,d as unknown as Record<string,unknown>|null);};

export const updateAmbulanceVerification=async(id:string,verificationStatus:VerificationStatus)=>{
  safeId(id);
  const x=await AmbulanceModel.findById(id).lean().exec();if(!x)notFound('Ambulance not found');
  if(verificationStatus==='VERIFIED'){
    const provider=await AmbulanceProviderModel.findOne({_id:x.providerId,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('_id').lean().exec();
    if(!provider)throw new AppError('PROVIDER_NOT_OPERATIONAL','Ambulance provider must be active and verified before ambulance verification',409);
    if(!x.registrationNumber||!x.vehicleNumber||!x.ambulanceType)throw new AppError('AMBULANCE_INVALID','Required ambulance registration data is incomplete',409);
  }
  await AmbulanceModel.updateOne({_id:x._id},{$set:{verificationStatus}}).exec();
  return getAmbulance(id);
};
export const updateAmbulanceStatus=async(id:string,status:Extract<AccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'>)=>{
  safeId(id);
  const x=await AmbulanceModel.findById(id).lean().exec();if(!x)notFound('Ambulance not found');
  const activeTrip=await (await import('../models/Trip.js')).TripModel.exists({ambulanceId:x._id,status:{$in:['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL']}});
  if(activeTrip&&status!=='ACTIVE')throw new AppError('AMBULANCE_ACTIVE_TRIP','Active ambulance trips must be completed before the ambulance can be suspended or rejected',409);
  await AmbulanceModel.updateOne({_id:x._id},{$set:{accountStatus:status}}).exec();
  if(status!=='ACTIVE')await AmbulanceModel.updateOne({_id:x._id},{$set:{currentStatus:'OFFLINE'}}).exec();
  return getAmbulance(id);
};

export const listDrivers=async(o:DriverFilters)=>{const filter:Record<string,unknown>={};if(o.search){const rx=new RegExp(escapeRegex(o.search),'i');filter.$or=[{fullName:rx},{email:rx},{phone:rx},{licenseNumber:rx}]}if(o.verification)filter.licenseVerificationStatus=o.verification;if(o.status)filter.accountStatus=o.status;if(o.availability)filter.availabilityStatus=o.availability;if(o.provider)filter.providerId=new Types.ObjectId(o.provider);const [items,total]=await Promise.all([AmbulanceDriverModel.find(filter).select('-passwordHash').sort({[o.sortBy]:o.sortOrder==='asc'?1:-1}).skip((o.page-1)*o.limit).limit(o.limit).lean().exec(),AmbulanceDriverModel.countDocuments(filter).exec()]);const [providers,ambulances]=await Promise.all([items.length?AmbulanceProviderModel.find({_id:{$in:items.map(x=>x.providerId)}}).select('name registrationNumber').lean().exec():Promise.resolve([]),items.length?AmbulanceModel.find({_id:{$in:items.flatMap(x=>x.assignedAmbulanceId?[x.assignedAmbulanceId]:[])}}).select('registrationNumber vehicleNumber').lean().exec():Promise.resolve([])]);const pMap=new Map(providers.map(x=>[String(x._id),x as unknown as Record<string,unknown>]));const aMap=new Map(ambulances.map(x=>[String(x._id),x as unknown as Record<string,unknown>]));return {items:items.map(x=>({...x,id:String(x._id),provider:refOut(pMap.get(String(x.providerId))??null),assignedAmbulance:x.assignedAmbulanceId?refOut(aMap.get(String(x.assignedAmbulanceId))??null):null})) as unknown as AdminAmbulanceDriver[],pagination:{page:o.page,limit:o.limit,total,totalPages:total===0?0:Math.ceil(total/o.limit)}};};
export const getDriver=async(id:string)=>{safeId(id);const x=await AmbulanceDriverModel.findById(id).select('-passwordHash').lean().exec();if(!x)notFound('Ambulance driver not found');const [p,a]=await Promise.all([AmbulanceProviderModel.findById(x!.providerId).select('name registrationNumber').lean().exec(),x!.assignedAmbulanceId?AmbulanceModel.findById(x!.assignedAmbulanceId).select('registrationNumber vehicleNumber').lean().exec():Promise.resolve(null)]);return {...x!,id:String(x!._id),provider:refOut(p as unknown as Record<string,unknown>|null),assignedAmbulance:refOut(a as unknown as Record<string,unknown>|null)} as unknown as AdminAmbulanceDriver};
export const updateDriverVerification=async(id:string,verificationStatus:VerificationStatus)=>{safeId(id);if(!await AmbulanceDriverModel.exists({_id:id}))notFound('Ambulance driver not found');await AmbulanceDriverModel.updateOne({_id:id},{$set:{licenseVerificationStatus:verificationStatus}}).exec();return getDriver(id)};
export const updateDriverStatus=async(id:string,status:Extract<AccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'>)=>{safeId(id);const d=await AmbulanceDriverModel.findById(id).lean().exec();if(!d)notFound('Ambulance driver not found');if(status!=='ACTIVE'){const activeTrip=await TripModel.exists({driverId:d._id,status:{$in:['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL']}});if(activeTrip)throw new AppError('DRIVER_ACTIVE_TRIP','Driver has an active trip and cannot be suspended or rejected until it is safely completed',409);}await AmbulanceDriverModel.updateOne({_id:d._id},{$set:{accountStatus:status}}).exec();if(status!=='ACTIVE')await AmbulanceDriverModel.updateOne({_id:d._id},{$set:{availabilityStatus:'OFFLINE'}}).exec();return getDriver(id)};