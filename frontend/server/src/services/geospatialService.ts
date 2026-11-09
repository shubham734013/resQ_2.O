import { Types } from 'mongoose';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import type { z } from 'zod';
import type { nearbyQuerySchema } from '../schemas/maps.js';
import type { AuthenticatedIdentity } from '../types/auth.js';

type NearbyQuery=z.infer<typeof nearbyQuerySchema>;
const point=(latitude:number,longitude:number)=>({type:'Point' as const,coordinates:[longitude,latitude] as [number,number]});
const escapeRegex=(value:string)=>value.replace(/[.*+?^()|[\]\\]/g,'\\$&');
const buildHospitalFilter=(query:NearbyQuery):Record<string,unknown>=>{const filter:Record<string,unknown>={accountStatus:'ACTIVE',verificationStatus:'VERIFIED'};if(query.emergencyAvailability)filter.emergencyAvailability=query.emergencyAvailability;if(query.hospitalType)filter.hospitalType=new RegExp(escapeRegex(query.hospitalType),'i');if(query.service)filter.services=new RegExp(escapeRegex(query.service),'i');if(query.capability)filter.capabilities=new RegExp(escapeRegex(query.capability),'i');return filter;};
const pagination=<T>(items:T[],total:number,q:NearbyQuery)=>({items,pagination:{page:q.page,limit:q.limit,total,totalPages:total===0?0:Math.ceil(total/q.limit)}});
export const listNearbyFacilities=async(query:NearbyQuery)=>{const center=point(query.latitude,query.longitude);const filter=buildHospitalFilter(query);const countFilter={...filter,location:{$geoWithin:{$centerSphere:[[query.longitude,query.latitude],query.radius/6378137]}}};const[items,total]=await Promise.all([HospitalModel.aggregate([{$geoNear:{near:center,key:'location',distanceField:'distanceMeters',spherical:true,maxDistance:query.radius,query:filter}},{$sort:{distanceMeters:1}},{$skip:(query.page-1)*query.limit},{$limit:query.limit},{$project:{name:1,hospitalType:1,services:1,capabilities:1,address:1,city:1,state:1,country:1,phone:1,location:1,verificationStatus:1,accountStatus:1,emergencyAvailability:1,updatedAt:1,distanceMeters:1}}]).exec(),HospitalModel.countDocuments(countFilter).exec()]);return pagination(items.map(hospital=>({id:String(hospital._id),name:String(hospital.name),type:String(hospital.hospitalType),services:Array.isArray(hospital.services)?hospital.services:[],capabilities:Array.isArray(hospital.capabilities)?hospital.capabilities:[],address:typeof hospital.address==='string'?hospital.address:undefined,city:typeof hospital.city==='string'?hospital.city:undefined,state:typeof hospital.state==='string'?hospital.state:undefined,country:typeof hospital.country==='string'?hospital.country:undefined,phone:typeof hospital.phone==='string'?hospital.phone:undefined,latitude:hospital.location?.coordinates?.[1]??0,longitude:hospital.location?.coordinates?.[0]??0,distanceMeters:Number(hospital.distanceMeters??0),verificationStatus:String(hospital.verificationStatus),accountStatus:String(hospital.accountStatus),emergencyAvailability:String(hospital.emergencyAvailability),updatedAt:hospital.updatedAt.toISOString()})),total,query);};

export const listNearbyAmbulances=async(query:NearbyQuery,auth?:AuthenticatedIdentity)=>{
  if(!auth)return {items:[],updatedAt:new Date().toISOString()};
  const center=point(query.latitude,query.longitude);

  if(auth.role==='ADMIN'){
    const items=await AmbulanceModel.find({location:{$near:{$geometry:center,$maxDistance:query.radius}},currentStatus:'AVAILABLE',accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('location currentStatus locationUpdatedAt updatedAt').limit(query.limit).lean().exec();
    return {items:items.map(a=>({id:String(a._id),status:a.currentStatus,latitude:a.location?.coordinates[1]??0,longitude:a.location?.coordinates[0]??0,updatedAt:(a.locationUpdatedAt??a.updatedAt).toISOString()})),updatedAt:new Date().toISOString()};
  }

  if(auth.role==='AMBULANCE_PROVIDER'){
    if(!Types.ObjectId.isValid(auth.id))return {items:[],updatedAt:new Date().toISOString()};
    const items=await AmbulanceModel.find({providerId:new Types.ObjectId(auth.id),location:{$near:{$geometry:center,$maxDistance:query.radius}},accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('location currentStatus locationUpdatedAt updatedAt').limit(query.limit).lean().exec();
    return {items:items.map(a=>({id:String(a._id),status:a.currentStatus,latitude:a.location?.coordinates[1]??0,longitude:a.location?.coordinates[0]??0,updatedAt:(a.locationUpdatedAt??a.updatedAt).toISOString()})),updatedAt:new Date().toISOString()};
  }

  if(auth.role==='AMBULANCE_DRIVER'){
    if(!Types.ObjectId.isValid(auth.id))return {items:[],updatedAt:new Date().toISOString()};
    const driver=await AmbulanceDriverModel.findById(auth.id).select('assignedAmbulanceId').lean().exec();
    if(!driver||!driver.assignedAmbulanceId)return {items:[],updatedAt:new Date().toISOString()};
    const a=await AmbulanceModel.findOne({_id:driver.assignedAmbulanceId,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).select('location currentStatus locationUpdatedAt updatedAt').lean().exec();
    if(!a)return {items:[],updatedAt:new Date().toISOString()};
    return {items:[{id:String(a._id),status:a.currentStatus,latitude:a.location?.coordinates[1]??0,longitude:a.location?.coordinates[0]??0,updatedAt:(a.locationUpdatedAt??a.updatedAt).toISOString()}],updatedAt:new Date().toISOString()};
  }

  if(auth.role==='HOSPITAL'){
    if(!Types.ObjectId.isValid(auth.id))return {items:[],updatedAt:new Date().toISOString()};
    const activeTrips=await TripModel.find({destinationHospitalId:new Types.ObjectId(auth.id),status:{$in:['ASSIGNED','ACCEPTED','TO_PICKUP','AT_PICKUP','PATIENT_ONBOARD','TO_HOSPITAL','AT_HOSPITAL']}}).select('ambulanceId').lean().exec();
    const ambulanceIds=activeTrips.map(t=>t.ambulanceId);
    if(!ambulanceIds.length)return {items:[],updatedAt:new Date().toISOString()};
    const items=await AmbulanceModel.find({_id:{$in:ambulanceIds}}).select('location currentStatus locationUpdatedAt updatedAt').lean().exec();
    return {items:items.map(a=>({id:String(a._id),status:a.currentStatus,latitude:a.location?.coordinates[1]??0,longitude:a.location?.coordinates[0]??0,updatedAt:(a.locationUpdatedAt??a.updatedAt).toISOString()})),updatedAt:new Date().toISOString()};
  }

  if(auth.role==='USER'){
    if(!Types.ObjectId.isValid(auth.id))return {items:[],updatedAt:new Date().toISOString()};
    const activeEmergency=await EmergencyRequestModel.findOne({userId:new Types.ObjectId(auth.id),status:{$in:['RECEIVED','REVIEWING','PREPARING','AMBULANCE_COORDINATION']},ambulanceId:{$exists:true}}).select('ambulanceId').lean().exec();
    if(!activeEmergency||!activeEmergency.ambulanceId)return {items:[],updatedAt:new Date().toISOString()};
    const a=await AmbulanceModel.findById(activeEmergency.ambulanceId).select('location currentStatus locationUpdatedAt updatedAt').lean().exec();
    if(!a)return {items:[],updatedAt:new Date().toISOString()};
    return {items:[{id:String(a._id),status:a.currentStatus,latitude:a.location?.coordinates[1]??0,longitude:a.location?.coordinates[0]??0,updatedAt:(a.locationUpdatedAt??a.updatedAt).toISOString()}],updatedAt:new Date().toISOString()};
  }

  return {items:[],updatedAt:new Date().toISOString()};
};